import { BonsaiStage } from './garden-components.js';
import type { BreathPace } from './save/comfort-settings.js';

/**
 * One breathing rhythm: seconds for each part of a breath, and how many
 * breaths. holdIn follows the inhale, holdOut follows the exhale (0 = none).
 * Pure data: no ECS, no Three.
 */
export interface BreathPattern {
  name: string;
  inhale: number;
  holdIn: number;
  exhale: number;
  holdOut: number;
  breaths: number;
}

/** The rhythms of the short breathing breaks, gentlest first. */
export const BREAK_PATTERNS = {
  /** In 4, out 6: a longer out-breath, the easiest start. */
  simple: { name: 'simple', inhale: 4, holdIn: 0, exhale: 6, holdOut: 0, breaths: 3 },
  /** In 4, hold 4, out 4, hold 4: four equal sides. */
  box: { name: 'box', inhale: 4, holdIn: 4, exhale: 4, holdOut: 4, breaths: 3 },
  /** In 5, hold 2, out 8: long and slow. */
  long: { name: 'long', inhale: 5, holdIn: 2, exhale: 8, holdOut: 0, breaths: 4 },
  /** In 4, hold 7, out 8: the deep breath unlocked at level 9. */
  deep: { name: 'deep', inhale: 4, holdIn: 7, exhale: 8, holdOut: 0, breaths: 3 },
} as const satisfies Record<string, BreathPattern>;

/**
 * A bigger tree has learnt a deeper rhythm: the pattern follows the bonsai's
 * stage. Once the deep breath is unlocked, a blooming tree alternates it with
 * the long one (`breakIndex` = breaks finished so far).
 */
export function breakPatternFor(stage: number, deepUnlocked = false, breakIndex = 0): BreathPattern {
  if (stage >= BonsaiStage.Blooming) {
    return deepUnlocked && breakIndex % 2 === 0 ? BREAK_PATTERNS.deep : BREAK_PATTERNS.long;
  }
  if (stage >= BonsaiStage.Mature) return BREAK_PATTERNS.box;
  return BREAK_PATTERNS.simple;
}

/** The Comfort panel's breathing pace stretches or shortens every part of a pattern. */
const PACE_FACTOR: Record<BreathPace, number> = { slow: 1.25, medium: 1, fast: 0.75 };

export function withPace(p: BreathPattern, pace: BreathPace): BreathPattern {
  const k = PACE_FACTOR[pace];
  return {
    name: p.name,
    inhale: p.inhale * k,
    holdIn: p.holdIn * k,
    exhale: p.exhale * k,
    holdOut: p.holdOut * k,
    breaths: p.breaths,
  };
}

/** Seconds of breathing in a pattern (no intro or outro). */
export function patternSeconds(p: BreathPattern): number {
  return (p.inhale + p.holdIn + p.exhale + p.holdOut) * p.breaths;
}
