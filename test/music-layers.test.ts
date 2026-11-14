import { describe, expect, it } from 'vitest';
import { depthFor, MAX_NOTE_GAIN, MusicDepth, nextPhrase, phraseGap } from '../src/audio/music-layers';

/** A repeatable 0..1 sequence. */
function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
const phrases = (depth: MusicDepth, calm = false) => {
  const rand = seeded(7 + depth);
  return Array.from({ length: 400 }, () => nextPhrase(depth, calm, 8, rand));
};

describe('music that grows with the tree', () => {
  it('goes from the drone alone to one more layer per stage', () => {
    expect(depthFor(false, 0)).toBe(0);
    expect([0, 1, 2, 3].map((stage) => depthFor(true, stage))).toEqual([1, 2, 3, 4]);
    expect(depthFor(true, 9)).toBe(4);
  });

  it('plays nothing before planting, and only single notes for the sprout', () => {
    expect(phrases(0).every((p) => p.length === 0)).toBe(true);
    expect(phrases(1).every((p) => p.length >= 1 && p.length <= 2)).toBe(true);
  });

  it('adds arpeggios for the young tree and melodies from the mature one', () => {
    const longest = (d: MusicDepth) => Math.max(...phrases(d).map((p) => p.length));
    expect(longest(2)).toBe(3);
    expect(longest(3)).toBeGreaterThanOrEqual(4);
    const melodies = (d: MusicDepth) => phrases(d).filter((p) => p.length >= 4).length;
    expect(melodies(4)).toBeGreaterThan(melodies(3));
  });

  it('stays soft, in the scale and unhurried at every depth', () => {
    for (const d of [1, 2, 3, 4] as MusicDepth[]) {
      for (const p of phrases(d)) {
        for (const n of p) {
          expect(n.gain).toBeLessThanOrEqual(MAX_NOTE_GAIN);
          expect(n.note).toBeGreaterThanOrEqual(0);
          expect(n.note).toBeLessThan(8);
        }
      }
      expect(phraseGap(d, false, () => 0)).toBeGreaterThanOrEqual(3);
    }
  });

  it('keeps to single notes during a breathing session', () => {
    expect(phrases(4, true).every((p) => p.length <= 2)).toBe(true);
    expect(phraseGap(4, true, () => 0)).toBe(7);
  });
});
