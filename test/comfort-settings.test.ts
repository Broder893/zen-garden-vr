import { describe, expect, it } from 'vitest';
import { clampTable, defaultSettings, parseSettings } from '../src/save/comfort-settings';

describe('comfort settings: the table', () => {
  it('starts where it was authored', () => {
    expect(defaultSettings()).toMatchObject({ tableHeight: 0, tableNear: 0 });
  });

  it('keeps older stored settings, with the table untouched', () => {
    const s = parseSettings(JSON.stringify({ v: 1, breathPace: 'slow', dwell: true }));
    expect(s).toMatchObject({ breathPace: 'slow', dwell: true, tableHeight: 0, tableNear: 0 });
  });

  it('stores 2.5 cm steps, at most 15 cm either way', () => {
    const s = parseSettings(JSON.stringify({ v: 1, tableHeight: 0.05, tableNear: -0.075 }));
    expect(s.tableHeight).toBeCloseTo(0.05);
    expect(s.tableNear).toBeCloseTo(-0.075);
    expect(clampTable(0.4)).toBeCloseTo(0.15);
    expect(clampTable(-9)).toBeCloseTo(-0.15);
    expect(clampTable(0.031)).toBeCloseTo(0.025);
    expect(clampTable('high')).toBe(0);
    expect(clampTable(Number.NaN)).toBe(0);
  });
});
