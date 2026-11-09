import { describe, expect, it } from 'vitest';
import { dayKey, isUnlocked, LEVELS, levelFor, MAX_LEVEL, nextLevel, stageFor, xpForStage, XP } from '../src/save/growth-levels';

describe('levels', () => {
  it('has rising thresholds from 0', () => {
    expect(LEVELS[0].xp).toBe(0);
    for (let i = 1; i < LEVELS.length; i++) expect(LEVELS[i].xp).toBeGreaterThan(LEVELS[i - 1].xp);
    expect(MAX_LEVEL).toBe(9);
  });

  it('reaches each level exactly at its threshold', () => {
    for (const l of LEVELS) {
      expect(levelFor(l.xp).level).toBe(l.level);
      if (l.xp > 0) expect(levelFor(l.xp - 1).level).toBe(l.level - 1);
    }
    expect(levelFor(1e6).level).toBe(MAX_LEVEL);
    expect(nextLevel(1e6)).toBeNull();
    expect(nextLevel(0)?.level).toBe(2);
  });

  it('maps levels to tree stages: sprout at 2, bloom from 5', () => {
    expect([0, 5, 15, 35, 60, 400].map(stageFor)).toEqual([0, 0, 1, 2, 3, 3]);
    for (let stage = 0; stage <= 3; stage++) expect(stageFor(xpForStage(stage))).toBe(stage);
  });

  it('follows the tutorial path: plant, water, trim twice and water, trim three times and water', () => {
    let xp = XP.plant;
    expect(stageFor(xp)).toBe(0);
    xp += XP.waterFull;
    expect(stageFor(xp)).toBe(1);
    xp += 2 * XP.cut + XP.waterFull;
    expect(stageFor(xp)).toBe(2);
    xp += 3 * XP.cut + XP.waterFull;
    expect(stageFor(xp)).toBe(3);
  });

  it('unlocks each reward at its own level only', () => {
    expect(isUnlocked(109, 'glazedPot')).toBe(false);
    expect(isUnlocked(110, 'glazedPot')).toBe(true);
    expect(isUnlocked(379, 'deepBreath')).toBe(false);
    expect(isUnlocked(380, 'deepBreath')).toBe(true);
  });

  it('keys the daily gift by local calendar day', () => {
    expect(dayKey(new Date(2026, 10, 9, 23, 59).getTime())).toBe(20261109);
    expect(dayKey(new Date(2026, 10, 10, 0, 1).getTime())).toBe(20261110);
  });
});
