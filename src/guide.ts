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
import { EyelidSystem } from './eyelids.js';
import { MeditationCue, MeditationSystem } from './meditation.js';
import { PersistenceSystem } from './persistence.js';
import { PruningSystem } from './pruning.js';
import { trackFirst, FirstEntity } from './ecs-utils.js';
import { BreathBreakSystem } from './breath-break.js';
import { ComfortSystem } from './comfort.js';
import { HealthSystem } from './health.js';
import { InputModeSystem } from './input-mode.js';
import { SharedTreeSystem } from './shared-tree.js';
import { WeatherSystem } from './weather.js';
import { Health, HealthState } from './save/plant-health.js';
import { levelFor } from './save/growth-levels.js';
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
  rest: 'Rest, rake the sand with your fingers, or pinch the stone.',
  meditateHint: 'Any time, pinch the glowing stone to breathe.',
  breatheIntro: 'Let us breathe together. Follow the light.',
  breatheIntroEyes: 'Close your eyes. Let us breathe together.',
  openEyes: 'Open your eyes.',
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
  restDwell: 'Rest, rake the sand with your fingers, or look at the stone.',
  meditateHintDwell: 'Any time, look at the glowing stone to breathe.',
  meditatePausedDwell: 'Paused. Look at the stone to continue.',
  putBack: 'Lower the tool to the table to let it go.',
  // Gaze care (src/input-mode.ts, src/gaze-care.ts): no tracked hands.
  plantSeedGaze: 'Welcome. Look at the glowing seed to plant it.',
  pickCanGaze: 'Look at the can for a moment: it will water the tree.',
  pickShearsGaze: 'Look at the shears for a moment: they will trim.',
  restGaze: 'Rest, or look at the glowing stone to breathe.',
  watchTool: 'Watch: the tool does the work.',
  handsMissing: 'I cannot see your hands. Look at things to use them.',
  controllersOn: 'Put the controllers down for your hands, or look at things.',
  handsBack: 'There are your hands again.',
  comfortHint: 'No pinch? Poke Comfort, then Hold to select.',
  // Breathing breaks during care (BreathBreakSystem).
  breakInvite: 'Let us pause a moment to breathe together.',
  breakSkip: 'Not now? Show me an open hand.',
  breakLater: 'Of course. We will breathe later.',
  breakDone: 'Lovely. Your tree grew a little with you.',
  // Levels (src/save/growth-levels.ts).
  dailyGift: 'A daily gift: your tree grew stronger overnight.',
  levelUp: 'Your garden reached a new level.',
  // Careful care (src/health.ts): gentle suggestions, never blame.
  tooMuchWater: 'That is plenty of water. Let it rest a moment.',
  letItDrain: 'Too much water. Let the soil drain a little.',
  tenseBreathe: 'Your tree looks tense. Breathe with it at the stone.',
  tenseBreatheDwell: 'Your tree looks tense. Look at the stone to breathe.',
  recovered: 'Your tree is feeling better.',
  wrongCut: 'That branch was healthy. Trim only the glowing shoots.',
  // Weather (src/weather.ts).
  rainStarts: 'A gentle rain. It is watering your tree.',
  breezeStarts: 'A soft breeze. The soil dries, the leaves dance.',
  breakInviteTense: 'Your tree is tense. Let us breathe together.',
  levelPot: 'Level 6! Your tree has a new glazed pot.',
  levelLantern: 'Level 7! A stone lantern now glows by your tree.',
  levelStream: 'Level 8! A little stream runs through the sand.',
  levelBreath: 'Level 9! A new deep breath joins your breaks.',
  // The shared tree (src/shared-tree.ts).
  sharedIntro: 'Every visitor shares that big tree. Water it at the basin.',
  sharedThanks: 'Your water flows to the shared tree.',
  sharedOffline: 'Your water flows to the tree. Others will see it later.',
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
  tenseBreathe: 'tenseBreatheDwell',
};
/** Lines that need hands, and what to say instead when the garden is used by looking. */
const GAZE: Partial<Record<LineId, LineId>> = {
  plantSeed: 'plantSeedGaze',
  plantSeedHelp: 'plantSeedGaze',
  pickCan: 'pickCanGaze',
  pickCanHelp: 'pickCanGaze',
  tiltCan: 'pickCanGaze',
  tiltCanHelp: 'pickCanGaze',
  moveSpout: 'pickCanGaze',
  pickShears: 'pickShearsGaze',
  pickShearsHelp: 'pickShearsGaze',
  touchShoot: 'pickShearsGaze',
  touchShootHelp: 'pickShearsGaze',
  putBack: 'watchTool',
  rest: 'restGaze',
  meditateHint: 'meditateHintDwell',
  meditatePaused: 'meditatePausedDwell',
  tenseBreathe: 'tenseBreatheDwell',
  // An open hand cannot be shown: the invitation simply stands.
  breakSkip: 'breakInvite',
};
const NO_SHOOTS: string[] = [];
/** Excess water above which the firefly asks to wait rather than care. */
const DRAIN_HINT = 0.15;
/** What each level past the bloom brings (src/unlocks.ts shows it). */
const LEVEL_LINES: Record<number, LineId> = { 6: 'levelPot', 7: 'levelLantern', 8: 'levelStream', 9: 'levelBreath' };
/** Levels 1-5 are the tree's stages, announced by their own growth lines. */
const STAGE_LEVELS = 5;
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
  /** Where the firefly goes while the one-off line plays (null: it keeps to the task). */
  private eventTarget: Object3D | null = null;
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
  private lids?: EyelidSystem;
  private hintShown = false;
  private guideRef!: FirstEntity;
  private bonsaiRef!: FirstEntity;
  private seedRef!: FirstEntity;
  private canRef!: FirstEntity;
  private shearsRef!: FirstEntity;
  private orbRef!: FirstEntity;
  private stoneRef!: FirstEntity;
  private greeted = false;
  private giftPending = false;
  private overflowWarned = false;
  private lastWrongCuts = 0;
  private lastHealth: HealthState = Health.Healthy;
  private health?: HealthSystem;
  private lastLevel = -1;
  private persistence?: PersistenceSystem;
  private entrance?: EntranceSystem;
  private comfort?: ComfortSystem;
  private inputMode?: InputModeSystem;
  private inputChanges = 0;
  private breathBreak?: BreathBreakSystem;

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
    this.health = this.world.getSystem(HealthSystem);
    this.breathBreak = this.world.getSystem(BreathBreakSystem);
    this.breathBreak?.attachGuide(this);
    this.world.getSystem(WeatherSystem)?.attachGuide(this);
    this.world.getSystem(SharedTreeSystem)?.attachGuide(this);

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
      // The daily gift is announced right after the welcome.
      this.giftPending = p?.dailyGift ?? false;
    }
    if (this.eventLeft > 0) this.eventLeft -= delta;
    if (this.giftPending && this.eventLeft <= 0) {
      this.giftPending = false;
      this.showEvent('dailyGift', EVENT_SECONDS + 1);
    }
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
    const invite = this.breathBreak?.inviteLine ?? null;
    let mood: Mood;
    if (invite && !cue) {
      // A breathing break is on offer: the firefly comes close, calm, and asks.
      mood = 'calm';
      this.eventLeft = 0;
      this.lastTask = null;
      this.target.copy(this.breathBreak!.invitePoint);
      this.target.y -= this.guideRef.entity?.getValue(FireflyGuide, 'hoverHeight') ?? 0.1;
      this.setLine(invite);
    } else if (cue) {
      // A breathing session owns the voice and the firefly until it ends.
      mood = 'calm';
      this.eventLeft = 0;
      // A break ends with its own line: the tree's reward.
      this.line = cue === 'done' && this.meditation?.kind === 'break' ? 'breakDone' : CUE_LINES[cue];
      // With eyelids: the session closes the eyes after its first words and opens them at its end.
      this.lids ??= this.world.getSystem(EyelidSystem);
      if (this.lids?.enabled) {
        if (cue === 'intro') this.line = 'breatheIntroEyes';
        // From the first frame of the end: the eyes are still closed for the session.
        if (cue === 'done' && (this.lids.sessionEnding || this.lids.reasons.has('session'))) this.line = 'openEyes';
      }
      this.lastTask = null;
      this.targetNextToOrb();
      this.setLine(this.line);
    } else {
      mood = this.chooseTask(bonsai);
      // Only time on the task counts: not while away, nor while a one-off line plays.
      this.trackTask(inVR && this.eventLeft <= 0 ? delta : 0);
      if (this.eventLeft > 0 && this.eventTarget) this.targetOf(this.eventTarget, 0.12);
      this.setLine(this.eventLeft > 0 && this.event ? this.event : this.line);
    }
    this.moveFirefly(delta, mood);
    this.updateHint(delta, cue !== null || invite !== null);
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
    if (this.task === 'plantSeed' && this.taskTime >= COMFORT_HINT_SECONDS && !this.comfort?.settings.dwell && !this.inputMode?.gaze) {
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
        case 'tenseBreathe':
          obj = this.stoneRef.entity?.object3D;
          kind = 'pinch';
          lift = 0.07;
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
      if (this.comfort?.settings.dwell || this.inputMode?.gaze) kind = null;
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

  /** True while a one-off line (planted, grew, welcome...) is showing. */
  get busy(): boolean {
    return this.eventLeft > 0;
  }

  /** Shows a one-off line for `seconds`, then the current task line returns; `target` draws the firefly there meanwhile. */
  showEvent(id: LineId, seconds: number, target: Object3D | null = null): void {
    this.event = id;
    this.eventLeft = seconds;
    this.eventTarget = target;
  }

  private watchEvents(bonsai: Entity): void {
    // Hands gone (tracking off) or controllers picked up: say once how to carry on
    // (after a breathing session, never into it).
    this.inputMode ??= this.world.getSystem(InputModeSystem);
    const changes = this.inputMode?.changes ?? 0;
    if (changes !== this.inputChanges && !this.meditation?.active) {
      this.inputChanges = changes;
      const mode = this.inputMode?.mode;
      this.showEvent(mode === 'none' ? 'handsMissing' : mode === 'controllers' ? 'controllersOn' : 'handsBack', EVENT_SECONDS + 2);
    }
    const stage = bonsai.getValue(Bonsai, 'stage') ?? 0;
    if (this.lastStage >= 0 && stage !== this.lastStage) {
      if (stage === BonsaiStage.Young) this.showEvent('grewYoung', EVENT_SECONDS + 1);
      if (stage === BonsaiStage.Mature) this.showEvent('grewMature', EVENT_SECONDS);
      if (stage === BonsaiStage.Blooming) this.showEvent('bloomed', EVENT_SECONDS + 2);
    }
    this.lastStage = stage;
    // Levels past the bloom (6+) have no stage of their own: announce them here.
    const level = levelFor(bonsai.getValue(Bonsai, 'xp') ?? 0).level;
    if (this.lastLevel >= 0 && level > this.lastLevel && level > STAGE_LEVELS) {
      this.showEvent(LEVEL_LINES[level] ?? 'levelUp', EVENT_SECONDS + 1);
    }
    this.lastLevel = level;
    // Pouring on a full tree: say so once per episode (only once mistakes may show).
    if (this.watering?.overflowing && !this.overflowWarned && this.health?.mistakesShow) {
      this.overflowWarned = true;
      this.showEvent('tooMuchWater', EVENT_SECONDS + 1);
    } else if ((bonsai.getValue(Bonsai, 'overwater') ?? 0) < 0.05) this.overflowWarned = false;
    // Well again: say so (the audio adds a light rising tone).
    const health = this.health?.state ?? Health.Healthy;
    if (health === Health.Healthy && this.lastHealth !== Health.Healthy) this.showEvent('recovered', EVENT_SECONDS);
    this.lastHealth = health;
    // A healthy branch cut: no blame, just what to cut instead (it grows back next visit).
    const wrong = this.pruning?.wrongCuts ?? 0;
    if (wrong !== this.lastWrongCuts) this.showEvent('wrongCut', EVENT_SECONDS + 1);
    this.lastWrongCuts = wrong;
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
    // A tense tree: breathing with it is the way back (and the quickest).
    if ((this.health?.state ?? Health.Healthy) >= Health.Stressed && !this.watering?.overflowing) {
      this.task = 'tenseBreathe';
      this.targetOf(this.stoneRef.entity?.object3D, 0.08);
      return 'calm';
    }
    // Too much water: the one thing to do is wait while the soil drains.
    if ((bonsai.getValue(Bonsai, 'overwater') ?? 0) > DRAIN_HINT && !this.watering?.overflowing) {
      this.task = 'letItDrain';
      this.targetOf(bonsaiObj, 0.2);
      return 'water';
    }
    const stage = bonsai.getValue(Bonsai, 'stage') ?? 0;
    const canHandsFree = this.queries.assistedCans.entities.size > 0;
    const shearsHandsFree = this.queries.assistedShears.entities.size > 0;
    const shoots = SHOOTS_BY_STAGE[stage] ?? NO_SHOOTS;
    const mask = bonsai.getValue(Bonsai, 'prunedMask') ?? 0;
    let nextShoot = -1;
    for (let i = 0; i < shoots.length && nextShoot < 0; i++) {
      if ((mask & (1 << i)) === 0) nextShoot = i;
    }
    // All tended (trimmed and watered): rest. In bloom this is the usual state
    // until the next visit, when the soil dries and shoots grow back.
    if (nextShoot < 0 && (bonsai.getValue(Bonsai, 'water') ?? 0) >= 1) {
      if (canHandsFree || shearsHandsFree) {
        this.task = 'putBack';
        this.targetOf((canHandsFree ? this.canRef : this.shearsRef).entity?.object3D, 0.12);
        return 'bloom';
      }
      this.task = 'rest';
      // Nothing left to do: the firefly keeps the player company at their hand.
      if (!this.targetHand()) this.targetOf(bonsaiObj, 0.3);
      return stage >= BonsaiStage.Blooming ? 'bloom' : 'calm';
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
    const id = this.inputMode?.gaze
      ? GAZE[lineId] ?? DWELL[lineId] ?? lineId
      : (this.comfort?.settings.dwell && DWELL[lineId]) || lineId;
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
