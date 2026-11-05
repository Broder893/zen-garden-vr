/**
 * Accessibility and comfort preferences, kept apart from the garden save so
 * starting a fresh garden never resets them. Pure module: no ECS, no Three.
 * Storage may be missing or blocked; the defaults are then used each time.
 */
export type BreathPace = 'slow' | 'medium' | 'fast';
export type Hands = 'both' | 'left' | 'right';

export interface ComfortSettings {
  breathPace: BreathPace;
  highContrast: boolean;
  largeText: boolean;
  /** 'left' or 'right': everything is placed for, and follows, that hand only. */
  hands: Hands;
  /** Hold a hand still by an object (or look at it) instead of pinching. */
  dwell: boolean;
}

/** Breath timings per pace, in seconds; sessions stay about 80-90 s long. */
export const BREATH_PACES: Record<BreathPace, { inhale: number; hold: number; exhale: number; breaths: number }> = {
  slow: { inhale: 5, hold: 2, exhale: 7, breaths: 6 },
  medium: { inhale: 4, hold: 2, exhale: 6, breaths: 6 },
  fast: { inhale: 3, hold: 1, exhale: 4, breaths: 8 },
};

const KEY = 'zen-garden-vr/comfort';
const VERSION = 1;

export function defaultSettings(): ComfortSettings {
  return { breathPace: 'medium', highContrast: false, largeText: false, hands: 'both', dwell: false };
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
  return s;
}
