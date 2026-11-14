/**
 * Days in a row with a visit (local calendar days). Pure: no engine, no
 * storage. A missed day starts the count again at 1, with no message.
 */
export interface Streak {
  /** Consecutive days with a visit, up to the last one (0 = never counted). */
  streak: number;
  /** The last day with a visit, as dayKey (20261114); 0 = none. */
  lastDay: number;
  /** The last 7 days with a visit, up to lastDay: bit 0 = lastDay, bit 6 = six days before. */
  dayMask: number;
}

export const WEEK_MASK = 0x7f;
const DAY_MS = 86_400_000;

/** A dayKey (20261114) as a count of days, for differences (local midnight; DST-proof). */
function dayIndex(key: number): number {
  const y = Math.floor(key / 10000);
  const m = Math.floor((key % 10000) / 100);
  const d = key % 100;
  return Math.round(new Date(y, m - 1, d).getTime() / DAY_MS);
}

/** Whole days from one dayKey to another (negative if `to` is earlier). */
export function daysBetween(from: number, to: number): number {
  return dayIndex(to) - dayIndex(from);
}

/**
 * Counts a visit on `today`. The same day again changes nothing; the next
 * day grows the streak; a longer gap (or a clock set back) starts it at 1.
 * `grew` is true when the streak went up to 2 or more (worth a word).
 */
export function visitOn(s: Streak, today: number): Streak & { grew: boolean } {
  if (s.lastDay === today) return { ...s, grew: false };
  const gap = s.lastDay > 0 ? daysBetween(s.lastDay, today) : Infinity;
  if (gap < 0) return { streak: 1, lastDay: today, dayMask: 1, grew: false };
  const streak = gap === 1 ? s.streak + 1 : 1;
  const dayMask = gap >= 7 ? 1 : ((s.dayMask << gap) | 1) & WEEK_MASK;
  return { streak, lastDay: today, dayMask, grew: streak >= 2 && streak > s.streak };
}

/** The last 7 days seen from `today`, oldest first: true where there was a visit. */
export function weekDots(s: Streak, today: number): boolean[] {
  const shift = s.lastDay > 0 ? daysBetween(s.lastDay, today) : 7;
  const dots: boolean[] = [];
  for (let back = 6; back >= 0; back--) {
    const bit = back - shift;
    dots.push(bit >= 0 && bit < 7 && (s.dayMask & (1 << bit)) !== 0);
  }
  return dots;
}

/** Days in a row as of `today`: the count, or 0 once a day was missed. */
export function streakOn(s: Streak, today: number): number {
  if (s.lastDay === 0) return 0;
  const gap = daysBetween(s.lastDay, today);
  return gap === 0 || gap === 1 ? s.streak : 0;
}
