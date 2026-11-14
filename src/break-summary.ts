/**
 * The end-of-break summary's lines (src/break-timer.ts). Pure: no engine
 * imports, so the tests run in Node. Plain ASCII for the panel's font.
 */
export interface BreakStats {
  minutes: number;
  breaths: number;
  waterings: number;
  trims: number;
  level: number;
  levelName: string;
  /** Experience earned in this break, and toward the next level (null at the top). */
  xpGained: number;
  xp: number;
  nextXp: number | null;
  /** Days in a row with a visit (0 = not counted). */
  streak: number;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function summaryLines(s: BreakStats): {
  minutes: string;
  breaths: string;
  cares: string;
  level: string;
  streak: string;
} {
  const cares = s.waterings + s.trims;
  const parts: string[] = [];
  if (s.waterings > 0) parts.push(plural(s.waterings, 'watering', 'waterings'));
  if (s.trims > 0) parts.push(plural(s.trims, 'trim', 'trims'));
  return {
    minutes: `${plural(s.minutes, 'minute', 'minutes')} of break`,
    breaths: plural(s.breaths, 'calm breath', 'calm breaths'),
    cares: cares === 0 ? 'A quiet visit with your tree' : `${plural(cares, 'care', 'cares')}: ${parts.join(', ')}`,
    level:
      `Level ${s.level} - ${s.levelName}` +
      (s.nextXp === null ? ' (top level)' : ` (${s.xp} / ${s.nextXp} XP)`) +
      (s.xpGained > 0 ? `, +${s.xpGained} XP` : ''),
    streak: s.streak > 0 ? `${plural(s.streak, 'day', 'days')} in a row` : '',
  };
}
