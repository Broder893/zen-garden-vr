import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
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

/** The stream's course, in its own frame: x from STREAM_X0 to STREAM_X1, a gentle S in z. */
export const STREAM_X0 = -0.43;
export const STREAM_X1 = 0.34;
const STREAM_WIDTH = 0.045;
const STREAM_SEGMENTS = 48;
/** Highlights drifting downstream (moved at runtime by the unlocks system). */
export const FLOW_DASHES = 14;

/** Point on the stream's centre line at t (0 = source, 1 = mouth), written into `out`. */
export function streamPoint(t: number, out: Vector3): Vector3 {
  const x = STREAM_X0 + (STREAM_X1 - STREAM_X0) * t;
  return out.set(x, 0, -0.03 * Math.cos((x * Math.PI) / 0.5));
}

/** Unit direction of flow at t, written into `out`. */
export function streamTangent(t: number, out: Vector3): Vector3 {
  const x = STREAM_X0 + (STREAM_X1 - STREAM_X0) * t;
  const dz = 0.03 * Math.sin((x * Math.PI) / 0.5) * (Math.PI / 0.5);
  return out.set(1, 0, dz).normalize();
}

/** A flat ribbon along the stream, `width` wide, lifted `y` above the sand. */
function ribbon(width: number, y: number): BufferGeometry {
  const pos: number[] = [];
  const index: number[] = [];
  const p = new Vector3();
  const t = new Vector3();
  for (let i = 0; i <= STREAM_SEGMENTS; i++) {
    const k = i / STREAM_SEGMENTS;
    streamPoint(k, p);
    streamTangent(k, t);
    // Side vector in the sand plane; ends taper so the stream springs up and sinks away.
    const taper = Math.min(1, Math.min(k, 1 - k) * 12);
    const half = (width / 2) * (0.35 + 0.65 * taper);
    const sx = -t.z * half;
    const sz = t.x * half;
    pos.push(p.x - sx, y, p.z - sz, p.x + sx, y, p.z + sz);
    if (i < STREAM_SEGMENTS) {
      const j = i * 2;
      // Counter-clockwise seen from above: the ribbon faces up.
      index.push(j, j + 1, j + 2, j + 1, j + 3, j + 2);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

/**
 * A narrow stream lying on the sand: a pale wet-sand bank, the water on top,
 * and FlowDashes, small light streaks the runtime moves downstream.
 * Origin on the sand at the stream's middle; it spans x -0.43..0.34, z ±0.03.
 */
export function createStream(): Group {
  const root = new Group();
  root.name = 'Stream';
  const bank = new Mesh(ribbon(STREAM_WIDTH + 0.014, 0.0015), new MeshStandardMaterial({ color: '#c9bea6', roughness: 1, side: DoubleSide }));
  bank.name = 'Bank';
  const water = new Mesh(
    ribbon(STREAM_WIDTH, 0.003),
    new MeshStandardMaterial({
      color: '#5fa9cc',
      emissive: '#1f5873',
      emissiveIntensity: 0.35,
      roughness: 0.12,
      metalness: 0.05,
      transparent: true,
      opacity: 0.88,
      // Flat decals on the sand: visible whichever way the ribbon was wound.
      side: DoubleSide,
    }),
  );
  water.name = 'Water';
  const dashGeo = new PlaneGeometry(0.014, 0.0028);
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
    streamPoint(k, p).setY(0.0045);
    streamTangent(k, t);
    q.setFromAxisAngle(new Vector3(0, 1, 0), -Math.atan2(t.z, t.x));
    dashes.setMatrixAt(i, m.compose(p, q, one));
  }
  root.add(bank, water, dashes);
  return root;
}
