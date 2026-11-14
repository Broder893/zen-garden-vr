import { describe, expect, it } from 'vitest';
import { daysBetween, streakOn, visitOn, weekDots } from '../src/save/streak';

const none = { streak: 0, lastDay: 0, dayMask: 0 };

describe('days in a row', () => {
  it('counts calendar days, across months, years and DST changes', () => {
    expect(daysBetween(20261130, 20261201)).toBe(1);
    expect(daysBetween(20261231, 20270101)).toBe(1);
    expect(daysBetween(20260328, 20260330)).toBe(2);
    expect(daysBetween(20261024, 20261026)).toBe(2);
  });

  it('starts at 1, grows day by day, and says so from the second day', () => {
    const a = visitOn(none, 20261112);
    expect(a).toMatchObject({ streak: 1, lastDay: 20261112, dayMask: 1, grew: false });
    const b = visitOn(a, 20261113);
    expect(b).toMatchObject({ streak: 2, dayMask: 0b11, grew: true });
    const c = visitOn(b, 20261114);
    expect(c).toMatchObject({ streak: 3, dayMask: 0b111, grew: true });
  });

  it('changes nothing on a second visit the same day', () => {
    const a = visitOn(visitOn(none, 20261113), 20261114);
    expect(visitOn(a, 20261114)).toMatchObject({ streak: 2, dayMask: 0b11, grew: false });
  });

  it('starts again at 1 after a missed day, quietly, keeping the week', () => {
    const a = visitOn(visitOn(none, 20261110), 20261111);
    const b = visitOn(a, 20261113);
    expect(b).toMatchObject({ streak: 1, dayMask: 0b1101, grew: false });
    expect(visitOn(a, 20261201)).toMatchObject({ streak: 1, dayMask: 1 });
  });

  it('survives a clock set back', () => {
    const a = visitOn(none, 20261114);
    expect(visitOn(a, 20261110)).toMatchObject({ streak: 1, lastDay: 20261110, dayMask: 1 });
  });

  it('shows the last 7 days, oldest first, today last', () => {
    const s = visitOn(visitOn(visitOn(none, 20261110), 20261113), 20261114);
    expect(weekDots(s, 20261114)).toEqual([false, false, true, false, false, true, true]);
    // A day later, before visiting: everything moves one to the left.
    expect(weekDots(s, 20261115)).toEqual([false, true, false, false, true, true, false]);
    expect(weekDots(none, 20261114)).toEqual([false, false, false, false, false, false, false]);
  });

  it('reports a lapsed streak as 0 until the next visit', () => {
    const s = visitOn(visitOn(none, 20261113), 20261114);
    expect(streakOn(s, 20261114)).toBe(2);
    expect(streakOn(s, 20261115)).toBe(2);
    expect(streakOn(s, 20261117)).toBe(0);
  });
});
