import { describe, expect, it } from 'vitest';
import { emptySave, flowersForVisits, parseSave, visitGrowsFlower } from '../src/save/garden-save';
import { xpForStage, XP } from '../src/save/growth-levels';

const v2 = {
  v: 2, planted: true, stage: 2, water: 0.5, prunedMask: 3, visits: 4, meditations: 2, breaks: 1, xp: 50,
  lastGiftDay: 20261109, stress: 0.4, overwater: 0.2, stumpMask: 1, lastVisitAt: 1000, savedAt: 2000,
};

describe('parseSave', () => {
  it('reads a current save as written', () => {
    const { v, ...fields } = v2;
    expect(v).toBe(2);
    expect(parseSave(JSON.stringify(v2))).toEqual(fields);
  });

  it('loads a version 1 save (before health) healthy, keeping xp, visits and flowers', () => {
    const old = { v: 1, planted: true, stage: 2, water: 1, prunedMask: 1, visits: 5, meditations: 3, xp: 40, lastGiftDay: 20261101 };
    const s = parseSave(JSON.stringify(old))!;
    expect(s).not.toBeNull();
    expect([s.stress, s.overwater, s.stumpMask]).toEqual([0, 0, 0]);
    expect(s.xp).toBe(40);
    expect(s.visits).toBe(5);
    expect(flowersForVisits(s.visits)).toBe(4);
    expect(s.breaks).toBe(0);
  });

  it('ignores health fields a version 1 save should not have', () => {
    const s = parseSave(JSON.stringify({ v: 1, planted: true, stage: 1, stress: 0.9, overwater: 1, stumpMask: 7 }))!;
    expect([s.stress, s.overwater, s.stumpMask]).toEqual([0, 0, 0]);
  });

  it('gives a save from before experience a fair start at its stage', () => {
    const s = parseSave(JSON.stringify({ v: 1, planted: true, stage: 2, prunedMask: 0b101, water: 1 }))!;
    expect(s.xp).toBe(xpForStage(2) + 2 * XP.cut + XP.waterFull);
  });

  it('never lets xp fall below its stage', () => {
    expect(parseSave(JSON.stringify({ ...v2, stage: 3, xp: 1 }))!.xp).toBe(xpForStage(3));
  });

  it('keeps an unplanted garden at the seed, whatever it claims', () => {
    const s = parseSave(JSON.stringify({ ...v2, planted: false }))!;
    expect([s.planted, s.stage, s.xp]).toEqual([false, 0, 0]);
  });

  it('clamps out-of-range and wrong-typed values', () => {
    const s = parseSave(JSON.stringify({ ...v2, stage: 99, water: 7, prunedMask: 9999, stress: -1, overwater: 'x', visits: -3 }))!;
    expect(s.stage).toBe(3);
    expect(s.water).toBe(1);
    expect(s.prunedMask).toBe(0xff);
    expect(s.stress).toBe(0);
    expect(s.overwater).toBe(0);
    expect(s.visits).toBe(0);
  });

  it('refuses broken JSON, non-objects and unknown versions', () => {
    expect(parseSave('{oops')).toBeNull();
    expect(parseSave('null')).toBeNull();
    expect(parseSave('42')).toBeNull();
    expect(parseSave(JSON.stringify({ ...v2, v: 3 }))).toBeNull();
    expect(parseSave(JSON.stringify({ planted: true }))).toBeNull();
  });

  it('starts empty and healthy', () => {
    const e = emptySave();
    expect([e.planted, e.xp, e.stress, e.visits]).toEqual([false, 0, 0, 0]);
  });
});

describe('visit flowers', () => {
  it('grows one flower per return visit, at most seven', () => {
    expect([0, 1, 2, 3, 8, 50].map(flowersForVisits)).toEqual([0, 0, 1, 2, 7, 7]);
    expect(visitGrowsFlower(2)).toBe(true);
    expect(visitGrowsFlower(1)).toBe(false);
    expect(visitGrowsFlower(9)).toBe(false);
  });
});
