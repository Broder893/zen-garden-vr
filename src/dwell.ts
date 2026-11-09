import {
  Box3,
  Color,
  createSystem,
  Entity,
  Grabbed,
  Matrix4,
  Object3D,
  Quaternion,
  Vector3,
} from '@iwsdk/core';
import { ComfortSystem } from './comfort.js';
import { trackFirst, FirstEntity } from './ecs-utils.js';
import { DwellRing } from './effects/dwell-ring.js';
import {
  AssistHeld,
  Bonsai,
  MeditationStone,
  PruningShears,
  ReturnHome,
  Seed,
  WateringCan,
} from './garden-components.js';
import { GuideSystem } from './guide.js';
import { MeditationSystem } from './meditation.js';
import { InputModeSystem } from './input-mode.js';
import { SharedTreeSystem } from './shared-tree.js';

/** Seconds a hand must stay by an object to select it. */
const HAND_DWELL = 1.2;
/** Seconds of looking straight at the seed or stone to select it. */
const GAZE_DWELL = 2;
/**
 * A hand (its grip point, the middle of the palm) this close in metres to an
 * object's centre is "by" it. Generous: the palm sits well behind the fingers
 * that would touch, and the can is usually held by its handle.
 */
const HAND_RADIUS = { seed: 0.12, stone: 0.13, can: 0.16, shears: 0.16 } as const;
/** Looking within this angle of an object's centre counts as looking at it. */
const GAZE_COS = Math.cos((6 * Math.PI) / 180);
/** Hand distances from the head that mean "tracked and in front of me". */
const HAND_MIN = 0.12;
const HAND_MAX = 0.9;
/**
 * Setting a tool down: lowered to within this height of the table top
 * (anywhere: no aiming needed), for this long. It then glides home.
 */
const PUT_DOWN_HEIGHT = 0.09;
/** ...or the hand holding it brought down to this height above the table top. */
const PUT_DOWN_HAND = 0.12;
const PUT_DOWN_SECONDS = 0.8;
/** A tool counts as lifted once it is this far from its resting place. */
const LIFTED = 0.15;
/** A hand-free can tips itself to pour when held over the tree. */
const POUR_TILT = 0.95;
const POUR_REACH = 0.25;
/** Seconds without a tracked hand before a held tool is let go. */
const LOST_SECONDS = 1.5;
const RING_COLOR = new Color('#fff3b0');

type Kind = keyof typeof HAND_RADIUS;
interface Hold {
  entity: Entity;
  offset: Matrix4;
  lifted: boolean;
  putDown: number;
  lost: number;
  tilt: number;
}

/**
 * "Hold to select", for players who cannot pinch (turned on in the Comfort
 * panel). Keeping a hand still beside the seed or stone for about a second
 * presses it; beside the can or shears it picks the tool up, and the tool
 * follows that hand until it is set back on its spot. The seed and stone
 * also respond to a steady look. A held can pours by itself over the tree,
 * so no wrist turn is needed. A ring of light shows each selection filling.
 */
