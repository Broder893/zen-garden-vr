import {
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  Vector3,
} from '@iwsdk/core';
import { alignSpan, makeRandom } from './lib/hardsurface.js';
import { mergeByMaterial } from './lib/merge.js';

/**
 * The karesansui around the table: a raked sand ground, five mossy rocks, six
 * stepping stones and
 * a bamboo fence behind. Origin on the floor under the table's centre, -Z is
 * away from the player. Everything is plain geometry; the raking is drawn by
 * the ground's shader (no textures). About 3k triangles, 4 draw calls.
 *
 * The ground is one disc wide enough to pass under the whole forest: raked
 * sand in the middle, the season's grass or snow from about 6-8 m out (its
 * material colour, set by SeasonSystem), fading into the sky beyond the hills
 * (DomeFade on the scene node). Nowhere to see the edge of the world.
 */

/** Out past the forest's farthest trunks (13 m) and the foot of its hills (19.5 m). */
const GROUND_RADIUS = 21;
/** The ground disc's material: its colour is the season's (src/season.ts). */
export const GROUND_MATERIAL = 'ground_season';
/**
 * The raked sand in the middle (the material colour is the grass around it): a warm
 * sand, so it reads as sand rather than grey under the sky's violet light.
 */
export const SAND = '#efc788';
/** Sand gives way to the ground between these distances (m), with a wavy edge. */
const SAND_EDGE: [number, number] = [5.6, 8];
/**
 * Rocks: [x, z, radius, sink] in the asset's frame (world z + 0.5), also ringed
 * by the rake pattern. Laid out as a karesansui: a group of three at the back
 * left (one main stone, set deeper; one middle, one small), one stone at the
 * back and one at the right, each at its own distance from the table, none in
 * a row. `sink` is how high the stone's centre sits (times its radius): lower
 * is more buried.
 */
const ROCKS: [number, number, number, number][] = [
  [-1.6, -2.4, 0.5, 0.16],
  [-1.05, -2.7, 0.26, 0.26],
  [-2.05, -1.9, 0.16, 0.24],
  [0.95, -3.25, 0.42, 0.22],
  [2.6, -0.8, 0.3, 0.26],
];
/**
 * Flat stepping stones [x, z, radius]: three from the table's back-left corner
 * toward the stream (level 8), three from the stone basin toward the shared
 * tree. All at least 60 cm from the table, on the sand, out of the hands' way.
 */
const STEPS: [number, number, number][] = [
  [-1.0, -0.78, 0.13],
  [-1.25, -0.95, 0.11],
  [-1.5, -0.8, 0.12],
  [1.15, -0.7, 0.13],
  [1.5, -1.22, 0.12],
  [1.88, -1.75, 0.13],
];
const FENCE_RADIUS = 4.2;

/**
 * Painted ground shadows (no real-time shadows): soft dark patches under what
 * stands on the sand, shifted a little toward the back right as if the light
 * came from the front left. [x, z, radius, strength] in this asset's frame
 * (world z + 0.5). Besides the rocks (ROCKS), the scene's garden lantern
 * (-2.95, 0, -1.55), the shared tree (2.35, 0, -2.9) and the stone basin
 * (0.7, 0, -0.52) of public/scenes/main.iwsdk.scene.json: keep them together.
 */
const SHADOW_SHIFT: [number, number] = [0.6, 0.5];
const SHADOW_BLOBS: [number, number, number, number][] = [
  // Garden lantern (1 m tall, base 0.5 m wide), by the stream's source.
  [-2.95 + 0.08, -1.05 + 0.07, 0.36, 0.5],
  // Shared tree: the canopy's wide shade, and the trunk's contact.
  [2.35 + 0.35, -2.4 + 0.3, 1.25, 0.28],
  [2.35 + 0.03, -2.4 + 0.03, 0.22, 0.45],
  // Stone basin.
  [0.7 + 0.05, -0.02 + 0.05, 0.36, 0.45],
];
/** The table: its top (1.0 x 0.7 m, 0.79 m up) and the four legs' feet. */
const TABLE_HALF: [number, number] = [0.5, 0.35];
const TABLE_SHADE_SHIFT = 0.13;
const TABLE_LEGS: [number, number][] = [[-0.45, -0.3], [0.45, -0.3], [-0.45, 0.3], [0.45, 0.3]];
/**
 * How strong the painted shadows are (1 = clear day). SeasonSystem lowers it
 * at sunset and at night and in winter's soft light. One value shared by every
 * copy of the ground material (DomeFade draws a clone).
 */
