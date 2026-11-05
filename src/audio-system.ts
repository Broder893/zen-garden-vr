import { createSystem, VisibilityState } from '@iwsdk/core';
import { GardenMusic } from './audio/garden-music.js';
import { trackFirst, FirstEntity } from './ecs-utils.js';
import { SoundEngine } from './audio/sound-engine.js';
import { GuideVoice } from './audio/voice.js';
import { Bonsai, BonsaiStage } from './garden-components.js';
import { GuideSystem, LINES, LineId } from './guide.js';
import { MeditationPhase, MeditationSystem } from './meditation.js';
import { PruningSystem } from './pruning.js';
import { WateringSystem } from './watering.js';

/** Lines are spoken again only after this long, so task hints never nag. */
const REPEAT_SECONDS = 14;
/** Breathing cues are timed by the session, so they are always spoken. */
const ALWAYS_SPOKEN = new Set<LineId>([
  'breatheIntro', 'breatheIn', 'breatheHold', 'breatheOut',
  'breatheSoften', 'breatheNotice', 'meditatePaused', 'meditatePausedDwell', 'meditateDone',
]);
const SCALE = GardenMusic.scale;
const PLANT_NOTES = [SCALE[0], SCALE[2], SCALE[4]];
const GROW_NOTES = [SCALE[0], SCALE[1], SCALE[2], SCALE[3], SCALE[4]];
const BLOOM_NOTES = [SCALE[0], SCALE[2], SCALE[3], SCALE[4], SCALE[5], SCALE[7]];
/** Singing bowls: G3 opens a breathing session, a deeper D3 closes it. */
const BOWL_OPEN_HZ = 196;
const BOWL_CLOSE_HZ = 147;

const log = import.meta.env.DEV
  ? (msg: string) => console.info(`[audio] ${msg}`)
  : () => {};

/**
 * Listens to the garden and makes it sound: generative music, water, shears,
 * growth chimes, singing bowls for meditation and the spoken guide.
 * It only observes other systems; nothing depends on it.
 */