export class DwellSystem extends createSystem({
  seeds: { required: [Seed] },
  stones: { required: [MeditationStone] },
  cans: { required: [WateringCan] },
  shears: { required: [PruningShears] },
  bonsai: { required: [Bonsai] },
}) {
  private comfort?: ComfortSystem;
  private guide?: GuideSystem;
  private meditation?: MeditationSystem;
  private seed!: FirstEntity;
  private stone!: FirstEntity;
  private can!: FirstEntity;
  private shearsRef!: FirstEntity;
  private bonsai!: FirstEntity;
  private ring!: DwellRing;
  /**
   * What each hand (0 left, 1 right) carries hands-free, with its grip offset.
   * Per-hand input state, not an entity list: the AssistHeld component is the
   * source of truth that watering, pruning and the guide query.
   */
  private holds: [Hold | null, Hold | null] = [null, null];
  // Per hand (0 left, 1 right) and for the gaze (2): what is being dwelt on, and how long.
  private dwellOn: (Entity | null)[] = [null, null, null];
  private dwellTime = [0, 0, 0];
  /** After a selection, that source must move away before it can select again. */
  private spent: (Entity | null)[] = [null, null, null];
  private head = new Vector3();
  private headQuat = new Quaternion();
  private forward = new Vector3();
  private hand = new Vector3();
  private center = new Vector3();
  private toward = new Vector3();
  private shared?: SharedTreeSystem;
  private inputMode?: InputModeSystem;
  private ringAt = new Vector3();
  private m = new Matrix4();
  private m2 = new Matrix4();
  private tiltM = new Matrix4();
  private home = new Vector3();
  private scratchQ = new Quaternion();
  private scratchS = new Vector3();
  private frameBest = 0;
  /** Each object's bounding-box centre in its own frame (models' origins sit at their base or pivot). */
  private localCenters = new WeakMap<Entity, Vector3>();
  private nearest: Entity | null = null;
  private nearestD = 0;

  /** 0..1 progress of the selection closest to done (read by tests and tooling). */
  progress = 0;

  init(): void {
    this.comfort = this.world.getSystem(ComfortSystem);
    this.guide = this.world.getSystem(GuideSystem);
    this.meditation = this.world.getSystem(MeditationSystem);
    this.seed = trackFirst(this.queries.seeds, this.cleanupFuncs);
    this.stone = trackFirst(this.queries.stones, this.cleanupFuncs);
    this.can = trackFirst(this.queries.cans, this.cleanupFuncs);
    this.shearsRef = trackFirst(this.queries.shears, this.cleanupFuncs);
    this.bonsai = trackFirst(this.queries.bonsai, this.cleanupFuncs);
    this.ring = new DwellRing();
    this.world.createTransformEntity(this.ring.root);
  }

  update(delta: number): void {
    const on = this.comfort?.settings.dwell ?? false;
    // Without tracked hands the seed and stone answer a look even with "hold to select" off.
    this.inputMode ??= this.world.getSystem(InputModeSystem);
    const gaze = on || !!this.inputMode?.gaze;
    this.player.head.getWorldPosition(this.head);
    if (!gaze) {
      this.releaseAll();
      this.ring.update(delta, 0, this.ringAt, this.head, RING_COLOR);
      this.progress = 0;
      return;
    }
    this.player.head.getWorldQuaternion(this.headQuat);
    this.forward.set(0, 0, -1).applyQuaternion(this.headQuat);

    // The setting turned off while a tool was held: let it go (looks keep working).
    if (!on && (this.holds[0] || this.holds[1])) {
      if (this.holds[0]) this.release(0);
      if (this.holds[1]) this.release(1);
    }
    this.frameBest = 0;
    // Hands (or controllers) hold to select only with the setting on.
    for (let side = 0; side < 2 && on; side++) {
      const space = side === 0 ? this.player.gripSpaces.left : this.player.gripSpaces.right;
      const allowed = this.comfort?.usesHand(side === 0 ? 'left' : 'right') ?? true;
      const tracked = allowed && this.trackedHand(space);
      const hold = this.holds[side];
      if (hold) {
        this.carry(side, hold, tracked ? space : undefined, delta);
        continue;
      }
      const target = tracked ? this.nearestByHand() : null;
      this.dwell(side, target, HAND_DWELL, delta);
    }
    this.dwell(2, this.lookedAt(), GAZE_DWELL, delta);
    this.progress = this.frameBest;
    this.ring.update(delta, this.frameBest, this.ringAt, this.head, RING_COLOR);
  }

  /** Advances one source's dwell on `target`; the ring shows the one closest to done. */
  private dwell(source: number, target: Entity | null, seconds: number, delta: number): void {
    if (target !== this.spent[source]) this.spent[source] = null;
    if (!target || target === this.spent[source] || target.hasComponent(Grabbed) || target.hasComponent(AssistHeld)) {
      this.dwellOn[source] = null;
      this.dwellTime[source] = 0;
      return;
    }
    if (target !== this.dwellOn[source]) {
      this.dwellOn[source] = target;
      this.dwellTime[source] = 0;
    }
    this.dwellTime[source] += delta;
    const k = Math.min(1, this.dwellTime[source] / seconds);
    if (k >= 1) {
      // Every source on this target is spent, so a hand and a look on the
      // stone cannot both fire (the second would pause the session just begun).
      for (let i = 0; i < 3; i++) {
        if (i !== source && this.dwellOn[i] !== target) continue;
        this.spent[i] = target;
        this.dwellOn[i] = null;
        this.dwellTime[i] = 0;
      }
      this.select(target, source);
      return;
    }
    if (k > this.frameBest) {
      this.frameBest = k;
      this.centerOf(target, this.ringAt);
      this.ringAt.y += 0.05;
    }
  }

  private select(target: Entity, source: number): void {
    if (target === this.seed.entity) this.guide?.plantSeed(target);
    else if (target === this.stone.entity) this.meditation?.pinch(target);
    else if (source < 2) this.pickUp(target, source);
  }

  private pickUp(tool: Entity, side: number): void {
    const obj = tool.object3D;
    const space = side === 0 ? this.player.gripSpaces.left : this.player.gripSpaces.right;
    if (!obj || !space) return;
    obj.updateWorldMatrix(true, false);
    space.updateWorldMatrix(true, false);
    // Keep the tool where it is relative to the hand: offset = hand^-1 * tool.
    const offset = new Matrix4().copy(space.matrixWorld).invert().multiply(obj.matrixWorld);
    tool.addComponent(AssistHeld, { hand: side });
    this.holds[side] = { entity: tool, offset, lifted: false, putDown: 0, lost: 0, tilt: 0 };
  }

  /** Moves a held tool with its hand, pours a can over the tree, and lets go when set down. */
  private carry(side: number, hold: Hold, space: Object3D | undefined, delta: number): void {
    const obj = hold.entity.object3D;
    // Pinched as well: the normal grab takes over (and must not pour twice).
    if (!obj || hold.entity.hasComponent(Grabbed)) return this.release(side);
    if (!space) {
      hold.lost += delta;
      if (hold.lost >= LOST_SECONDS) this.release(side);
      return;
    }
    hold.lost = 0;
    space.updateWorldMatrix(true, false);
    this.m.multiplyMatrices(space.matrixWorld, hold.offset);
    // A can tips forward (spout down, around its own Z) while over the tree.
    if (hold.entity.hasComponent(WateringCan)) {
      this.m.decompose(this.center, this.scratchQ, this.scratchS);
      // ...but never once the tree has all its water: hands-free pouring cannot drown it.
      const full = (this.bonsai.entity?.getValue(Bonsai, 'water') ?? 0) >= 1;
      // The shared tree's basin takes water too (it can never overflow).
      this.shared ??= this.world.getSystem(SharedTreeSystem);
      const overBasin = this.shared?.overBasin(this.center, POUR_REACH) ?? false;
      const want = (this.overTree(this.center) && !full) || overBasin ? 1 : 0;
      hold.tilt += (want - hold.tilt) * (1 - Math.exp(-4 * delta));
      this.m.multiply(this.tiltM.makeRotationZ(-POUR_TILT * hold.tilt));
    }
    const parent = obj.parent;
    if (parent) this.m2.copy(parent.matrixWorld).invert().multiply(this.m);
    else this.m2.copy(this.m);
    this.m2.decompose(obj.position, obj.quaternion, this.scratchS);

    // Setting down: lowered to table height (once it has been lifted away).
    if (!hold.entity.hasComponent(ReturnHome)) return;
    this.home.fromArray(hold.entity.getVectorView(ReturnHome, 'homePosition'));
    if (obj.position.distanceTo(this.home) > LIFTED) hold.lifted = true;
    space.getWorldPosition(this.hand);
    const low = obj.position.y < this.home.y + PUT_DOWN_HEIGHT || this.hand.y < this.home.y + PUT_DOWN_HAND;
    if (hold.lifted && low) {
      hold.putDown += delta;
      if (hold.putDown >= PUT_DOWN_SECONDS) this.release(side);
    } else hold.putDown = 0;
  }

  private overTree(at: Vector3): boolean {
    const tree = this.bonsai.entity?.object3D;
    if (!tree) return false;
    tree.getWorldPosition(this.toward);
    const dx = at.x - this.toward.x;
    const dz = at.z - this.toward.z;
    return dx * dx + dz * dz < POUR_REACH * POUR_REACH && at.y > this.toward.y + 0.1;
  }

  private release(side: number): void {
    const hold = this.holds[side];
    this.holds[side] = null;
    if (!hold) return;
    if (hold.entity.hasComponent(AssistHeld)) hold.entity.removeComponent(AssistHeld);
    // The hand is still beside it: it must move away before picking it up again.
    this.spent[side] = hold.entity;
  }

  private releaseAll(): void {
    if (this.holds[0]) this.release(0);
    if (this.holds[1]) this.release(1);
    for (let i = 0; i < 3; i++) {
      this.dwellOn[i] = null;
      this.dwellTime[i] = 0;
    }
  }

  /** True when this grip space is tracked and in front of the player; leaves its position in this.hand. */
  private trackedHand(space: Object3D | undefined): space is Object3D {
    if (!space) return false;
    space.getWorldPosition(this.hand);
    const d = this.hand.distanceTo(this.head);
    return d >= HAND_MIN && d <= HAND_MAX;
  }

  /** The selectable object nearest to this.hand within reach, or null. */
  private nearestByHand(): Entity | null {
    this.nearest = null;
    this.nearestD = Infinity;
    this.consider(this.seed.entity);
    // During a session a hand resting by the stone must not pause it: only a look does.
    if (!this.meditation?.active) this.consider(this.stone.entity);
    this.consider(this.can.entity);
    this.consider(this.shearsRef.entity);
    return this.nearest;
  }

  private consider(e: Entity | null): void {
    if (!e?.object3D?.visible) return;
    this.centerOf(e, this.center);
    const d = this.center.distanceTo(this.hand);
    if (d < HAND_RADIUS[this.kindOf(e)] && d < this.nearestD) {
      this.nearestD = d;
      this.nearest = e;
    }
  }

  /** The seed or stone the player is looking straight at, or null. */
  private lookedAt(): Entity | null {
    if (this.inGaze(this.seed.entity)) return this.seed.entity;
    if (this.inGaze(this.stone.entity)) return this.stone.entity;
    return null;
  }

  private inGaze(e: Entity | null): boolean {
    if (!e?.object3D?.visible) return false;
    this.centerOf(e, this.center);
    this.toward.subVectors(this.center, this.head).normalize();
    return this.toward.dot(this.forward) >= GAZE_COS;
  }

  private centerOf(e: Entity, out: Vector3): void {
    const obj = e.object3D;
    if (!obj) return;
    let local = this.localCenters.get(e);
    if (!local) {
      // Once per object: the box centre, kept in local space so it moves with it.
      obj.updateWorldMatrix(true, true);
      local = new Box3().setFromObject(obj).getCenter(new Vector3());
      obj.worldToLocal(local);
      this.localCenters.set(e, local);
    }
    out.copy(local);
    obj.localToWorld(out);
  }

  private kindOf(e: Entity): Kind {
    if (e === this.seed.entity) return 'seed';
    if (e === this.stone.entity) return 'stone';
    if (e === this.can.entity) return 'can';
    return 'shears';
  }
}
