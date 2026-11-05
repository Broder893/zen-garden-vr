import { createSystem, VisibilityState } from '@iwsdk/core';
import { trackFirst, FirstEntity } from './ecs-utils.js';
import { Bonsai } from './garden-components.js';
import { MeditationSystem } from './meditation.js';

/** The rewarding moments of a first visit, in the order they usually happen. */
export type Moment = 'planted' | 'firstGrowth' | 'mature' | 'bloom' | 'firstBreath';

/**
 * A stopwatch for the "first five minutes": seconds in VR from entering the
 * garden to each satisfying moment. Only time spent in view counts, so
 * taking the headset off does not inflate it. Logged in development, and
 * readable by tooling through `times`.
 */
export class FirstMomentsSystem extends createSystem({
  bonsai: { required: [Bonsai] },
}) {
  /** Seconds in VR when each moment first happened this session. */
  readonly times: Partial<Record<Moment, number>> = {};
  /** Seconds spent in VR so far this session. */
  clock = 0;
  private started = false;
  private bonsai!: FirstEntity;
  private meditation?: MeditationSystem;
  private startStage = -1;
  private startPlanted = false;

  init(): void {
    this.bonsai = trackFirst(this.queries.bonsai, this.cleanupFuncs);
    this.meditation = this.world.getSystem(MeditationSystem);
  }

  update(delta: number): void {
    if (this.world.visibilityState.peek() !== VisibilityState.Visible) return;
    const b = this.bonsai.entity;
    if (!b) return;
    const planted = b.getValue(Bonsai, 'planted') ?? false;
    const stage = b.getValue(Bonsai, 'stage') ?? 0;
    if (!this.started) {
      // Moments already reached on an earlier visit are not this visit's rewards.
      this.started = true;
      this.startPlanted = planted;
      this.startStage = planted ? stage : -1;
    }
    this.clock += delta;
    if (planted && !this.startPlanted) this.mark('planted');
    if (stage > this.startStage && planted) {
      if (stage >= 1 && this.startStage < 1) this.mark('firstGrowth');
      if (stage >= 2 && this.startStage < 2) this.mark('mature');
      if (stage >= 3 && this.startStage < 3) this.mark('bloom');
    }
    if ((this.meditation?.phase ?? 'idle') === 'in') this.mark('firstBreath');
  }

  private mark(moment: Moment): void {
    if (this.times[moment] !== undefined) return;
    this.times[moment] = Math.round(this.clock * 10) / 10;
    if (import.meta.env.DEV) console.info(`[first-moments] ${moment} at ${this.times[moment]} s`);
  }
}
