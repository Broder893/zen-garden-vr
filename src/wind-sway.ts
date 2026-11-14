/**
 * Pure helpers for the wind in the trees (src/wind.ts): which parts of a mesh
 * sway and from where, and how strong the wind is. No engine imports, so the
 * tests run in Node.
 */

export type TimeOfDay = 'day' | 'sunset' | 'night';

/** Per-vertex sway data: tree centre x, z, the tree's base height, and weight (0 = still). */
export const SWAY_STRIDE = 4;

/** A part wider than this is ground or the distant hills: it never moves. */
const WIDE = 4;

/**
 * Splits an indexed mesh into its separate parts (vertices joined by
 * triangles, or sharing a position) and gives every vertex its part's centre
 * (x, z), lowest point and a weight: 0 for the wide ground and hills, and for
 * parts `still(r, g, b)` says are still (the trunks); 1 for the rest. Parts of
 * one tree (a pine's tiers) share about the same centre, so they sway together.
 */
export function swayData(
  position: ArrayLike<number>,
  index: ArrayLike<number> | null,
  color: ArrayLike<number> | null,
  colorSize: number,
  still: (r: number, g: number, b: number) => boolean = () => false,
): Float32Array {
  const count = position.length / 3;
  const find = partsOf(position, index);
  // Bounds and mean colour of each part.
  const parts = new Map<number, { x0: number; x1: number; y0: number; z0: number; z1: number; r: number; g: number; b: number; n: number }>();
  for (let i = 0; i < count; i++) {
    const root = find(i);
    let p = parts.get(root);
    if (!p) {
      p = { x0: Infinity, x1: -Infinity, y0: Infinity, z0: Infinity, z1: -Infinity, r: 0, g: 0, b: 0, n: 0 };
      parts.set(root, p);
    }
    const x = position[i * 3];
    const y = position[i * 3 + 1];
    const z = position[i * 3 + 2];
    p.x0 = Math.min(p.x0, x);
    p.x1 = Math.max(p.x1, x);
    p.y0 = Math.min(p.y0, y);
    p.z0 = Math.min(p.z0, z);
    p.z1 = Math.max(p.z1, z);
    if (color) {
      p.r += color[i * colorSize];
      p.g += color[i * colorSize + 1];
      p.b += color[i * colorSize + 2];
    }
    p.n++;
  }
  const out = new Float32Array(count * SWAY_STRIDE);
  for (let i = 0; i < count; i++) {
    const p = parts.get(find(i))!;
    const wide = Math.max(p.x1 - p.x0, p.z1 - p.z0) > WIDE;
    const isStill = wide || (color !== null && still(p.r / p.n, p.g / p.n, p.b / p.n));
    const o = i * SWAY_STRIDE;
    out[o] = (p.x0 + p.x1) / 2;
    out[o + 1] = (p.z0 + p.z1) / 2;
    out[o + 2] = p.y0;
    out[o + 3] = isStill ? 0 : 1;
  }
  return out;
}

/**
 * The connected parts of an indexed (or not) mesh: returns each vertex's part
 * id. Faces that share a corner position belong to the same part (flat-shaded
 * models repeat a corner once per face).
 */
export function partsOf(position: ArrayLike<number>, index: ArrayLike<number> | null): (i: number) => number {
  const count = position.length / 3;
  const parent = new Int32Array(count);
  for (let i = 0; i < count; i++) parent[i] = i;
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  const join = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };
  const seen = new Map<string, number>();
  for (let i = 0; i < count; i++) {
    const key = `${Math.round(position[i * 3] * 1000)},${Math.round(position[i * 3 + 1] * 1000)},${Math.round(position[i * 3 + 2] * 1000)}`;
    const first = seen.get(key);
    if (first === undefined) seen.set(key, i);
    else join(i, first);
  }
  const corners = index ? index.length : count;
  for (let t = 0; t + 2 < corners; t += 3) {
    const a = index ? index[t] : t;
    join(a, index ? index[t + 1] : t + 1);
    join(a, index ? index[t + 2] : t + 2);
  }
  return find;
}

/** Per-vertex canopy lump data: the lump's centre (x, y, z) and its turn to open (0 first .. 1 last). */
export const PAD_STRIDE = 4;

/**
 * For a canopy made of separate lumps: each vertex gets its lump's centre and
 * a turn, lowest lump first, so a new stage can open them one after another.
 */
export function padData(position: ArrayLike<number>, index: ArrayLike<number> | null): Float32Array {
  const count = position.length / 3;
  const find = partsOf(position, index);
  const sums = new Map<number, [number, number, number, number]>();
  for (let i = 0; i < count; i++) {
    const r = find(i);
    const s = sums.get(r) ?? [0, 0, 0, 0];
    s[0] += position[i * 3];
    s[1] += position[i * 3 + 1];
    s[2] += position[i * 3 + 2];
    s[3]++;
    sums.set(r, s);
  }
  const roots = [...sums.keys()].sort((a, b) => sums.get(a)![1] / sums.get(a)![3] - sums.get(b)![1] / sums.get(b)![3]);
  const turn = new Map(roots.map((r, k) => [r, roots.length > 1 ? k / (roots.length - 1) : 0]));
  const out = new Float32Array(count * PAD_STRIDE);
  for (let i = 0; i < count; i++) {
    const r = find(i);
    const s = sums.get(r)!;
    out.set([s[0] / s[3], s[1] / s[3], s[2] / s[3], turn.get(r)!], i * PAD_STRIDE);
  }
  return out;
}

/** Brown (more red than green): a trunk. */
export const isTrunk = (r: number, g: number) => r > g;

/** The wind's strength by time of day: a calm day, softer at sunset, almost still at night. */
export const WIND_BY_TIME: Record<TimeOfDay, number> = { day: 1, sunset: 0.65, night: 0.15 };
/** A breeze makes it this much stronger (at its full level). */
export const BREEZE_GAIN = 1.6;
/** With Gentle transitions (comfort) the motion is this much smaller. */
export const GENTLE_FACTOR = 0.45;

/** Wind strength: the time of day's calm, raised by a breeze, lowered by Gentle transitions. */
export function windStrength(time: TimeOfDay, breeze: number, gentle: boolean): number {
  return WIND_BY_TIME[time] * (1 + BREEZE_GAIN * breeze) * (gentle ? GENTLE_FACTOR : 1);
}

/** While breathing, the wind rises with the inhale and settles with the exhale by this much (each way). */
export const BREATH_SWING = 0.25;

/**
 * The garden breathes with you: a factor on the wind from the breath's
 * fullness (0 = empty, 1 = full lungs), weighted by how far into the session
 * it is (0..1, eased in and out), so it starts and ends at 1.
 */
export function breathFactor(fullness: number, weight: number): number {
  return 1 + BREATH_SWING * 2 * (fullness - 0.5) * weight;
}
