/**
 * Seasons and time of day from the real calendar and clock (pure module, no
 * ECS). Demos and judges can force them with ?season=spring|summer|autumn|winter
 * ?time=day|sunset|night and ?weather=rain|breeze.
 */
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type TimeOfDay = 'day' | 'sunset' | 'night';
export type Weather = 'clear' | 'rain' | 'breeze';

/** Northern-hemisphere months: Mar-May spring, Jun-Aug summer, Sep-Nov autumn. */
export function seasonFor(date: Date): Season {
  const m = date.getMonth();
  if (m >= 2 && m <= 4) return 'spring';
  if (m >= 5 && m <= 7) return 'summer';
  if (m >= 8 && m <= 10) return 'autumn';
  return 'winter';
}

/** Daylight 8-17, golden hours 6-8 and 17-20, night otherwise. */
export function timeOfDayFor(date: Date): TimeOfDay {
  const h = date.getHours() + date.getMinutes() / 60;
  if (h >= 8 && h < 17) return 'day';
  if ((h >= 6 && h < 8) || (h >= 17 && h < 20)) return 'sunset';
  return 'night';
}

/** Leaf and blossom colours of the bonsai in each season. */
export const SEASON_COLORS: Record<Season, { leaf: string; flower: string }> = {
  spring: { leaf: '#6fae4a', flower: '#f7c1d5' },
  summer: { leaf: '#3f7f34', flower: '#f6b8cf' },
  autumn: { leaf: '#b8532c', flower: '#f2c49b' },
  winter: { leaf: '#47705a', flower: '#e9e6f2' },
};

/** Reads ?season= and ?time= (anything else falls back to the real date). */
export function overridesFrom(search: string): { season?: Season; time?: TimeOfDay; weather?: Weather } {
  const p = new URLSearchParams(search);
  const s = p.get('season');
  const t = p.get('time');
  const w = p.get('weather');
  return {
    season: s === 'spring' || s === 'summer' || s === 'autumn' || s === 'winter' ? s : undefined,
    time: t === 'day' || t === 'sunset' || t === 'night' ? t : undefined,
    weather: w === 'rain' || w === 'breeze' ? w : undefined,
  };
}
