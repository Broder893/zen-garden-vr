import { describe, expect, it } from 'vitest';
import { BREAK_PATTERNS, breakPatternFor, patternSeconds, withPace } from '../src/breath-patterns';

describe('breathing patterns', () => {
  it('deepens with the tree: simple, then box, then long', () => {
    expect(breakPatternFor(0).name).toBe('simple');
    expect(breakPatternFor(1).name).toBe('simple');
    expect(breakPatternFor(2).name).toBe('box');
    expect(breakPatternFor(3).name).toBe('long');
  });

  it('alternates the unlocked deep breath with the long one in bloom', () => {
    expect([0, 1, 2, 3].map((i) => breakPatternFor(3, true, i).name)).toEqual(['deep', 'long', 'deep', 'long']);
    expect(breakPatternFor(2, true, 0).name).toBe('box');
  });

  it('matches the brief: 4 in 6 out, 4-4-4-4, 3-5 breaths', () => {
    expect(BREAK_PATTERNS.simple).toMatchObject({ inhale: 4, exhale: 6, holdIn: 0, holdOut: 0 });
    expect(BREAK_PATTERNS.box).toMatchObject({ inhale: 4, holdIn: 4, exhale: 4, holdOut: 4 });
    for (const p of Object.values(BREAK_PATTERNS)) {
      expect(p.breaths).toBeGreaterThanOrEqual(3);
      expect(p.breaths).toBeLessThanOrEqual(5);
    }
  });

  it('stretches or shortens every phase with the pace, never the breath count', () => {
    const slow = withPace(BREAK_PATTERNS.box, 'slow');
    const fast = withPace(BREAK_PATTERNS.box, 'fast');
    expect(slow).toMatchObject({ inhale: 5, holdIn: 5, exhale: 5, holdOut: 5, breaths: 3 });
    expect(fast).toMatchObject({ inhale: 3, holdIn: 3, exhale: 3, holdOut: 3, breaths: 3 });
    expect(withPace(BREAK_PATTERNS.simple, 'medium')).toEqual(BREAK_PATTERNS.simple);
  });

  it('counts the breathing seconds', () => {
    expect(patternSeconds(BREAK_PATTERNS.simple)).toBe(30);
    expect(patternSeconds(BREAK_PATTERNS.box)).toBe(48);
  });
});
