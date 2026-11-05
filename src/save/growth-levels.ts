import { BonsaiStage } from '../garden-components.js';

/**
 * Experience and levels: what care is worth, and what each level brings.
 * Pure module (no ECS, no Three), shared by growth, saving and the badge.
 *
 * The first five levels are the tree's own stages; the thresholds are set so
 * the tutorial path (plant, water, trim twice and water, trim three times and
 * water) reaches each stage exactly when the old rules did. Levels 6-9 come
 * from coming back: each return the soil dries and shoots grow back.
 */
export const XP = {
  plant: 5,
  /** Filling the tree's water for this stage (or for this visit, once in bloom). */
  waterFull: 10,
  cut: 5,
  meditation: 15,
  breathBreak: 10,
  /** First visit of each calendar day, once the seed is planted. */
  dailyGift: 20,
} as const;

/** What a level adds to the garden (levels 1-5 are the tree itself). */
export type Unlock = 'glazedPot' | 'lantern' | 'stream' | 'deepBreath';

export interface Level {
  level: number;
  /** Total XP needed to reach it. */
  xp: number;
  name: string;
  unlock?: Unlock;
}

export const LEVELS: readonly Level[] = [
  { level: 1, xp: 0, name: 'Seed' },
  { level: 2, xp: 5, name: 'Sprout' },
  { level: 3, xp: 15, name: 'Young bonsai' },
  { level: 4, xp: 35, name: 'Mature bonsai' },
  { level: 5, xp: 60, name: 'In bloom' },
  { level: 6, xp: 110, name: 'Glazed pot', unlock: 'glazedPot' },
  { level: 7, xp: 180, name: 'Stone lantern', unlock: 'lantern' },
  { level: 8, xp: 270, name: 'Little stream', unlock: 'stream' },
  { level: 9, xp: 380, name: 'Deep breath', unlock: 'deepBreath' },
];

export const MAX_LEVEL = LEVELS[LEVELS.length - 1].level;

/** The level reached with `xp` (1..MAX_LEVEL). */
export function levelFor(xp: number): Level {
  let found = LEVELS[0];
  for (const l of LEVELS) if (xp >= l.xp) found = l;
  return found;
}

/** The next level to reach, or null at the top. */
export function nextLevel(xp: number): Level | null {
  for (const l of LEVELS) if (xp < l.xp) return l;
  return null;
}

/** Bonsai stage for `xp` (once planted): level 2 sprout ... level 5+ blooming. */
export function stageFor(xp: number): number {
  return Math.min(BonsaiStage.Blooming, Math.max(BonsaiStage.Sprout, levelFor(xp).level - 2));
}

/** XP at which a stage begins: used to give older saves (from before XP) a fair start. */
export function xpForStage(stage: number): number {
  return LEVELS[Math.min(LEVELS.length - 1, Math.max(0, stage) + 1)].xp;
}

export function isUnlocked(xp: number, unlock: Unlock): boolean {
  const l = LEVELS.find((x) => x.unlock === unlock);
  return l !== undefined && xp >= l.xp;
}

/** Local calendar day as a number (20261105): the daily gift's key. */
export function dayKey(time: number): number {
  const d = new Date(time);
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}
