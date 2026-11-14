import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  LatheGeometry,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  Vector2,
  Vector3,
} from '@iwsdk/core';
import { mergeGeometries, rockGeometry, SAND } from './backdrop.scene-asset.js';
import { makeRandom } from './lib/hardsurface.js';
import { mergeByMaterial } from './lib/merge.js';

/**
 * Garden unlocks (levels 7 and 8): a small stone lantern and a stream in the
 * sand. Both are parentless prototypes with the origin on the sand (y = 0).
 */

/**
 * Both stone shades in one material: each part carries its shade as a vertex
 * colour, so the merged lantern draws its stone in one call (two lanterns in
 * the garden: two draw calls saved). Dark stone was 0.95 rough, a difference
 * nobody sees on a 7 cm plinth.
 */
const stoneMat = new MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.92, metalness: 0 });
const STONE = new Color('#9b968b');
const STONE_DARK = new Color('#7f7a70');

/** A stone part: the shared stone material, its shade baked into the vertices. */
function stoneMesh(geo: BufferGeometry, shade: Color = STONE): Mesh {
  const n = geo.getAttribute('position').count;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) shade.toArray(c, i * 3);
  geo.setAttribute('color', new BufferAttribute(c, 3));
  return new Mesh(geo, stoneMat);
}
const glow = new MeshStandardMaterial({
  color: '#ffd38a',
  emissive: '#ffb648',
  emissiveIntensity: 1.6,
  roughness: 0.6,
});

/** A six-sided lathe from a (radius, height) profile: reads as cut stone. */
function hexLathe(profile: [number, number][], segments = 6): LatheGeometry {
  return new LatheGeometry(profile.map(([r, y]) => new Vector2(r, y)), segments, Math.PI / 6);
}

/**
 * Stone lantern, ~14 cm tall, ~7 cm wide at the base. Origin at the base
 * centre, +Y up; the glowing firebox windows face every side.
 * Named parts: Base, Post, Firebox (Pillars + Light), Roof, Finial.
 */
export function createStoneLantern(): Group {
  const root = new Group();
  root.name = 'StoneLantern';

  // Base: a stepped hexagonal plinth.
  const base = stoneMesh(
    hexLathe([[0.001, 0], [0.036, 0], [0.036, 0.008], [0.028, 0.012], [0.028, 0.016], [0.001, 0.016]]),
    STONE_DARK,
  );
  base.name = 'Base';
  // Post: slightly waisted, with a collar into the base and the platform above.
  const post = stoneMesh(
    hexLathe([[0.001, 0.016], [0.016, 0.016], [0.013, 0.04], [0.014, 0.058], [0.001, 0.058]]),
  );
  post.name = 'Post';
  // Platform (chudai) carrying the firebox.
  const platform = stoneMesh(
    hexLathe([[0.001, 0.058], [0.018, 0.058], [0.03, 0.066], [0.03, 0.071], [0.001, 0.071]]),
  );
  platform.name = 'Platform';

  // Firebox: six slim pillars around a glowing core; the gaps are the windows.
  const firebox = new Group();
  firebox.name = 'Firebox';
  const pillarGeo = new BoxGeometry(0.008, 0.03, 0.008);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const p = stoneMesh(pillarGeo);
    p.name = `Pillar${i}`;
    p.position.set(Math.cos(a) * 0.021, 0.071 + 0.015, Math.sin(a) * 0.021);
    p.rotation.y = -a;
    firebox.add(p);
  }
  const light = new Mesh(new CylinderGeometry(0.016, 0.016, 0.026, 12), glow);
  light.name = 'Light';
  light.position.y = 0.071 + 0.015;
  firebox.add(light);

  // Roof: wide, low, with eaves that flare upward at the rim.
  const roof = stoneMesh(
    hexLathe([
      [0.001, 0.101], [0.024, 0.101], [0.046, 0.097], [0.05, 0.101],
      [0.044, 0.106], [0.022, 0.118], [0.008, 0.124], [0.001, 0.124],
    ]),
  );
  roof.name = 'Roof';
  // Finial (hoju): a small onion on a neck.
  const finial = stoneMesh(
    new LatheGeometry(
      [[0.001, 0.124], [0.006, 0.124], [0.005, 0.128], [0.009, 0.133], [0.007, 0.139], [0.002, 0.143], [0.001, 0.143]].map(
        ([r, y]) => new Vector2(r, y),
      ),
      10,
    ),
  );
  finial.name = 'Finial';

  root.add(base, post, platform, firebox, roof, finial);
  // Static decor: one mesh per material (stone in two shades, glow).
  mergeByMaterial(root);
  return root;
}

