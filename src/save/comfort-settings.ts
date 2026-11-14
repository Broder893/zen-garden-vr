/**
 * Accessibility and comfort preferences, kept apart from the garden save so
 * starting a fresh garden never resets them. Pure module: no ECS, no Three.
 * Storage may be missing or blocked; the defaults are then used each time.
 */
export type BreathPace = 'slow' | 'medium' | 'fast';
export type Hands = 'both' | 'left' | 'right';
/** Visual quality: auto lowers it by itself if the headset cannot keep its frame rate. */
export type Quality = 'auto' | 'high' | 'medium' | 'low';

export interface ComfortSettings {
  breathPace: BreathPace;
  highContrast: boolean;
  largeText: boolean;
  /** 'left' or 'right': everything is placed for, and follows, that hand only. */
  hands: Hands;
  /** Hold a hand still by an object (or look at it) instead of pinching. */
  dwell: boolean;
  quality: Quality;
  /** Closed-eye moments fade slowly instead of showing eyelids. */
  softTransitions: boolean;
  /** The table, relative to the eyes (m): + higher, - lower (TABLE_STEP steps, at most TABLE_MAX). */
  tableHeight: number;
  /** The table, relative to the body (m): + nearer, - farther. */
  tableNear: number;
}

/** The table moves in steps of 2.5 cm, at most 15 cm either way. */
export const TABLE_STEP = 0.025;
export const TABLE_MAX = 0.15;

/** A table offset kept on the 2.5 cm grid and within reach of ±15 cm. */
export function clampTable(x: unknown): number {
  if (typeof x !== 'number' || !Number.isFinite(x)) return 0;
  const steps = Math.round(x / TABLE_STEP);
  const max = Math.round(TABLE_MAX / TABLE_STEP);
  return (Math.min(max, Math.max(-max, steps)) * TABLE_STEP) || 0;
}

/** Breath timings per pace, in seconds; with intro and outro a session lasts about 75-95 s. */
export const BREATH_PACES: Record<BreathPace, { inhale: number; hold: number; exhale: number; breaths: number }> = {
  slow: { inhale: 5, hold: 2, exhale: 7, breaths: 6 },
  medium: { inhale: 4, hold: 2, exhale: 6, breaths: 6 },
  fast: { inhale: 3, hold: 1, exhale: 4, breaths: 8 },
};

const KEY = 'zen-garden-vr/comfort';
const VERSION = 1;

export function defaultSettings(): ComfortSettings {
  return {
    breathPace: 'medium', highContrast: false, largeText: false, hands: 'both', dwell: false, quality: 'auto',
    softTransitions: false, tableHeight: 0, tableNear: 0,
  };
}

export function loadSettings(): ComfortSettings {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? parseSettings(raw) : defaultSettings();
  } catch {
    return defaultSettings();
  }
}

/** Returns false (and changes nothing) if storage refuses. */
export function storeSettings(s: ComfortSettings): boolean {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ v: VERSION, ...s }));
    return true;
  } catch {
    return false;
  }
}

/** Validates untrusted JSON field by field; anything unknown keeps its default. */
export function parseSettings(raw: string): ComfortSettings {
  const s = defaultSettings();
  let d: Record<string, unknown>;
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return s;
    d = data as Record<string, unknown>;
  } catch {
    return s;
  }
  if (d.v !== VERSION) return s;
  if (d.breathPace === 'slow' || d.breathPace === 'medium' || d.breathPace === 'fast') s.breathPace = d.breathPace;
  if (d.hands === 'both' || d.hands === 'left' || d.hands === 'right') s.hands = d.hands;
  s.highContrast = d.highContrast === true;
  s.largeText = d.largeText === true;
  s.dwell = d.dwell === true;
  // Added later: older stored settings simply keep the default (auto).
  if (d.quality === 'auto' || d.quality === 'high' || d.quality === 'medium' || d.quality === 'low') s.quality = d.quality;
  s.softTransitions = d.softTransitions === true;
  // Added later: older stored settings keep the table where it was authored.
  s.tableHeight = clampTable(d.tableHeight);
  s.tableNear = clampTable(d.tableNear);
  return s;
}
