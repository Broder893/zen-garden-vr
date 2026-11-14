import { describe, expect, it } from 'vitest';
import { summaryLines } from '../src/break-summary';

const base = { minutes: 5, breaths: 0, waterings: 0, trims: 0, level: 6, levelName: 'Glazed pot', xpGained: 0, xp: 120, nextXp: 160, streak: 0 };

describe('break summary', () => {
  it('reads as short plain lines', () => {
    const l = summaryLines({ ...base, breaths: 6, waterings: 1, trims: 2, xpGained: 25, streak: 3 });
    expect(l.minutes).toBe('5 minutes of break');
    expect(l.breaths).toBe('6 calm breaths');
    expect(l.cares).toBe('3 cares: 1 watering, 2 trims');
    expect(l.level).toBe('Level 6 - Glazed pot (120 / 160 XP), +25 XP');
    expect(l.streak).toBe('3 days in a row');
  });

  it('is kind when nothing was done, and singular where it should be', () => {
    const l = summaryLines({ ...base, minutes: 3, breaths: 1, streak: 1 });
    expect(l.cares).toBe('A quiet visit with your tree');
    expect(l.breaths).toBe('1 calm breath');
    expect(l.streak).toBe('1 day in a row');
  });

  it('shows the top level, and no streak line when not counted', () => {
    const l = summaryLines({ ...base, nextXp: null });
    expect(l.level).toBe('Level 6 - Glazed pot (top level)');
    expect(l.streak).toBe('');
  });
});
