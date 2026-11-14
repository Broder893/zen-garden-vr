import { createSystem, Object3D, VisibilityState } from '@iwsdk/core';
import { ComfortSystem } from './comfort.js';
import { trackFirst, FirstEntity } from './ecs-utils.js';
import { FirstMomentsSystem } from './first-moments.js';
import { Bonsai, BonsaiStage } from './garden-components.js';
import { GuideSystem } from './guide.js';
import { MeditationSystem } from './meditation.js';
import { PersistenceSystem } from './persistence.js';

/** One breath: in, then out (seconds); the lines show this long. */
const IN_SECONDS = 4;
const OUT_SECONDS = 5;
/** The young tree swells this much with the breath (less with Gentle transitions). */
const SWELL = 0.07;
const SWELL_GENTLE = 0.035;

/**
 * The first visit's first breath, early: right after the first growth the
 * firefly says "Breathe in with your sprout..." and "And breathe out...", and
 * the young tree swells and settles with that one breath. No eyelids, no
 * session: tools stay in hand and care goes on. The usual breathing breaks
 * are unchanged.
 */
export class SproutBreathSystem extends createSystem({
  bonsai: { required: [Bonsai] },
}) {
  /** 'wait' for the first growth, 'queued', then the breath, then 'done'. */
  state: 'wait' | 'queued' | 'in' | 'out' | 'done' = 'wait';
  private t = 0;
  private tree: Object3D | null = null;
  private bonsai!: FirstEntity;
  private guide?: GuideSystem;
  private persistence?: PersistenceSystem;
  private meditation?: MeditationSystem;
  private comfort?: ComfortSystem;
  private moments?: FirstMomentsSystem;
  private startStage = -2;

  init(): void {
    this.bonsai = trackFirst(this.queries.bonsai, this.cleanupFuncs);
  }

  update(delta: number): void {
    if (this.state === 'done') return;
    if (this.world.visibilityState.peek() !== VisibilityState.Visible) return;
    const b = this.bonsai.entity;
    if (!b) return;
    this.guide ??= this.world.getSystem(GuideSystem);
    this.persistence ??= this.world.getSystem(PersistenceSystem);
    this.meditation ??= this.world.getSystem(MeditationSystem);
    const planted = b.getValue(Bonsai, 'planted') ?? false;
    const stage = planted ? (b.getValue(Bonsai, 'stage') ?? 0) : -1;
    if (this.startStage === -2) this.startStage = stage;
    // First visit only, and only for a growth seen in this visit.
    if (this.persistence?.returning || this.startStage >= BonsaiStage.Young) return this.finish();
    if (this.state === 'wait') {
      if (stage < BonsaiStage.Young || this.meditation?.active) return;
      this.tree = b.object3D?.getObjectByName('Young') ?? null;
      this.guide?.queueEvent('sproutBreath', IN_SECONDS, b.object3D ?? null);
      this.guide?.queueEvent('breatheOut', OUT_SECONDS, b.object3D ?? null);
      this.state = 'queued';
      return;
    }
    const line = this.guide?.shownLine;
    if (this.state === 'queued') {
      if (line !== 'sproutBreath') return;
      this.state = 'in';
      this.t = 0;
      this.moments ??= this.world.getSystem(FirstMomentsSystem);
      if (this.moments) this.moments.breathShown = true;
    }
    this.t += delta;
    if (this.state === 'in' && line === 'breatheOut') {
      this.state = 'out';
      this.t = 0;
    }
    // Lungs filling (0..1): up with the inhale, down with the exhale, eased.
    const k = this.state === 'in' ? Math.min(1, this.t / IN_SECONDS) : 1 - Math.min(1, this.t / OUT_SECONDS);
    const full = k * k * (3 - 2 * k);
    this.comfort ??= this.world.getSystem(ComfortSystem);
    const swell = this.comfort?.settings.softTransitions ? SWELL_GENTLE : SWELL;
    // Only while the young tree is the one shown (a quick next growth ends it).
    if (stage !== BonsaiStage.Young) return this.finish();
    this.tree?.scale.setScalar(1 + swell * full);
    if (this.state === 'out' && this.t >= OUT_SECONDS) this.finish();
    // Something else took the voice (a line cut it short): end softly.
    if (line !== 'sproutBreath' && line !== 'breatheOut' && this.t > 0.5) this.finish();
  }

  private finish(): void {
    this.state = 'done';
    this.tree?.scale.setScalar(1);
  }
}
