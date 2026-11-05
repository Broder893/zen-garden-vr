/**
 * The tree's health: careful care, never a game over. Pure module (no ECS, no
 * Three). Stress goes 0 (healthy) .. 1 (wilted); it never costs experience,
 * level or stage, and always comes back down: with time, or faster with a
 * breathing session near the tree.
 */
export const Health = { Healthy: 0, Stressed: 1, Wilted: 2 } as const;
export type HealthState = (typeof Health)[keyof typeof Health];

/** Stress at which the tree looks stressed, and wilted. */
export const STRESSED_AT = 0.35;
export const WILTED_AT = 0.7;

export function healthOf(stress: number): HealthState {
  if (stress >= WILTED_AT) return Health.Wilted;
  if (stress >= STRESSED_AT) return Health.Stressed;
  return Health.Healthy;
}

/** Seconds of pouring onto an already full tree to reach full overwater (1). */
export const OVERWATER_POUR_SECONDS = 8;
/** Overwater drains away by itself in about this long (the soil dries). */
export const OVERWATER_DRAIN_SECONDS = 75;
/** Stress fades by itself over about this long once its cause is gone. */
export const STRESS_EASE_SECONDS = 90;
/** During a breathing session, stress fades this much faster. */
export const BREATH_RECOVERY_FACTOR = 6;
/** Stress a wrong cut (a healthy branch) adds: about three wilt the tree. */
export const WRONG_CUT_STRESS = 0.26;
/** Away this long: the tree is a little tense on return and the firefly suggests breathing. */
export const NEGLECT_MS = 24 * 60 * 60 * 1000;
export const NEGLECT_STRESS = 0.4;

/** The stress that overwatering causes: none until a little excess, wilted near the top. */
export function stressFromOverwater(overwater: number): number {
  const k = Math.min(1, Math.max(0, (overwater - 0.3) / 0.6));
  return k * k * (3 - 2 * k) * 0.9;
}
