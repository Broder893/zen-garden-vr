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
  Bonsai,
  BonsaiStage,
  BreathOrb,
  FireflyGuide,
  PruningShears,
  Seed,
  WateringCan,
} from './garden-components.js';
import { MeditationCue, MeditationSystem } from './meditation.js';
import { PersistenceSystem } from './persistence.js';
import { PruningSystem } from './pruning.js';
import { EntranceSystem } from './entrance.js';
import { WateringSystem } from './watering.js';

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
} as const;
export type LineId = keyof typeof LINES;

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
  shears: { required: [PruningShears] },
  heldShears: { required: [PruningShears, Grabbed] },
  orbs: { required: [BreathOrb] },
}) {
  /** The task line chosen this frame (an event line may be showing instead; see shownLine). */
  line: LineId = 'plantSeed';
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
  private greeted = false;
  private persistence?: PersistenceSystem;
  private entrance?: EntranceSystem;

  init(): void {
    this.watering = this.world.getSystem(WateringSystem);
    this.pruning = this.world.getSystem(PruningSystem);
    this.grab = this.world.getSystem(GrabSystem);
    this.meditation = this.world.getSystem(MeditationSystem);
    this.persistence = this.world.getSystem(PersistenceSystem);
    this.entrance = this.world.getSystem(EntranceSystem);

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
    const plant = (seed: Entity) => {
      for (const b of this.queries.bonsai.entities) b.setValue(Bonsai, 'planted', true);
      this.grab?.forceRelease(seed);
      if (seed.object3D) seed.object3D.visible = false;
      this.showEvent('planted', EVENT_SECONDS);
    };
    this.cleanupFuncs.push(
      this.queries.guide.subscribe('qualify', bindGuide),
      this.queries.seedPinched.subscribe('qualify', plant),
    );
    for (const e of this.queries.guide.entities) bindGuide(e);
  }

  update(delta: number): void {
    this.time += delta;
    this.player.head.getWorldPosition(this.head);
    this.disposePlantedSeeds();

    const bonsai = this.first(this.queries.bonsai.entities);
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
      this.targetNextToOrb();
      this.setLine(this.line);
    } else {
      mood = this.chooseTask(bonsai);
      this.setLine(this.eventLeft > 0 && this.event ? this.event : this.line);
    }
    this.moveFirefly(delta, mood);
    this.billboardPanel();
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
      this.line = 'plantSeed';
      this.targetOf(this.first(this.queries.seeds.entities)?.object3D, 0);
      return 'welcome';
    }
    const stage = bonsai.getValue(Bonsai, 'stage') ?? 0;
    if (stage >= BonsaiStage.Blooming) {
      this.line = 'rest';
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
      if (this.queries.heldShears.entities.size === 0) {
        this.line = 'pickShears';
        this.targetOf(this.first(this.queries.shears.entities)?.object3D, 0.02);
      } else {
        this.line = 'touchShoot';
        this.targetOf(bonsaiObj?.getObjectByName(shoots[nextShoot])?.getObjectByName('CutPoint'), -0.05);
      }
      return 'prune';
    }

    if (this.queries.heldCans.entities.size === 0) {
      this.line = 'pickCan';
      this.targetOf(this.first(this.queries.cans.entities)?.object3D, 0.12);
    } else if (this.watering?.wateringBonsai) {
      this.line = 'pouring';
      this.targetOf(bonsaiObj, 0.18);
    } else {
      this.line = this.watering?.pouring ? 'moveSpout' : 'tiltCan';
      this.targetOf(bonsaiObj, 0.18);
    }
    return 'water';
  }

  /** Hover beside the breathing orb, level with it, so both stay in view. */
  private targetNextToOrb(): void {
    const orb = this.first(this.queries.orbs.entities)?.object3D;
    if (!orb) return;
    orb.getWorldPosition(this.target);
    this.target.x += 0.14;
    this.target.y -= this.first(this.queries.guide.entities)?.getValue(FireflyGuide, 'hoverHeight') ?? 0.1;
  }

  /** Targets a tracked hand (right first); false when neither is tracked. */
  private targetHand(): boolean {
    for (const space of [this.player.gripSpaces.right, this.player.gripSpaces.left]) {
      if (!space) continue;
      space.getWorldPosition(this.toward);
      const d = this.toward.distanceTo(this.head);
      if (d < HAND_MIN || d > HAND_MAX) continue;
      this.target.copy(this.toward);
      this.target.y -= 0.02;
      return true;
    }
    return false;
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

  private setLine(id: LineId): void {
    const text = LINES[id];
    if (text === this.shownText) return;
    this.shownText = text;
    this.shownLine = id;
    this.flash = 1;
    this.subtitle?.setProperties({ text });
  }

  private moveFirefly(delta: number, mood: Mood): void {
    const guide = this.first(this.queries.guide.entities);
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

  private first(set: Set<Entity>): Entity | undefined {
    for (const e of set) return e;
    return undefined;
  }
}
