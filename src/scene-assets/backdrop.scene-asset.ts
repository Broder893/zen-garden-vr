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
 * The karesansui around the table: a raked sand ground, three mossy rocks and
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
/** The raked sand in the middle (the material colour is the grass around it). */
const SAND = '#d6c7a3';
/** Sand gives way to the ground between these distances (m), with a wavy edge. */
const SAND_EDGE: [number, number] = [5.6, 8];
/** Rocks: [x, z, radius] in the asset's frame (also ringed by the rake pattern). */
const ROCKS: [number, number, number][] = [
  [-1.9, -2.2, 0.42],
  [2.4, -1.8, 0.32],
  [0.9, -3.2, 0.55],
];
const FENCE_RADIUS = 4.2;
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
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vRakePos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRakePos = position.xz;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec2 vRakePos;
const vec3 RAKE_ROCKS[3] = vec3[3](${rocks});
const vec3 RAKE_SAND = vec3(${sand.r.toFixed(4)}, ${sand.g.toFixed(4)}, ${sand.b.toFixed(4)});`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
{
  // Ground-plane position (x, z) in the asset's frame.
  vec2 p = vRakePos;
  float d = length(p);
  float ring = d;
  for (int i = 0; i < 3; i++) {
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

/** Low-poly rocks: jittered icosahedra, flat shaded, moss on their upper faces (vertex colours). */
function createRocks(): Mesh {
  const rand = makeRandom(7);
  const stone = new Color('#8c877c');
  const moss = new Color('#6f8a4a');
  const group = new Group();
  for (const [x, z, r] of ROCKS) {
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
    geo.translate(x, r * 0.32, z);
    geo.computeVertexNormals();
    const colors = new Float32Array(pos.count * 3);
    const c = new Color();
    for (let i = 0; i < pos.count; i += 3) {
      // Per face: moss where it faces the sky.
      const ny = (geo.getAttribute('normal') as BufferAttribute).getY(i);
      c.copy(ny > 0.75 ? moss : stone);
      for (let k2 = 0; k2 < 3; k2++) c.toArray(colors, (i + k2) * 3);
    }
    geo.setAttribute('color', new BufferAttribute(colors, 3));
    group.add(new Mesh(geo));
  }
  const geos = group.children.map((m) => (m as Mesh).geometry);
  const merged = mergeGeometries(geos);
  const rocks = new Mesh(merged, new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }));
  rocks.name = 'Rocks';
  return rocks;
}

/** Concatenates non-indexed geometries with position, normal and color. */
function mergeGeometries(geos: BufferGeometry[]): BufferGeometry {
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
