/**
 * The queue of garden changes that wait for closed eyes (EyelidSystem): the
 * tree's new stage, the season, the time of day, the weather and level
 * unlocks. Pure logic, no ECS: the eyelids say whether the eyes are closed or
 * closing, this decides whether a change may land now.
 */

/** Changes that wait for closed eyes. */
export type ChangeKind = 'stage' | 'season' | 'time' | 'weather' | 'unlock';

/**
 * How long each change may wait for closed eyes before it applies anyway,
 * gently (seconds). 0: only while a closure is under way (a breathing session,
 * the entrance); otherwise at once, as the tree's soft growth.
 */
export const MAX_WAIT: Readonly<Record<ChangeKind, number>> = { stage: 0, season: 300, time: 300, weather: 120, unlock: 300 };

/** What the eyelids are doing when a change asks. */
export interface EyesNow {
  /** Seconds on the eyelids' clock. */
  clock: number;
  /** Eyes fully closed, or the eyelids switched off: anything may land. */
  closedOrOff: boolean;
  /** A closure is under way or wanted (a session, the entrance). */
  closing: boolean;
}

export class ChangeQueue {
  /** Changes waiting, with when each was first asked (eyelids' clock). */
  readonly pending = new Map<ChangeKind, number>();

  /**
   * True when `kind` may apply now (eyes closed, or it has waited long enough
   * with no closure coming); false keeps it waiting for the next closed eyes.
   */
  mayApply(kind: ChangeKind, eyes: EyesNow): boolean {
    if (eyes.closedOrOff) {
      this.pending.delete(kind);
      return true;
    }
    if (!eyes.closing && MAX_WAIT[kind] === 0) {
      this.pending.delete(kind);
      return true;
    }
    const first = this.pending.get(kind);
    if (first === undefined) {
      this.pending.set(kind, eyes.clock);
      return false;
    }
    if (!eyes.closing && eyes.clock - first >= MAX_WAIT[kind]) {
      this.pending.delete(kind);
      return true;
    }
    return false;
  }
}
