/**
 * Visual quality levels and what the device remembers about them. Pure
 * module: no ECS, no Three. Storage may be blocked: then nothing is
 * remembered and the defaults apply each visit.
 */
export type QualityLevel = 'high' | 'medium' | 'low';

/** From best to lightest: Auto steps down this list, one level at a time. */
export const QUALITY_ORDER: readonly QualityLevel[] = ['high', 'medium', 'low'];

export interface QualitySpec {
  /** Share of fireflies and raindrops drawn. */
  effects: number;
  /** XR resolution scale (applies when a session starts). */
  framebuffer: number;
  /** Hide two background pieces (the far lantern and the rocks). */
  hideScenery: boolean;
}

export const QUALITY: Record<QualityLevel, QualitySpec> = {
  high: { effects: 1, framebuffer: 1, hideScenery: false },
  medium: { effects: 0.5, framebuffer: 0.9, hideScenery: false },
  low: { effects: 0.25, framebuffer: 0.8, hideScenery: true },
};

/** One level lighter, or the same when already the lightest. */
export function lighter(level: QualityLevel): QualityLevel {
  const i = QUALITY_ORDER.indexOf(level);
  return QUALITY_ORDER[Math.min(QUALITY_ORDER.length - 1, i + 1)];
}

const KEY = 'zen-garden-vr/quality';

/** The level Auto settled on in an earlier visit (this device stays as fast), or null. */
export function loadAutoLevel(): QualityLevel | null {
  try {
    const v = window.localStorage.getItem(KEY);
    return v === 'high' || v === 'medium' || v === 'low' ? v : null;
  } catch {
    return null;
  }
}

/** Remembers it (null forgets); false if storage refuses. */
export function storeAutoLevel(level: QualityLevel | null): boolean {
  try {
    if (level) window.localStorage.setItem(KEY, level);
    else window.localStorage.removeItem(KEY);
    return true;
  } catch {
    return false;
  }
}
