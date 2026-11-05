import {
  Color,
  createSystem,
  Entity,
  GrabSystem,
  VisibilityState,
  Grabbed,
  MeshBasicMaterial,
  Object3D,
  Quaternion,
  UIKit,
  UIKitMLAsset,
  Vector3,
} from '@iwsdk/core';
import { SHOOTS_BY_STAGE } from './bonsai-growth.js';
import {
  AssistHeld,
  Bonsai,
  BonsaiStage,
  BreathOrb,
  FireflyGuide,
  MeditationStone,
  PruningShears,
  Seed,
  WateringCan,
} from './garden-components.js';
import { MeditationCue, MeditationSystem } from './meditation.js';
import { PersistenceSystem } from './persistence.js';
import { PruningSystem } from './pruning.js';
import { trackFirst, FirstEntity } from './ecs-utils.js';
import { ComfortSystem } from './comfort.js';
import { EntranceSystem } from './entrance.js';
import { WateringSystem } from './watering.js';
import { GestureHint, GestureKind } from './effects/gesture-hint.js';

/** Firefly moods: each tints the glow so the task reads before the words do. */
const MOOD = {
  welcome: new Color('#ffd76a'),
  water: new Color('#8fd3ff'),
  prune: new Color('#b8ff7a'),
  bloom: new Color('#ffb3d1'),
  calm: new Color('#b9a8ff'),
} as const;
type Mood = keyof typeof MOOD;

/** Short subtitle lines (English). Kept under ~60 characters each. */
export const LINES = {
  plantSeed: 'Welcome. Pinch the glowing seed to plant it.',
  welcomeBack: 'Welcome back. Your little tree missed you.',
  welcomeGift: 'Welcome back. A new flower grew while you were away.',
  planted: 'Your seed is planted. Let us help it grow.',
  pickCan: 'Pinch the watering can to lift it.',
  tiltCan: 'Tilt the can over the little tree to pour.',
  moveSpout: 'Bring the spout over the tree.',
  pouring: 'Gently... keep pouring.',
  grewYoung: 'It is growing! The glowing shoots need a trim.',
  grewMature: 'Beautiful. Your tree is getting stronger.',
  pickShears: 'Pinch the shears to pick them up.',
  touchShoot: 'Touch a glowing shoot with the blades.',
  snip: 'Snip! Nicely done.',
  bloomed: 'Your bonsai is in bloom. Well done.',
  rest: 'Rest here, or pinch the stone to breathe.',
  meditateHint: 'Any time, pinch the glowing stone to breathe.',
  breatheIntro: 'Let us breathe together. Follow the light.',
  breatheIn: 'Breathe in...',
  breatheHold: 'Hold...',
  breatheOut: 'And breathe out...',
  breatheSoften: 'Breathe out... let your shoulders soften.',
  breatheNotice: 'Breathe in... notice the cool air.',
  meditatePaused: 'Paused. Pinch the stone to continue.',
  meditateDone: 'Well done. Come back to breathe any time.',
  resumed: 'Welcome back. Let us carry on.',
  // Clearer versions, shown when a task has waited a while (see HELP).
  plantSeedHelp: 'Reach out to the seed, then touch thumb to finger.',
  pickCanHelp: 'Move your hand to the can, then pinch to hold it.',
  tiltCanHelp: 'Turn your wrist so the spout points down.',
  pickShearsHelp: 'Move your hand to the shears, then pinch them.',
  touchShootHelp: 'Bring the blade tips right onto the glowing shoot.',
  // "Hold to select" versions (Comfort panel), for players who do not pinch.
  plantSeedDwell: 'Welcome. Look at the seed, or hold your hand by it.',
  pickCanDwell: 'Hold your hand by the can to pick it up.',
  tiltCanDwell: 'Hold the can over the little tree to pour.',
  pickShearsDwell: 'Hold your hand by the shears to pick them up.',
  restDwell: 'Rest here, or look at the stone to breathe.',
  meditateHintDwell: 'Any time, look at the glowing stone to breathe.',
  meditatePausedDwell: 'Paused. Look at the stone to continue.',
  putBack: 'Lower the tool to the table to let it go.',
  comfortHint: 'No pinch? Poke Comfort, then Hold to select.',
} as const;
export type LineId = keyof typeof LINES;

