import { BonsaiStage } from '../garden-components.js';

/**
 * The garden's saved state and its storage in localStorage.
 * Pure module: no ECS, no Three. Every storage call is guarded, because
 * localStorage can be missing, full or blocked (private mode, headset policy);
 * the garden then simply starts fresh each time.
 */
export interface GardenSave {
  planted: boolean;
  /** BonsaiStage, 0 sprout .. 3 blooming. */
  stage: number;
  /** Water for the current stage, 0..1. */
  water: number;
  /** Bitmask of shoots already cut this stage. */
  prunedMask: number;
  /** How many times the player has entered the garden in VR, this one included. */
  visits: number;
  /** Breathing sessions finished, over all visits. */
  meditations: number;
  /** When the garden was last saved (ms since epoch). */
  savedAt: number;
}

const KEY = 'zen-garden-vr/save';
const VERSION = 1;

export function emptySave(): GardenSave {
  return { planted: false, stage: 0, water: 0, prunedMask: 0, visits: 0, meditations: 0, savedAt: 0 };
}

/** Reads the save; null when there is none, it is unreadable, or storage is blocked. */
export function loadSave(): GardenSave | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? parseSave(raw) : null;
  } catch {
    return null;
  }
}

/** Writes the save; returns false (and changes nothing) if storage refuses. */
export function storeSave(save: GardenSave): boolean {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ v: VERSION, ...save }));
    return true;
  } catch {
    return false;
  }
}

export function clearSave(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* storage blocked: nothing to clear */
  }
}

/** Validates untrusted JSON; anything malformed falls back to safe values. */
export function parseSave(raw: string): GardenSave | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null) return null;
  const d = data as Record<string, unknown>;
  if (d.v !== VERSION) return null;
  const clampInt = (x: unknown, min: number, max: number) =>
    typeof x === 'number' && Number.isFinite(x) ? Math.min(max, Math.max(min, Math.round(x))) : min;
  const planted = d.planted === true;
  return {
    planted,
    stage: planted ? clampInt(d.stage, 0, BonsaiStage.Blooming) : 0,
    water: typeof d.water === 'number' && Number.isFinite(d.water) ? Math.min(1, Math.max(0, d.water)) : 0,
    prunedMask: clampInt(d.prunedMask, 0, 0xff),
    visits: clampInt(d.visits, 0, 1e6),
    meditations: clampInt(d.meditations, 0, 1e6),
    savedAt: clampInt(d.savedAt, 0, Number.MAX_SAFE_INTEGER),
  };
}