/**
 * The stream (level 8) lies on the garden sand to the player's front left, off
 * the table and well out of reach (scene node "zen-stream"). Its course, in its
 * own frame (origin on the sand): it rises under a rock at the far end, winds
 * toward the player in a soft S and slips under a second rock. About 2.1 m long.
 */
const COURSE = [
  new Vector3(-0.5, 0, -0.65),
  new Vector3(0.2, 0, -0.35),
  new Vector3(-0.05, 0, 0.25),
  new Vector3(0.5, 0, 0.7),
];
/** Water width; the wet bank reaches this far beyond it on each side. */
const STREAM_WIDTH = 0.13;
const BANK = 0.065;
const STREAM_SEGMENTS = 120;
/** Rocks at the source and the mouth: the ribbon's ends start at their centres. */
const SOURCE_ROCK = 0.26;
const MOUTH_ROCK = 0.2;
/** Heights above the sand: bank, water and the drifting highlights (plus polygonOffset). */
const BANK_Y = 0.004;
const WATER_Y = 0.008;
export const DASH_Y = 0.012;
/** Highlights drifting downstream (moved at runtime by the unlocks system). */
export const FLOW_DASHES = 24;

/** The course sampled evenly by length: points and unit directions of flow. */
const COURSE_SAMPLES = 160;
const coursePts: Vector3[] = new CatmullRomCurve3(COURSE, false, 'centripetal').getSpacedPoints(COURSE_SAMPLES);
const courseDirs: Vector3[] = coursePts.map((p, i) => {
  const a = coursePts[Math.max(0, i - 1)];
  const b = coursePts[Math.min(COURSE_SAMPLES, i + 1)];
  return b.clone().sub(a).setY(0).normalize();
});

/** Point on the stream's centre line at t (0 = source, 1 = mouth), written into `out`. */
export function streamPoint(t: number, out: Vector3): Vector3 {
  const f = Math.min(1, Math.max(0, t)) * COURSE_SAMPLES;
  const i = Math.min(COURSE_SAMPLES - 1, Math.floor(f));
  return out.lerpVectors(coursePts[i], coursePts[i + 1], f - i);
}

/** Unit direction of flow at t, written into `out`. */
export function streamTangent(t: number, out: Vector3): Vector3 {
  const f = Math.min(1, Math.max(0, t)) * COURSE_SAMPLES;
  const i = Math.min(COURSE_SAMPLES - 1, Math.floor(f));
  return out.lerpVectors(courseDirs[i], courseDirs[i + 1], f - i).normalize();
}

/**
 * A flat ribbon along the course at height y, facing up: one column of vertices
 * per entry of `across` (offsets from the centre line, as fractions of `half`),
 * coloured by `colors` when given. Non-indexed, so it merges with the rocks.
 */
function ribbon(half: number, y: number, across: number[], colors?: Color[]): BufferGeometry {
  const pos: number[] = [];
  const col: number[] = [];
  const index: number[] = [];
  const p = new Vector3();
  const t = new Vector3();
  const n = across.length;
  for (let i = 0; i <= STREAM_SEGMENTS; i++) {
    const k = i / STREAM_SEGMENTS;
    streamPoint(k, p);
    streamTangent(k, t);
    // A little narrower where it rises and sinks (both ends are under rocks).
    const h = half * (0.75 + 0.25 * Math.min(1, Math.min(k, 1 - k) * 10));
    for (let c = 0; c < n; c++) {
      // Side vector in the sand plane (to the right of the flow).
      pos.push(p.x - t.z * h * across[c], y, p.z + t.x * h * across[c]);
      if (colors) col.push(colors[c].r, colors[c].g, colors[c].b);
    }
    if (i < STREAM_SEGMENTS) {
      for (let c = 0; c < n - 1; c++) {
        const a = i * n + c;
        index.push(a, a + n, a + 1, a + 1, a + n, a + n + 1);
      }
    }
  }
  let g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  if (colors) g.setAttribute('color', new BufferAttribute(new Float32Array(col), 3));
  g.setIndex(index);
  g = g.toNonIndexed();
  g.computeVertexNormals();
  // Face up whichever way the course turns.
  if ((g.getAttribute('normal') as BufferAttribute).getY(0) < 0) {
    const ps = g.getAttribute('position') as BufferAttribute;
    const cs = g.getAttribute('color') as BufferAttribute | undefined;
    for (let i = 0; i < ps.count; i += 3) {
      for (const a of [ps, cs]) {
        if (!a) continue;
        const x = a.getX(i + 1), yy = a.getY(i + 1), z = a.getZ(i + 1);
        a.setXYZ(i + 1, a.getX(i + 2), a.getY(i + 2), a.getZ(i + 2));
        a.setXYZ(i + 2, x, yy, z);
      }
    }
    g.computeVertexNormals();
  }
  return g;
}