/** A task line replaced by a clearer one once the player has been on it a while. */
const HELP: Partial<Record<LineId, LineId>> = {
  plantSeed: 'plantSeedHelp',
  pickCan: 'pickCanHelp',
  tiltCan: 'tiltCanHelp',
  pickShears: 'pickShearsHelp',
  touchShoot: 'touchShootHelp',
};
/** Lines that mention pinching, and what to say instead with "hold to select" on. */
const DWELL: Partial<Record<LineId, LineId>> = {
  plantSeed: 'plantSeedDwell',
  plantSeedHelp: 'plantSeedDwell',
  pickCan: 'pickCanDwell',
  pickCanHelp: 'pickCanDwell',
  tiltCan: 'tiltCanDwell',
  tiltCanHelp: 'tiltCanDwell',
  moveSpout: 'tiltCanDwell',
  pickShears: 'pickShearsDwell',
  pickShearsHelp: 'pickShearsDwell',
  rest: 'restDwell',
  meditateHint: 'meditateHintDwell',
  meditatePaused: 'meditatePausedDwell',
};
/** Seconds on the same task before the clearer help line appears. */
const STUCK_SECONDS = 15;
/** Still not planted after this long: point out the hands-free option. */
const COMFORT_HINT_SECONDS = 30;
/** Seconds before the ghost pinch appears, so players who already know just act. */
const PINCH_HINT_DELAY = 1.5;

const CUE_LINES: Record<Exclude<MeditationCue, null>, LineId> = {
  intro: 'breatheIntro',
  in: 'breatheIn',
  hold: 'breatheHold',
  out: 'breatheOut',
  soften: 'breatheSoften',
  notice: 'breatheNotice',
  paused: 'meditatePaused',
  done: 'meditateDone',
};

/** How long a one-off event line stays before the next task line returns. */
/** The firefly never strays further than this from the line of sight. */
const GAZE_CONE = (35 * Math.PI) / 180;
const GAZE_COS = Math.cos(GAZE_CONE);
const GAZE_SIN = Math.sin(GAZE_CONE);
/** A hand this close to the head (metres) is being tracked and can be followed. */
const HAND_MIN = 0.12;
const HAND_MAX = 0.9;

const EVENT_SECONDS = 3;
const SNIP_SECONDS = 1.6;

/**
 * Tutorial and guidance. Each frame it reads the garden state, picks the one
 * line and target that matter now, flies the firefly there and updates the
 * subtitle. One-off moments (planted, grew, snip) briefly take priority.
 */