export const GROUND_SHADOW = { value: 1 };
const FENCE_HALF_ANGLE = (70 * Math.PI) / 180;
const POLE_SPACING = 0.12;

/**
 * The ground: raked sand in the middle (grooves ringing the centre and each
 * rock), the season's ground colour (material colour) around it.
 */
function rakedSandMaterial(): MeshStandardMaterial {
  const mat = new MeshStandardMaterial({ color: '#4f7f3a', roughness: 1, metalness: 0 });
  mat.name = GROUND_MATERIAL;
  const sand = new Color(SAND);
  const rocks = ROCKS.map(([x, z, r]) => `vec3(${x.toFixed(2)}, ${z.toFixed(2)}, ${r.toFixed(2)})`).join(', ');
  const f = (n: number) => n.toFixed(3);
  const blobs = [
    ...ROCKS.map(([x, z, r]): [number, number, number, number] => [x + SHADOW_SHIFT[0] * r * 0.35, z + SHADOW_SHIFT[1] * r * 0.35, r * 1.3, 0.5]),
    ...SHADOW_BLOBS,
  ];
  const blobList = blobs.map(([x, z, r, k]) => `vec4(${f(x)}, ${f(z)}, ${f(r)}, ${f(k)})`).join(', ');
  const legs = TABLE_LEGS.map(([x, z]) => `vec2(${f(x + 0.02)}, ${f(z + 0.02)})`).join(', ');
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uShadow = GROUND_SHADOW;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vRakePos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRakePos = position.xz;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec2 vRakePos;
const vec3 RAKE_ROCKS[${ROCKS.length}] = vec3[${ROCKS.length}](${rocks});
const vec3 RAKE_SAND = vec3(${sand.r.toFixed(4)}, ${sand.g.toFixed(4)}, ${sand.b.toFixed(4)});
uniform float uShadow;
const vec4 SHADE_BLOBS[${blobs.length}] = vec4[${blobs.length}](${blobList});
const vec2 TABLE_LEGS[4] = vec2[4](${legs});
// Soft painted shadow at p: 0 (none) .. 1 (full).
float paintedShadow(vec2 p) {
  float s = 0.0;
  for (int i = 0; i < ${blobs.length}; i++) {
    float t = length(p - SHADE_BLOBS[i].xy) / SHADE_BLOBS[i].z;
    s = max(s, SHADE_BLOBS[i].w * (1.0 - smoothstep(0.35, 1.0, t)));
  }
  // The table top's shade (a rounded box, soft edged), a little toward the back right.
  vec2 q = abs(p - vec2(${f(SHADOW_SHIFT[0] * TABLE_SHADE_SHIFT)}, ${f(SHADOW_SHIFT[1] * TABLE_SHADE_SHIFT)})) - vec2(${f(TABLE_HALF[0] - 0.05)}, ${f(TABLE_HALF[1] - 0.05)});
  float box = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
  s = max(s, 0.32 * (1.0 - smoothstep(-0.1, 0.18, box)));
  // Darker where each leg meets the sand.
  for (int i = 0; i < 4; i++) s = max(s, 0.5 * (1.0 - smoothstep(0.02, 0.09, length(p - TABLE_LEGS[i]))));
  // Along the foot of the fence, on the garden side.
  float fd = length(p);
  float fa = abs(atan(p.x, -p.y));
  float fence = (1.0 - smoothstep(0.0, 0.35, abs(fd - ${f(FENCE_RADIUS - 0.12)}))) * (1.0 - smoothstep(${f(FENCE_HALF_ANGLE - 0.02)}, ${f(FENCE_HALF_ANGLE + 0.05)}, fa));
  s = max(s, 0.3 * fence);
  return s;
}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
{
  // Ground-plane position (x, z) in the asset's frame.
  vec2 p = vRakePos;
  float d = length(p);
  float ring = d;
  for (int i = 0; i < ${ROCKS.length}; i++) {
    float dr = length(p - RAKE_ROCKS[i].xy) - RAKE_ROCKS[i].z;
    if (dr < 0.9) ring = min(ring, max(dr, 0.0) + 0.02);
  }
  float g = fract(ring / 0.13);
  float groove = smoothstep(0.3, 0.5, g) * (1.0 - smoothstep(0.5, 0.7, g));
  groove *= 1.0 - smoothstep(4.5, 7.5, d);
  // Sand in the middle, the season's ground (diffuseColor) around it; a wavy, soft border.
  float a = atan(p.y, p.x);
  float edge = d + 0.35 * sin(a * 7.0) + 0.2 * sin(a * 13.0 + 1.3);
  float sandMix = 1.0 - smoothstep(${SAND_EDGE[0].toFixed(1)}, ${SAND_EDGE[1].toFixed(1)}, edge);
  diffuseColor.rgb = mix(diffuseColor.rgb, RAKE_SAND * (1.0 - 0.2 * groove), sandMix);
  // Painted shadows, a cool shade rather than grey.
  float sh = paintedShadow(p) * uShadow;
  diffuseColor.rgb *= mix(vec3(1.0), vec3(0.55, 0.56, 0.66), sh);
}`,
      );
  };
  mat.customProgramCacheKey = () => 'zen-raked-sand';
  return mat;
}

function createGround(): Mesh {
  const geo = new CircleGeometry(GROUND_RADIUS, 72);
  geo.rotateX(-Math.PI / 2); // lay it flat: the shader reads position.xz
  const ground = new Mesh(geo, rakedSandMaterial());
  ground.name = 'Ground';
  return ground;
}

/**
 * One low-poly rock: a jittered icosahedron, wider than tall, sunk a little
 * into the sand at (x, z), moss on its upper faces (vertex colours). Non-indexed,
 * one normal per face. Also used by the stream's end rocks (unlocks.scene-asset.ts).
 */
export function rockGeometry(x: number, z: number, r: number, rand: () => number, sink = 0.32): BufferGeometry {
  const stone = new Color('#8c877c');
  const moss = new Color('#6f8a4a');
  const geo = new IcosahedronGeometry(1, 1); // already non-indexed: one normal per face
  const pos = geo.getAttribute('position');
  const v = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    // The same jitter for a shared corner keeps the surface closed: key it on the corner.
    const k = Math.sin(v.x * 12.9898 + v.y * 78.233 + v.z * 37.719 + r * 10) * 43758.5453;
    const j = 0.82 + 0.3 * (k - Math.floor(k));
    v.multiplyScalar(j);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  // Wider than tall, sunk a little into the sand so it sits, not floats.
  geo.scale(r * (1 + rand() * 0.3), r * 0.7, r * (0.85 + rand() * 0.3));
  geo.rotateY(rand() * Math.PI);
  geo.translate(x, r * sink, z);
  geo.computeVertexNormals();
  const colors = new Float32Array(pos.count * 3);
  const c = new Color();
  for (let i = 0; i < pos.count; i += 3) {
    // Per face: moss where it faces the sky; darker toward the sand, where it sits (painted shade).
    const ny = (geo.getAttribute('normal') as BufferAttribute).getY(i);
    c.copy(ny > 0.75 ? moss : stone);
    const cy = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
    const t = Math.min(1, Math.max(0, cy / (r * 0.55)));
    c.multiplyScalar(0.5 + 0.5 * t * t * (3 - 2 * t));
    for (let k2 = 0; k2 < 3; k2++) c.toArray(colors, (i + k2) * 3);
  }
  geo.setAttribute('color', new BufferAttribute(colors, 3));
  return geo;
}

/** Low-poly rocks: jittered icosahedra, flat shaded, moss on their upper faces (vertex colours). */
function createRocks(): Mesh {
  const rand = makeRandom(7);
  const stones = ROCKS.map(([x, z, r, sink]) => rockGeometry(x, z, r, rand, sink));
  // Stepping stones: the same stones, pressed flat into the sand (moss stays on top).
  const steps = STEPS.map(([x, z, r]) => {
    const g = rockGeometry(0, 0, r, rand, 0.2);
    g.scale(1, 0.35, 1);
    g.translate(x, 0, z);
    g.computeVertexNormals();
    return g;
  });
  // The rocks and stepping stones: one mesh, one draw call.
  const merged = mergeGeometries([...stones, ...steps]);
  const rocks = new Mesh(merged, new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }));
  rocks.name = 'Rocks';
  return rocks;
}

/** Concatenates non-indexed geometries with position, normal and color. */
export function mergeGeometries(geos: BufferGeometry[]): BufferGeometry {
  const out = geos[0].clone();
  for (const name of ['position', 'normal', 'color']) {
    const total = geos.reduce((n, g) => n + g.getAttribute(name).array.length, 0);
    const arr = new Float32Array(total);
    let o = 0;
    for (const g of geos) {
      arr.set(g.getAttribute(name).array as Float32Array, o);
      o += g.getAttribute(name).array.length;
    }
    out.setAttribute(name, new BufferAttribute(arr, 3));
  }
  return out;
}

/** A bamboo fence along an arc behind the garden: poles of varied height and two rails. */
function createFence(): Group {
  const rand = makeRandom(21);
  const fence = new Group();
  fence.name = 'BambooFence';
  const bamboo = new MeshStandardMaterial({ color: '#b5a463', roughness: 0.7 });
  const rail = new MeshStandardMaterial({ color: '#6d6136', roughness: 0.8 });
  const arc = FENCE_RADIUS * FENCE_HALF_ANGLE * 2;
  const count = Math.round(arc / POLE_SPACING);
  const at = (a: number, y: number) => new Vector3(Math.sin(a) * FENCE_RADIUS, y, -Math.cos(a) * FENCE_RADIUS);
  for (let i = 0; i <= count; i++) {
    const a = -FENCE_HALF_ANGLE + (i / count) * FENCE_HALF_ANGLE * 2;
    const h = 1.45 + rand() * 0.2;
    const pole = new Mesh(new CylinderGeometry(0.034, 0.038, h, 6), bamboo);
    pole.position.copy(at(a, h / 2));
    fence.add(pole);
  }
  const SEG = 14;
  for (const y of [0.45, 1.15]) {
    for (let i = 0; i < SEG; i++) {
      const a0 = -FENCE_HALF_ANGLE + (i / SEG) * FENCE_HALF_ANGLE * 2;
      const a1 = -FENCE_HALF_ANGLE + ((i + 1) / SEG) * FENCE_HALF_ANGLE * 2;
      const p0 = at(a0, y);
      const p1 = at(a1, y);
      const len = p0.distanceTo(p1);
      const r = new Mesh(new CylinderGeometry(0.022, 0.022, len + 0.02, 6), rail);
      // In front of the poles (toward the garden), so the rail reads against them.
      p0.multiplyScalar(0.99);
      p1.multiplyScalar(0.99);
      p0.y = y;
      p1.y = y;
      alignSpan(r, p0, p1);
      fence.add(r);
    }
  }
  mergeByMaterial(fence);
  return fence;
}

export function createGardenBackdrop(): Group {
  const root = new Group();
  root.name = 'GardenBackdrop';
  root.add(createGround(), createRocks(), createFence());
  return root;
}
