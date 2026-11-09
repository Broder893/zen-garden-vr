import { describe, expect, it } from 'vitest';
import { overridesFrom, seasonFor, SEASON_COLORS, timeOfDayFor } from '../src/save/atmosphere';

describe('season calendar', () => {
  it('follows the meteorological seasons (northern hemisphere)', () => {
    const at = (month: number, day = 15) => seasonFor(new Date(2026, month, day));
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((m) => at(m))).toEqual([
      'winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter',
    ]);
    expect(seasonFor(new Date(2026, 1, 28, 23, 59))).toBe('winter');
    expect(seasonFor(new Date(2026, 2, 1, 0, 0))).toBe('spring');
    expect(seasonFor(new Date(2026, 11, 1))).toBe('winter');
  });

  it('turns the sky at the right hours', () => {
    const at = (h: number, m = 0) => timeOfDayFor(new Date(2026, 10, 9, h, m));
    expect([at(5, 59), at(6), at(7, 59), at(8), at(16, 59), at(17), at(19, 59), at(20)]).toEqual([
      'night', 'sunset', 'sunset', 'day', 'day', 'sunset', 'sunset', 'night',
    ]);
  });

  it('has every colour for every season', () => {
    for (const c of Object.values(SEASON_COLORS)) {
      for (const hex of [c.leaf, c.flower, c.forest, c.ground]) expect(hex).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe('?season=, ?time= and ?weather=', () => {
  it('reads valid values and ignores anything else', () => {
    expect(overridesFrom('?season=winter&time=night&weather=rain')).toEqual({ season: 'winter', time: 'night', weather: 'rain' });
    expect(overridesFrom('?season=monsoon&time=noon&weather=snow')).toEqual({ season: undefined, time: undefined, weather: undefined });
    expect(overridesFrom('')).toEqual({ season: undefined, time: undefined, weather: undefined });
  });
});