export class GuideSystem extends createSystem({
  guide: { required: [FireflyGuide] },
  bonsai: { required: [Bonsai] },
  seeds: { required: [Seed] },
  seedPinched: { required: [Seed, Grabbed] },
  cans: { required: [WateringCan] },
  heldCans: { required: [WateringCan, Grabbed] },
  assistedCans: { required: [WateringCan, AssistHeld] },
  shears: { required: [PruningShears] },
  heldShears: { required: [PruningShears, Grabbed] },
  assistedShears: { required: [PruningShears, AssistHeld] },
  orbs: { required: [BreathOrb] },
  stones: { required: [MeditationStone] },
}) {
  /** The task line chosen this frame (an event line may be showing instead; see shownLine). */
  line: LineId = 'plantSeed';
  /** The task the player is on (the line before any help swap). */
  task: LineId = 'plantSeed';
  /** Seconds spent on the current task while in view (not while away). */
  taskTime = 0;
  private lastTask: LineId | null = null;
  private away = false;
  private hint!: GestureHint;
  private hintKind: GestureKind | null = null;
  private hintAt = new Vector3();
  /** The line on screen right now (task or event); the voice speaks this. */
  shownLine: LineId = 'plantSeed';
  private shownText = '';
  private subtitle: UIKit.Text | null = null;
  private panel: Object3D | null = null;
  private event: LineId | null = null;
  private eventLeft = 0;
  private lastStage = -1;
  private lastCuts = 0;
  private flash = 0;
  private time = 0;
  private mood: Mood = 'welcome';
  private color = new Color('#ffd76a');
  private mats: MeshBasicMaterial[] = [];
  private target = new Vector3();
  private head = new Vector3();
  private tmp = new Vector3();
  private headQuat = new Quaternion();
  private forward = new Vector3();
  private toward = new Vector3();
  private side = new Vector3();
  private watering?: WateringSystem;
  private pruning?: PruningSystem;
  private grab?: GrabSystem;
  private meditation?: MeditationSystem;
  private hintShown = false;
  private guideRef!: FirstEntity;
  private bonsaiRef!: FirstEntity;
  private seedRef!: FirstEntity;
  private canRef!: FirstEntity;
  private shearsRef!: FirstEntity;
  private orbRef!: FirstEntity;
  private stoneRef!: FirstEntity;
  private greeted = false;
  private persistence?: PersistenceSystem;
  private entrance?: EntranceSystem;
  private comfort?: ComfortSystem;

  init(): void {
    this.watering = this.world.getSystem(WateringSystem);
    this.pruning = this.world.getSystem(PruningSystem);
    this.grab = this.world.getSystem(GrabSystem);
    this.guideRef = trackFirst(this.queries.guide, this.cleanupFuncs);
    this.bonsaiRef = trackFirst(this.queries.bonsai, this.cleanupFuncs);
    this.seedRef = trackFirst(this.queries.seeds, this.cleanupFuncs);
    this.canRef = trackFirst(this.queries.cans, this.cleanupFuncs);
    this.shearsRef = trackFirst(this.queries.shears, this.cleanupFuncs);
    this.orbRef = trackFirst(this.queries.orbs, this.cleanupFuncs);
    this.stoneRef = trackFirst(this.queries.stones, this.cleanupFuncs);
    this.meditation = this.world.getSystem(MeditationSystem);
    this.persistence = this.world.getSystem(PersistenceSystem);
    this.entrance = this.world.getSystem(EntranceSystem);
    this.comfort = this.world.getSystem(ComfortSystem);

    const panel = this.world.getSceneObject<UIKitMLAsset>('subtitle-panel');
    this.panel = panel ?? null;
    this.subtitle = panel?.getElementById<UIKit.Text>('subtitle') ?? null;
    if (this.subtitle) this.subtitle.name = 'subtitle';

    const bindGuide = (e: Entity) => {
      // Own the glow materials so recolouring never leaks into the asset prototype.
      e.object3D?.traverse((o) => {
        const mesh = o as unknown as { isMesh?: boolean; material: MeshBasicMaterial };
        if (!mesh.isMesh) return;
        mesh.material = mesh.material.clone();
        this.mats.push(mesh.material);
      });
    };
    const plant = (seed: Entity) => this.plantSeed(seed);
    this.hint = new GestureHint();
    this.world.createTransformEntity(this.hint.root);
    this.cleanupFuncs.push(
      this.queries.guide.subscribe('qualify', bindGuide),
      this.queries.seedPinched.subscribe('qualify', plant),
      this.world.visibilityState.subscribe((state) => {
        // Headset off, system menu or exit: on return, reorient the player once.
        if (state !== VisibilityState.Visible) {
          if (this.greeted) this.away = true;
          return;
        }
        if (!this.away) return;
        this.away = false;
        this.taskTime = 0;
        if (!this.meditation?.active) this.showEvent('resumed', EVENT_SECONDS);
      }),
    );
    for (const e of this.queries.guide.entities) bindGuide(e);
  }

  update(delta: number): void {
    this.time += delta;
    this.player.head.getWorldPosition(this.head);
    this.disposePlantedSeeds();

    const bonsai = this.bonsaiRef.entity;
    if (!bonsai) return;
    this.watchEvents(bonsai);

    // Greet in VR once the lights have warmed up (at page load it would expire unseen).
    const inVR = this.world.visibilityState.peek() === VisibilityState.Visible;
    if (!this.greeted && inVR && (this.entrance?.lit ?? true)) {
      this.greeted = true;
      const p = this.persistence;
      if (p?.newFlowerThisVisit) this.showEvent('welcomeGift', EVENT_SECONDS + 1);
      else if (p?.returning) this.showEvent('welcomeBack', EVENT_SECONDS + 1);
    }
    if (this.eventLeft > 0) this.eventLeft -= delta;
    // After the first growth event, point out the stone once, straight after
    // the event line so no task line flashes (and gets half-spoken) in between.
    if (this.greeted && !this.hintShown && this.lastStage >= BonsaiStage.Young && this.eventLeft <= 0) {
      this.hintShown = true;
      // Only for players who have never tried the stone.
      if (!this.meditation?.active && !this.persistence?.hasMeditated) {
        this.showEvent('meditateHint', EVENT_SECONDS + 1);
      }
    }
    const cue = this.meditation?.cue ?? null;
    let mood: Mood;
    if (cue) {
      // A breathing session owns the voice and the firefly until it ends.
      mood = 'calm';
      this.eventLeft = 0;
      this.line = CUE_LINES[cue];
      this.lastTask = null;
      this.targetNextToOrb();
      this.setLine(this.line);
    } else {
      mood = this.chooseTask(bonsai);
      this.trackTask(inVR ? delta : 0);
      this.setLine(this.eventLeft > 0 && this.event ? this.event : this.line);
    }
    this.moveFirefly(delta, mood);
    this.updateHint(delta, cue !== null);
    this.billboardPanel();
  }

  /** Plants the seed: on a pinch, or a hands-free selection. */
  plantSeed(seed: Entity): void {
    if (seed.object3D?.visible === false) return;
    for (const b of this.queries.bonsai.entities) b.setValue(Bonsai, 'planted', true);
    this.grab?.forceRelease(seed);
    if (seed.object3D) seed.object3D.visible = false;
    this.showEvent('planted', EVENT_SECONDS);
  }

  /** Times the current task and swaps in its clearer help line once the player seems stuck. */
  private trackTask(delta: number): void {
    if (this.task !== this.lastTask) {
      this.lastTask = this.task;
      this.taskTime = 0;
    } else this.taskTime += delta;
    const help = HELP[this.task];
    this.line = help && this.taskTime >= STUCK_SECONDS ? help : this.task;
    // A player who cannot pinch never plants the seed: show them the Comfort panel.
    if (this.task === 'plantSeed' && this.taskTime >= COMFORT_HINT_SECONDS && !this.comfort?.settings.dwell) {
      this.line = 'comfortHint';
      const opener = this.comfort?.openerObject;
      if (opener) this.targetOf(opener, 0.02);
    }
  }

  /** Acts out the gesture for the current task in light, next to its object. */
  private updateHint(delta: number, inSession: boolean): void {
    let kind: GestureKind | null = null;
    let obj: Object3D | undefined;
    let lift = 0.05;
    if (!inSession && !(this.eventLeft > 0)) {
      switch (this.task) {
        case 'plantSeed':
          obj = this.seedRef.entity?.object3D;
          kind = 'pinch';
          break;
        case 'pickCan':
          obj = this.canRef.entity?.object3D;
          kind = 'pinch';
          lift = 0.13;
          break;
        case 'pickShears':
          obj = this.shearsRef.entity?.object3D;
          kind = 'pinch';
          break;
        case 'tiltCan':
          obj = this.canRef.entity?.object3D;
          kind = 'tilt';
          lift = 0.14;
          break;
        case 'rest':
          // Until the player has tried it, show how to start breathing.
          if (!this.persistence?.hasMeditated) {
            obj = this.stoneRef.entity?.object3D;
            kind = 'pinch';
            lift = 0.07;
          }
          break;
      }
      if (kind === 'pinch' && this.taskTime < PINCH_HINT_DELAY) kind = null;
      // Hands-free players neither pinch nor tilt: the dwell ring guides them instead.
      if (this.comfort?.settings.dwell) kind = null;
    }
    if (kind && obj) {
      obj.getWorldPosition(this.hintAt);
      this.hintAt.y += lift;
    } else kind = null;
    // Brighter once the player seems stuck.
    const strength = this.taskTime >= STUCK_SECONDS ? 1 : 0.75;
    this.hint.update(delta, kind, this.hintAt, this.head, this.color, strength);
    this.hintKind = kind;
  }

  /** The gesture hint showing now (null when none): read by tests and tooling. */
  get gestureHint(): GestureKind | null {
    return this.hintKind;
  }

  private showEvent(id: LineId, seconds: number): void {
    this.event = id;
    this.eventLeft = seconds;
  }

  private watchEvents(bonsai: Entity): void {
    const stage = bonsai.getValue(Bonsai, 'stage') ?? 0;
    if (this.lastStage >= 0 && stage !== this.lastStage) {
      if (stage === BonsaiStage.Young) this.showEvent('grewYoung', EVENT_SECONDS + 1);
      if (stage === BonsaiStage.Mature) this.showEvent('grewMature', EVENT_SECONDS);
      if (stage === BonsaiStage.Blooming) this.showEvent('bloomed', EVENT_SECONDS + 2);
    }
    this.lastStage = stage;
    const cuts = this.pruning?.cuts ?? 0;
    if (cuts !== this.lastCuts && this.eventLeft <= 0) this.showEvent('snip', SNIP_SECONDS);
    this.lastCuts = cuts;
  }

  /** Sets this.line and this.target for the one thing to do next; returns the mood. */
  private chooseTask(bonsai: Entity): Mood {
    const bonsaiObj = bonsai.object3D;
    if (!bonsai.getValue(Bonsai, 'planted')) {
      this.task = 'plantSeed';
      this.targetOf(this.seedRef.entity?.object3D, 0);
      return 'welcome';
    }
    const stage = bonsai.getValue(Bonsai, 'stage') ?? 0;
    const canHandsFree = this.queries.assistedCans.entities.size > 0;
    const shearsHandsFree = this.queries.assistedShears.entities.size > 0;
    if (stage >= BonsaiStage.Blooming) {
      if (canHandsFree || shearsHandsFree) {
        this.task = 'putBack';
        this.targetOf((canHandsFree ? this.canRef : this.shearsRef).entity?.object3D, 0.12);
        return 'bloom';
      }
      this.task = 'rest';
      // Nothing left to do: the firefly keeps the player company at their hand.
      if (!this.targetHand()) this.targetOf(bonsaiObj, 0.3);
      return 'bloom';
    }

    const shoots = SHOOTS_BY_STAGE[stage] ?? [];
    const mask = bonsai.getValue(Bonsai, 'prunedMask') ?? 0;
    let nextShoot = -1;
    for (let i = 0; i < shoots.length && nextShoot < 0; i++) {
      if ((mask & (1 << i)) === 0) nextShoot = i;
    }
    if (nextShoot >= 0) {
      if (canHandsFree) {
        this.task = 'putBack';
        this.targetOf(this.canRef.entity?.object3D, 0.12);
      } else if (this.queries.heldShears.entities.size === 0 && !shearsHandsFree) {
        this.task = 'pickShears';
        this.targetOf(this.shearsRef.entity?.object3D, 0.02);
      } else {
        this.task = 'touchShoot';
        this.targetOf(bonsaiObj?.getObjectByName(shoots[nextShoot])?.getObjectByName('CutPoint'), -0.05);
      }
      return 'prune';
    }

    if (shearsHandsFree) {
      this.task = 'putBack';
      this.targetOf(this.shearsRef.entity?.object3D, 0.05);
    } else if (this.queries.heldCans.entities.size === 0 && !canHandsFree) {
      this.task = 'pickCan';
      this.targetOf(this.canRef.entity?.object3D, 0.12);
    } else if (this.watering?.wateringBonsai) {
      this.task = 'pouring';
      this.targetOf(bonsaiObj, 0.18);
    } else {
      this.task = this.watering?.pouring ? 'moveSpout' : 'tiltCan';
      this.targetOf(bonsaiObj, 0.18);
    }
    return 'water';
  }

  /** Hover beside the breathing orb, level with it, so both stay in view. */
  private targetNextToOrb(): void {
    const orb = this.orbRef.entity?.object3D;
    if (!orb) return;
    orb.getWorldPosition(this.target);
    this.target.x += 0.14;
    this.target.y -= this.guideRef.entity?.getValue(FireflyGuide, 'hoverHeight') ?? 0.1;
  }

  /** Targets a tracked hand (right first); false when neither is tracked. */
  private targetHand(): boolean {
    // In one-hand mode the firefly follows only the hand in use.
    const c = this.comfort;
    return (
      ((c?.usesHand('right') ?? true) && this.targetSpace(this.player.gripSpaces.right)) ||
      ((c?.usesHand('left') ?? true) && this.targetSpace(this.player.gripSpaces.left))
    );
  }

  private targetSpace(space: Object3D | undefined): boolean {
    if (!space) return false;
    space.getWorldPosition(this.toward);
    const d = this.toward.distanceTo(this.head);
    if (d < HAND_MIN || d > HAND_MAX) return false;
    this.target.copy(this.toward);
    this.target.y -= 0.02;
    return true;
  }

  /** Keeps a world point inside the gaze cone, at the same distance from the head. */
  private keepInView(point: Vector3): void {
    this.player.head.getWorldQuaternion(this.headQuat);
    this.forward.set(0, 0, -1).applyQuaternion(this.headQuat);
    this.toward.subVectors(point, this.head);
    const dist = this.toward.length();
    if (dist < 1e-4) return;
    this.toward.divideScalar(dist);
    const cos = this.toward.dot(this.forward);
    if (cos >= GAZE_COS) return;
    this.side.copy(this.toward).addScaledVector(this.forward, -cos);
    if (this.side.lengthSq() < 1e-8) return; // straight behind: leave it
    this.side.normalize();
    point
      .copy(this.head)
      .addScaledVector(this.forward, GAZE_COS * dist)
      .addScaledVector(this.side, GAZE_SIN * dist);
  }

  /** Target = object's world position raised by `lift` metres (plus hover height). */
  private targetOf(obj: Object3D | undefined, lift: number): void {
    if (!obj) return;
    obj.getWorldPosition(this.target);
    this.target.y += lift;
  }

  private setLine(lineId: LineId): void {
    const id = (this.comfort?.settings.dwell && DWELL[lineId]) || lineId;
    const text = LINES[id];
    if (text === this.shownText) return;
    this.shownText = text;
    this.shownLine = id;
    this.flash = 1;
    this.subtitle?.setProperties({ text });
  }

  private moveFirefly(delta: number, mood: Mood): void {
    const guide = this.guideRef.entity;
    const obj = guide?.object3D;
    if (!guide || !obj) return;
    const hover = guide.getValue(FireflyGuide, 'hoverHeight') ?? 0.1;
    const t = this.time;
    // Gentle figure-of-eight drift around the hover point.
    this.tmp.set(
      this.target.x + Math.sin(t * 0.9) * 0.025,
      this.target.y + hover + Math.sin(t * 1.7) * 0.015,
      this.target.z + Math.sin(t * 0.9 * 2) * 0.012,
    );
    // Follow the gaze: wait at the edge of view and lead the eye to the task.
    this.keepInView(this.tmp);
    const parent = obj.parent;
    if (parent) parent.worldToLocal(this.tmp);
    obj.position.lerp(this.tmp, 1 - Math.exp(-2.2 * delta));

    if (mood !== this.mood) {
      this.mood = mood;
      this.flash = 1;
    }
    this.color.lerp(MOOD[mood], 1 - Math.exp(-3 * delta));
    this.flash = Math.max(0, this.flash - delta * 1.5);
    // In a breathing session the firefly swells with the breath and dims when paused.
    const med = this.meditation;
    const pulse =
      med?.active && mood === 'calm'
        ? (med.paused ? 0.7 : 0.85 + 0.4 * med.fullness) + 0.15 * this.flash
        : 1 + 0.12 * Math.sin(t * 3) + 0.25 * this.flash;
    obj.scale.setScalar(pulse);
    for (let i = 1; i < this.mats.length; i++) this.mats[i].color.copy(this.color);
  }

  /** Yaw the subtitle panel toward the viewer so it never shows its back. */
  private billboardPanel(): void {
    const p = this.panel;
    if (!p) return;
    p.getWorldPosition(this.tmp);
    p.rotation.y = Math.atan2(this.head.x - this.tmp.x, this.head.z - this.tmp.z);
  }

  private disposePlantedSeeds(): void {
    for (const seed of this.queries.seeds.entities) {
      if (seed.object3D?.visible === false && !seed.hasComponent(Grabbed)) {
        seed.dispose();
      }
    }
  }
}