export class GardenAudioSystem extends createSystem({
  bonsai: { required: [Bonsai] },
}) {
  private engine!: SoundEngine;
  private music!: GardenMusic;
  private voice!: GuideVoice;
  private guide?: GuideSystem;
  private watering?: WateringSystem;
  private pruning?: PruningSystem;
  private meditation?: MeditationSystem;
  private spokenAt = new Map<LineId, number>();
  private lastLine: LineId | null = null;
  private bonsai!: FirstEntity;
  // Last seen garden state; null until the first frame so restored saves stay silent.
  private lastCuts: number | null = null;
  private lastStage: number | null = null;
  private lastPlanted: boolean | null = null;
  private lastPhase: MeditationPhase = 'idle';
  private lastPaused = false;
  private dripIn = 0;
  private time = 0;
  private wasRunning = false;

  init(): void {
    this.engine = new SoundEngine();
    this.music = new GardenMusic(this.engine);
    this.voice = new GuideVoice();
    this.guide = this.world.getSystem(GuideSystem);
    this.watering = this.world.getSystem(WateringSystem);
    this.pruning = this.world.getSystem(PruningSystem);
    this.meditation = this.world.getSystem(MeditationSystem);

    // Browsers only start audio after a user gesture; the Enter VR click counts.
    const unlock = () => this.engine.unlock();
    for (const type of ['pointerdown', 'keydown', 'touchend'] as const) {
      window.addEventListener(type, unlock);
      this.cleanupFuncs.push(() => window.removeEventListener(type, unlock));
    }
    this.bonsai = trackFirst(this.queries.bonsai, this.cleanupFuncs);

    const xr = this.renderer.xr;
    xr.addEventListener('sessionstart', unlock);
    this.cleanupFuncs.push(
      () => xr.removeEventListener('sessionstart', unlock),
      this.world.visibilityState.subscribe((state) => {
        // Headset off or system menu open: silence everything until back.
        if (state === VisibilityState.Hidden || state === VisibilityState.VisibleBlurred) {
          this.voice.stop();
          this.engine.suspend();
        } else this.engine.unlock();
      }),
      () => this.voice.dispose(),
    );
    log(`context ${this.engine.ctx?.state ?? 'unavailable'}, voice ${this.voice.available}`);
    if (import.meta.env.DEV) {
      // Dev only: lets .iwsdk-scripts/record.mjs capture the picture and the app's sound.
      (window as unknown as { __zenDev?: unknown }).__zenDev = {
        ctx: this.engine.ctx,
        master: this.engine.master,
        renderer: this.renderer,
      };
    }
  }

  update(delta: number): void {
    this.time += delta;
    const running = this.engine.running;
    if (running && !this.wasRunning) {
      log('context running');
      this.music.start();
    }
    this.wasRunning = running;

    const med = this.meditation;
    this.music.tick(delta, med?.active ?? false, med?.fullness ?? 0);
    this.waterSounds(delta);
    this.gardenEvents();
    this.meditationEvents();
    this.speak();
  }

  private waterSounds(delta: number): void {
    const w = this.watering;
    this.engine.setPour(w?.pouring ? 1 : 0);
    if (!w?.wateringBonsai) return;
    this.dripIn -= delta;
    if (this.dripIn > 0) return;
    this.dripIn = 0.18 + Math.random() * 0.25;
    this.engine.drip();
  }

  private gardenEvents(): void {
    const cuts = this.pruning?.cuts ?? 0;
    if (this.lastCuts !== null && cuts > this.lastCuts) {
      this.engine.snip();
      log('snip');
    }
    this.lastCuts = cuts;

    const bonsai = this.bonsai.entity;
    if (!bonsai) return;
    const planted = bonsai.getValue(Bonsai, 'planted') ?? false;
    if (planted && this.lastPlanted === false) {
      this.engine.arpeggio(PLANT_NOTES);
      log('planted');
    }
    this.lastPlanted = planted;
    const stage = bonsai.getValue(Bonsai, 'stage') ?? 0;
    if (this.lastStage !== null && stage > this.lastStage) {
      this.engine.arpeggio(stage === BonsaiStage.Blooming ? BLOOM_NOTES : GROW_NOTES);
      log(`grew to stage ${stage}`);
    }
    this.lastStage = stage;
  }

  private meditationEvents(): void {
    const med = this.meditation;
    if (!med) return;
    const phase = med.phase;
    if (phase !== this.lastPhase) {
      if (phase === 'intro') this.engine.bowl(BOWL_OPEN_HZ);
      if (phase === 'outro') this.engine.bowl(BOWL_CLOSE_HZ, 0.26);
      if (phase === 'in' || phase === 'out') {
        this.engine.musicChime(phase === 'in' ? SCALE[2] : SCALE[0], 0.04);
      }
      if (phase === 'intro' || phase === 'outro') log(`meditation ${phase}`);
    }
    this.lastPhase = phase;
    if (med.paused !== this.lastPaused && med.paused) this.voice.stop();
    this.lastPaused = med.paused;
  }

  private speak(): void {
    // Until audio is unlocked nothing is marked spoken, so the line on screen
    // at that moment is the first thing the guide says.
    const line = this.guide?.shownLine;
    if (!line || line === this.lastLine || !this.engine.running) return;
    this.lastLine = line;
    // A soft high chime announces a breathing break before the words.
    if (line === 'breakInvite') this.engine.musicChime(SCALE[4], 0.05);
    const last = this.spokenAt.get(line);
    if (!ALWAYS_SPOKEN.has(line) && last !== undefined && this.time - last < REPEAT_SECONDS) return;
    this.spokenAt.set(line, this.time);
    this.voice.say(LINES[line]);
    log(`say ${line}`);
  }
}
