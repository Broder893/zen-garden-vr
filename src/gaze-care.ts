import {
  Box3,
  Color,
  createSystem,
  Entity,
  Grabbed,
  Object3D,
  Quaternion,
  Vector3,
  VisibilityState,
} from '@iwsdk/core';
import { BonsaiGrowthSystem, SHOOTS_BY_STAGE } from './bonsai-growth.js';
import { trackFirst, FirstEntity } from './ecs-utils.js';
import { DwellRing } from './effects/dwell-ring.js';
import { AssistHeld, Bonsai, PruningShears, WateringCan } from './garden-components.js';
import { InputModeSystem } from './input-mode.js';
import { MeditationSystem } from './meditation.js';
import { SharedTreeSystem } from './shared-tree.js';

/** Seconds of looking at the can, shears or basin to use it (as for the seed and stone). */
const GAZE_SECONDS = 2;
/** Looking within this angle of a thing's centre counts as looking at it. */
const GAZE_COS = Math.cos((7 * Math.PI) / 180);
/** The basin is a wider target. */
const BASIN_GAZE_COS = Math.cos((9 * Math.PI) / 180);
/** Durations of the tool's moves (seconds). */
const TRAVEL = 1.3;
const TILT = 0.6;
const LEVEL = 0.5;
const DESCEND = 0.6;
const SNIP_HOLD = 0.5;
/** Longest pour: the tree (until its water is full) and the basin (one care). */
const POUR_TREE_MAX = 6;
const POUR_BASIN = 2;
/** Tilt of a pouring can, around its own Z (as DwellSystem's hands-free pour). */
const POUR_TILT = 0.95;
/** Can centre: this far back from the target along the spout, and this high above it. */
const SPOUT_BACK = 0.12;
const ABOVE_TREE = 0.25;
const ABOVE_BASIN = 0.2;
/** The shears come down onto the shoot from this far above (so the blades arrive, as the cut needs). */
const SHEARS_ABOVE = 0.09;
const RING_COLOR = new Color('#bfe8ff');

type Act = 'water' | 'share' | 'trim';
type Target = 'can' | 'shears' | 'basin';

interface Job {
  entity: Entity;
  act: Act;
  phase: number;
  t: number;
  /** World positions: start, and where the tool works. */
  from: Vector3;
  to: Vector3;
  rest: Quaternion;
  caresBefore: number;
  stageBefore: number;
}

/**
 * Gaze care: with no tracked hands (hand tracking off, or controllers in use)
 * the garden can be tended by looking. A steady look at the watering can
 * sends it over the tree to pour; at the shears, they trim the next glowing
 * shoot; at the stone basin, the can pours into it for the shared tree. A
 * ring of light fills while looking, so a glance never triggers anything.
 * The tool moves by itself (it carries AssistHeld, so watering and pruning
 * work as usual) and glides home afterwards. The seed and the stone respond to
 * a look through DwellSystem.
 */
