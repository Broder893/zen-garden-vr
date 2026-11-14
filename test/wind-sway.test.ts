import { describe, expect, it } from 'vitest';
import { isTrunk, SWAY_STRIDE, swayData, windStrength } from '../src/wind-sway';

/** One triangle per part: [x, y, z] corners. */
function mesh(parts: number[][][]) {
  const position = parts.flat(2);
  return { position, count: position.length / 3 };
}

describe('wind sway data', () => {
  it('gives each part its centre, base and weight; wide parts (hills) stay still', () => {
    const { position } = mesh([
      [[1, 2, 1], [2, 4, 1], [1.5, 3, 2]], // a canopy
      [[-10, 0, -10], [10, 0, -10], [0, 1, 10]], // the hills: 20 m wide
    ]);
    const d = swayData(position, null, null, 3);
    expect(Array.from(d.slice(0, SWAY_STRIDE))).toEqual([1.5, 1.5, 2, 1]);
    expect(d[3 * SWAY_STRIDE + 3]).toBe(0);
  });

  it('joins faces that share a corner position into one part (flat shading)', () => {
    const { position } = mesh([
      [[0, 0, 0], [1, 0, 0], [0, 1, 0]],
      [[1, 0, 0], [2, 0, 0], [1, 1, 0]], // shares (1,0,0) with the first
    ]);
    const d = swayData(position, null, null, 3);
    expect(d[0]).toBeCloseTo(1);
    expect(d[5 * SWAY_STRIDE]).toBeCloseTo(1);
  });

  it('keeps brown parts (trunks) still', () => {
    const { position } = mesh([
      [[0, 0, 0], [0.1, 0, 0], [0, 1, 0]],
      [[3, 1, 0], [4, 1, 0], [3, 2, 0]],
    ]);
    const brown = [0.3, 0.2, 0.1], green = [0.1, 0.4, 0.1];
    const color = [...brown, ...brown, ...brown, ...green, ...green, ...green];
    const d = swayData(position, null, color, 3, isTrunk);
    expect(d[3]).toBe(0);
    expect(d[3 * SWAY_STRIDE + 3]).toBe(1);
  });
});

describe('wind strength', () => {
  it('is calm by day, almost still at night, stronger in a breeze, smaller when gentle', () => {
    expect(windStrength('day', 0, false)).toBe(1);
    expect(windStrength('night', 0, false)).toBeLessThan(0.2);
    expect(windStrength('day', 1, false)).toBeGreaterThan(2);
    expect(windStrength('day', 0, true)).toBeLessThan(0.5);
  });
});