/** Small pebbles along both banks, half sunk in the wet sand (vertex colours, flat faces). */
function pebbles(rand: () => number): BufferGeometry[] {
  const shades = ['#8c877c', '#7a756b', '#a39d90', '#6f6a60'].map((h) => new Color(h));
  const out: BufferGeometry[] = [];
  const p = new Vector3();
  const t = new Vector3();
  for (let j = 0; j < 18; j++) {
    const k = 0.14 + 0.72 * rand();
    const side = rand() < 0.5 ? -1 : 1;
    const r = 0.012 + rand() * 0.02;
    const off = STREAM_WIDTH / 2 + r * 0.5 + rand() * 0.035;
    streamPoint(k, p);
    streamTangent(k, t);
    const geo = new IcosahedronGeometry(1, 0);
    geo.scale(r, r * 0.6, r * (0.8 + rand() * 0.4));
    geo.rotateY(rand() * Math.PI);
    geo.translate(p.x - t.z * off * side, r * 0.15, p.z + t.x * off * side);
    geo.computeVertexNormals();
    const c = shades[Math.floor(rand() * shades.length)];
    const colors = new Float32Array(geo.getAttribute('position').count * 3);
    for (let i = 0; i < colors.length; i += 3) c.toArray(colors, i);
    geo.setAttribute('color', new BufferAttribute(colors, 3));
    out.push(geo);
  }
  return out;
}

/**
 * The stream: the bank (wet sand darkening toward the water, pebbles, and the
 * two rocks it rises under and slips beneath, one mesh in vertex colours), the
 * water on top, and FlowDashes, small light streaks the runtime moves
 * downstream. Three draw calls. Origin on the sand near the middle of the course.
 */
export function createStream(): Group {
  const root = new Group();
  root.name = 'Stream';
  const sandEdge = new Color(SAND).multiplyScalar(0.93);
  const damp = new Color('#ae9b76');
  const wet = new Color('#7d6a4b');
  const half = STREAM_WIDTH / 2 + BANK;
  const inner = STREAM_WIDTH / 2 / half;
  const bankRibbon = ribbon(half, BANK_Y, [-1, -0.75, -inner, inner, 0.75, 1], [sandEdge, damp, wet, wet, damp, sandEdge]);
  const rand = makeRandom(11);
  const src = COURSE[0];
  const mouth = COURSE[COURSE.length - 1];
  const parts = [
    bankRibbon,
    ...pebbles(rand),
    rockGeometry(src.x, src.z, SOURCE_ROCK, rand),
    rockGeometry(mouth.x, mouth.z, MOUTH_ROCK, rand),
  ];
  const bank = new Mesh(
    mergeGeometries(parts),
    new MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.95,
      flatShading: true,
      // Lifted a few millimetres and pulled forward in depth: no flicker against the sand.
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -2,
    }),
  );
  bank.name = 'Bank';
  const water = new Mesh(
    ribbon(STREAM_WIDTH / 2, WATER_Y, [-1, 1]),
    new MeshStandardMaterial({
      color: '#5fa9cc',
      emissive: '#1f5873',
      emissiveIntensity: 0.35,
      roughness: 0.12,
      metalness: 0.05,
      transparent: true,
      opacity: 0.88,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -4,
    }),
  );
  water.name = 'Water';
  const dashGeo = new PlaneGeometry(0.035, 0.007);
  dashGeo.rotateX(-Math.PI / 2);
  const dashes = new InstancedMesh(
    dashGeo,
    new MeshBasicMaterial({ color: '#e6f6ff', transparent: true, opacity: 0.55, depthWrite: false, blending: AdditiveBlending }),
    FLOW_DASHES,
  );
  dashes.name = 'FlowDashes';
  dashes.frustumCulled = false;
  dashes.userData.iwsdkPreviewBounds = 'exclude';
  // Spread along the stream so the prototype already looks alive in previews.
  const m = new Matrix4();
  const q = new Quaternion();
  const p = new Vector3();
  const t = new Vector3();
  const one = new Vector3(1, 1, 1);
  for (let i = 0; i < FLOW_DASHES; i++) {
    const k = (i + 0.5) / FLOW_DASHES;
    streamPoint(k, p).setY(DASH_Y);
    streamTangent(k, t);
    q.setFromAxisAngle(new Vector3(0, 1, 0), -Math.atan2(t.z, t.x));
    dashes.setMatrixAt(i, m.compose(p, q, one));
  }
  root.add(bank, water, dashes);
  return root;
}
