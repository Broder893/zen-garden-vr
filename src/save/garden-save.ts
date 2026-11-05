import { BonsaiStage } from '../garden-components.js';
import { XP, xpForStage } from './growth-levels.js';

function bitCount(mask: number): number {
  let n = 0;
  for (let m = mask; m; m &= m - 1) n++;
  return n;
}

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
  /** Breathing breaks (offered by the firefly) finished, over all visits. */
  breaks: number;
  /** Experience from care; sets the tree's stage and the garden level. */
  xp: number;
  /** Local day (20261105) of the last daily gift; 0 = never. */
  lastGiftDay: number;
  /** When the last counted visit began (ms since epoch). */
  lastVisitAt: number;
  /** When the garden was last saved (ms since epoch). */
  savedAt: number;
}

/** Time away before entering the garden again counts as a new visit. */
export const VISIT_GAP_MS = 3 * 60 * 60 * 1000;
const MAX_FLOWERS = 7;

/** Flowers earned after `visits` visits: one per return, up to seven. */
export function flowersForVisits(visits: number): number {
  return Math.min(MAX_FLOWERS, Math.max(0, visits - 1));
}

/** True when reaching `visits` grows a new flower. */
export function visitGrowsFlower(visits: number): boolean {
  return flowersForVisits(visits) > flowersForVisits(visits - 1);
}

const KEY = 'zen-garden-vr/save';
const VERSION = 1;

export function emptySave(): GardenSave {
  return { planted: false, stage: 0, water: 0, prunedMask: 0, visits: 0, meditations: 0, breaks: 0, xp: 0, lastGiftDay: 0, lastVisitAt: 0, savedAt: 0 };
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
  const stage = planted ? clampInt(d.stage, 0, BonsaiStage.Blooming) : 0;
  const prunedMask = clampInt(d.prunedMask, 0, 0xff);
  const water = typeof d.water === 'number' && Number.isFinite(d.water) ? Math.min(1, Math.max(0, d.water)) : 0;
  // Saves from before experience existed start at their stage's threshold,
  // plus the care already given in that stage (so its growth still adds up).
  const xp =
    typeof d.xp === 'number'
      ? clampInt(d.xp, 0, 1e7)
      : planted
        ? xpForStage(stage) + bitCount(prunedMask) * XP.cut + (water >= 1 ? XP.waterFull : 0)
        : 0;
  return {
    planted,
    stage,
    xp: planted ? Math.max(xp, xpForStage(stage)) : 0,
    lastGiftDay: clampInt(d.lastGiftDay, 0, 99991231),
    water,
    prunedMask,
    visits: clampInt(d.visits, 0, 1e6),
    meditations: clampInt(d.meditations, 0, 1e6),
    // Older saves have no breaks yet: they start from 0.
    breaks: clampInt(d.breaks, 0, 1e6),
    lastVisitAt: clampInt(d.lastVisitAt, 0, Number.MAX_SAFE_INTEGER),
    savedAt: clampInt(d.savedAt, 0, Number.MAX_SAFE_INTEGER),
  };
}