export class GazeCareSystem extends createSystem({
  cans: { required: [WateringCan] },
  shears: { required: [PruningShears] },
  bonsai: { required: [Bonsai] },
}) {
  /** What is being looked at, and the 0..1 progress (read by tests). */
  looking: Target | null = null;
  progress = 0;
  /** The current move, if any (read by tests). */
  job: Job | null = null;
  private inputMode?: InputModeSystem;
  private meditation?: MeditationSystem;
  private growth?: BonsaiGrowthSystem;
  private shared?: SharedTreeSystem;
  private can!: FirstEntity;
  private shearsRef!: FirstEntity;
  private bonsai!: FirstEntity;
  private ring!: DwellRing;
  private time = 0;
  /** After use, the look must leave that thing before it can start it again. */
  private spent: Target | null = null;
  private head = new Vector3();
  private headQuat = new Quaternion();
  private forward = new Vector3();
  private toward = new Vector3();
  private center = new Vector3();
  private ringAt = new Vector3();
  private p = new Vector3();
  private q = new Quaternion();
  private tiltQ = new Quaternion();
  private zAxis = new Vector3(0, 0, 1);
  private localCenters = new WeakMap<Object3D, Vector3>();
  private jobPool: Job = {
    entity: null as unknown as Entity,
    act: 'water',
    phase: 0,
    t: 0,
    from: new Vector3(),
    to: new Vector3(),
    rest: new Quaternion(),
    caresBefore: 0,
    stageBefore: 0,
  };

  init(): void {
    this.can = trackFirst(this.queries.cans, this.cleanupFuncs);
    this.shearsRef = trackFirst(this.queries.shears, this.cleanupFuncs);
    this.bonsai = trackFirst(this.queries.bonsai, this.cleanupFuncs);
    this.ring = new DwellRing();
    this.world.createTransformEntity(this.ring.root);
  }

  update(delta: number): void {
    this.inputMode ??= this.world.getSystem(InputModeSystem);
    this.meditation ??= this.world.getSystem(MeditationSystem);
    this.growth ??= this.world.getSystem(BonsaiGrowthSystem);
    this.shared ??= this.world.getSystem(SharedTreeSystem);
    this.player.head.getWorldPosition(this.head);
    if (this.job) this.step(delta);
    const on =
      !!this.inputMode?.gaze &&
      !this.job &&
      !this.meditation?.active &&
      this.world.visibilityState.peek() === VisibilityState.Visible;
    let target = on ? this.lookedAt() : null;
    if (on && target !== this.spent) this.spent = null;
    if (target === this.spent) target = null;
    if (target !== this.looking) {
      this.looking = target;
      this.time = 0;
    }
    this.time = target ? this.time + delta : 0;
    this.progress = target ? Math.min(1, this.time / GAZE_SECONDS) : 0;
    this.ring.update(delta, this.progress, this.ringAt, this.head, RING_COLOR);
    if (target && this.progress >= 1) {
      this.start(target);
      this.spent = target;
      this.looking = null;
      this.time = 0;
    }
  }

  /** The can, shears or basin under a steady look, if it has something to do now. */
  private lookedAt(): Target | null {
    this.player.head.getWorldQuaternion(this.headQuat);
    this.forward.set(0, 0, -1).applyQuaternion(this.headQuat);
    const can = this.can.entity;
    if (can && this.usable(can) && this.canWater() && this.inGaze(this.centerOf(can.object3D), GAZE_COS)) {
      this.ringAt.copy(this.center).y += 0.12;
      return 'can';
    }
    const shears = this.shearsRef.entity;
    if (shears && this.usable(shears) && this.nextShoot() && this.inGaze(this.centerOf(shears.object3D), GAZE_COS)) {
      this.ringAt.copy(this.center).y += 0.06;
      return 'shears';
    }
    if (can && this.usable(can) && this.shared?.hasBasin && this.inGaze(this.center.copy(this.shared.basinPos), BASIN_GAZE_COS)) {
      this.ringAt.copy(this.center).y += 0.08;
      return 'basin';
    }
    return null;
  }

  private usable(e: Entity): boolean {
    return !!e.object3D?.visible && !e.hasComponent(Grabbed) && !e.hasComponent(AssistHeld);
  }

  /** A planted tree still thirsty (and not drowned): the can has work. */
  private canWater(): boolean {
    const b = this.bonsai.entity;
    if (!b || !b.getValue(Bonsai, 'planted')) return false;
    return (b.getValue(Bonsai, 'water') ?? 0) < 1 && (b.getValue(Bonsai, 'overwater') ?? 0) < 0.3;
  }

  /** The cut point of the next glowing shoot still to trim, or null. */
  private nextShoot(): Object3D | null {
    const b = this.bonsai.entity;
    if (!b) return null;
    const stage = b.getValue(Bonsai, 'stage') ?? 0;
    const mask = b.getValue(Bonsai, 'prunedMask') ?? 0;
    const shoots = SHOOTS_BY_STAGE[stage] ?? [];
    for (let i = 0; i < shoots.length; i++) {
      if (mask & (1 << i)) continue;
      const shoot = this.growth?.getShoot(shoots[i]);
      if (shoot?.visible) return shoot.getObjectByName('CutPoint') ?? null;
    }
    return null;
  }

  private inGaze(at: Vector3, cos: number): boolean {
    this.toward.subVectors(at, this.head).normalize();
    return this.toward.dot(this.forward) >= cos;
  }

  /** World centre of an object's bounding box (cached in its own frame), left in this.center. */
  private centerOf(obj: Object3D | undefined): Vector3 {
    if (!obj) return this.center.set(0, -100, 0);
    let local = this.localCenters.get(obj);
    if (!local) {
      obj.updateWorldMatrix(true, true);
      local = new Box3().setFromObject(obj).getCenter(new Vector3());
      obj.worldToLocal(local);
      this.localCenters.set(obj, local);
    }
    return obj.localToWorld(this.center.copy(local));
  }

  /** Plans the move: where the tool goes, keeping its resting orientation. */
  private start(target: Target): void {
    const entity = target === 'shears' ? this.shearsRef.entity : this.can.entity;
    const obj = entity?.object3D;
    if (!entity || !obj) return;
    const job = this.jobPool;
    job.entity = entity;
    job.act = target === 'can' ? 'water' : target === 'basin' ? 'share' : 'trim';
    job.phase = 0;
    job.t = 0;
    job.caresBefore = this.shared?.caresGiven ?? 0;
    job.stageBefore = this.bonsai.entity?.getValue(Bonsai, 'stage') ?? 0;
    obj.getWorldPosition(job.from);
    obj.getWorldQuaternion(job.rest);
    if (job.act === 'trim') {
      const cut = this.nextShoot();
      const tip = obj.getObjectByName('BladeTip');
      if (!cut || !tip) return;
      // Where the shears' origin must be for the blade tip to reach the cut, approached from above.
      cut.getWorldPosition(job.to);
      tip.getWorldPosition(this.p).sub(job.from);
      job.to.sub(this.p);
    } else {
      // The spout points along the can's local +X: stand back from the target along it.
      this.toward.set(1, 0, 0).applyQuaternion(job.rest).setY(0).normalize();
      if (job.act === 'water') {
        this.bonsai.entity?.object3D?.getWorldPosition(job.to);
        job.to.y += ABOVE_TREE;
      } else {
        job.to.copy(this.shared?.basinPos ?? job.from);
        job.to.y += ABOVE_BASIN;
      }
      job.to.addScaledVector(this.toward, -SPOUT_BACK);
    }
    entity.addComponent(AssistHeld, { hand: 1 });
    this.job = job;
  }

  /** Advances the move: travel, then pour (can) or come down onto the shoot (shears), then let go. */
  private step(delta: number): void {
    const job = this.job;
    const obj = job?.entity.object3D;
    if (!job || !obj) return this.finish();
    job.t += delta;
    const trim = job.act === 'trim';
    switch (job.phase) {
      case 0: {
        // Travel in a gentle arc (to above the shoot, for the shears).
        const k = smooth(Math.min(1, job.t / TRAVEL));
        this.p.lerpVectors(job.from, job.to, k);
        this.p.y += Math.sin(Math.PI * k) * 0.08 + (trim ? SHEARS_ABOVE * k : 0);
        this.place(obj, this.p, job.rest);
        if (job.t >= TRAVEL) this.next(job);
        break;
      }
      case 1: {
        if (trim) {
          // The blades come down onto the shoot: the cut happens as they arrive.
          const k = smooth(Math.min(1, job.t / DESCEND));
          this.p.copy(job.to).y += SHEARS_ABOVE * (1 - k);
          this.place(obj, this.p, job.rest);
          if (job.t >= DESCEND) this.next(job);
        } else {
          this.tilt(obj, job, smooth(Math.min(1, job.t / TILT)));
          if (job.t >= TILT) this.next(job);
        }
        break;
      }
      case 2: {
        if (trim) {
          if (job.t >= SNIP_HOLD) return this.finish();
        } else {
          this.tilt(obj, job, 1);
          const b = this.bonsai.entity;
          const done =
            job.act === 'water'
              ? // Full, or it just grew (its new stage starts dry: that is the next care).
                (b?.getValue(Bonsai, 'water') ?? 1) >= 1 ||
                (b?.getValue(Bonsai, 'stage') ?? 0) !== job.stageBefore ||
                job.t >= POUR_TREE_MAX
              : (this.shared?.caresGiven ?? 0) > job.caresBefore || job.t >= POUR_BASIN;
          if (done) this.next(job);
        }
        break;
      }
      default: {
        this.tilt(obj, job, 1 - smooth(Math.min(1, job.t / LEVEL)));
        if (job.t >= LEVEL) this.finish();
      }
    }
  }

  private next(job: Job): void {
    job.phase++;
    job.t = 0;
  }

  /** Lets the tool go: ReturnHomeSystem glides it back to its place. */
  private finish(): void {
    const e = this.job?.entity;
    if (e?.hasComponent(AssistHeld)) e.removeComponent(AssistHeld);
    this.job = null;
  }

  private tilt(obj: Object3D, job: Job, k: number): void {
    this.tiltQ.setFromAxisAngle(this.zAxis, -POUR_TILT * k);
    this.q.copy(job.rest).multiply(this.tiltQ);
    this.place(obj, job.to, this.q);
  }

  /** Sets a world pose on an object whose parent may be moved or rotated. */
  private place(obj: Object3D, world: Vector3, quat: Quaternion): void {
    const parent = obj.parent;
    obj.position.copy(world);
    obj.quaternion.copy(quat);
    if (parent) {
      parent.updateWorldMatrix(true, false);
      parent.worldToLocal(obj.position);
      parent.getWorldQuaternion(this.tiltQ).invert();
      obj.quaternion.premultiply(this.tiltQ);
    }
  }
}

function smooth(k: number): number {
  return k * k * (3 - 2 * k);
}
