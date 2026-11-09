import { createSystem, VisibilityState } from '@iwsdk/core';

/** What the player is using right now. */
export type InputMode = 'hands' | 'controllers' | 'none';

/** Checks the session's input sources this often (seconds). */
const CHECK_SECONDS = 0.25;
/** A change must hold this long before it counts (a hand briefly out of view is not "no hands"). */
const SWITCH_SECONDS = 2.5;
/** "No input at all" must hold longer: hands resting out of view may drop their sources. */
const NONE_SECONDS = 6;
/** Hands coming back count sooner. */
const HANDS_BACK_SECONDS = 0.75;

/**
 * Watches whether the player has tracked hands, controllers, or neither
 * (hand tracking off and no controllers). Without hands the garden switches to
 * gaze care: looking at a thing for two seconds uses it (DwellSystem for the
 * seed and stone, GazeCareSystem for the can, shears and basin), the firefly
 * says so once, and its lines speak of looking instead of pinching.
 * ?input=controllers|none forces a mode (tests and demos).
 */
export class InputModeSystem extends createSystem({}) {
  mode: InputMode = 'hands';
  /** True while the garden is used by looking (no tracked hands). */
  gaze = false;
  /** Increments on every switch, so the guide can react once. */
  changes = 0;
  private forced?: InputMode;
  private candidate: InputMode = 'hands';
  private candidateTime = 0;
  private sinceCheck = 0;

  init(): void {
    const forced = new URLSearchParams(window.location.search).get('input');
    if (forced === 'hands' || forced === 'controllers' || forced === 'none') this.forced = forced;
  }

  update(delta: number): void {
    if (this.world.visibilityState.peek() !== VisibilityState.Visible) {
      this.candidateTime = 0;
      return;
    }
    this.sinceCheck += delta;
    if (this.sinceCheck < CHECK_SECONDS) return;
    const step = this.sinceCheck;
    this.sinceCheck = 0;
    const seen = this.forced ?? this.seen();
    if (seen === this.mode) {
      this.candidateTime = 0;
      return;
    }
    if (seen !== this.candidate) {
      this.candidate = seen;
      this.candidateTime = 0;
    }
    this.candidateTime += step;
    const needed = seen === 'hands' ? HANDS_BACK_SECONDS : seen === 'none' ? NONE_SECONDS : SWITCH_SECONDS;
    if (this.candidateTime < needed) return;
    this.mode = seen;
    this.gaze = seen !== 'hands';
    this.changes++;
    this.candidateTime = 0;
    console.info(`[zen] input: ${seen}${this.gaze ? ' (gaze care on)' : ''}`);
  }

  /** Hands if any tracked hand is present, else controllers if any, else none. */
  private seen(): InputMode {
    const sources = this.world.renderer.xr.getSession()?.inputSources;
    if (!sources) return this.mode;
    let controllers = 0;
    for (let i = 0; i < sources.length; i++) {
      const s = sources[i];
      if (s.hand) return 'hands';
      if (s.gamepad) controllers++;
    }
    return controllers > 0 ? 'controllers' : 'none';
  }
}
