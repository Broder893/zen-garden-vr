import {
  CircleGeometry,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  Vector2,
  Vector3,
} from '@iwsdk/core';
import { alignSpan, makeRandom } from './lib/hardsurface.js';
import { mergeByMaterial } from './lib/merge.js';

/**
 * The shared tree (point 8): a large garden tree every visitor cares for
 * together, and the stone basin by the table whose water feeds it.
 */

const bark = new MeshStandardMaterial({ color: '#5b4636', roughness: 0.9, flatShading: true });
const leaf = new MeshStandardMaterial({
  color: '#6a9a55',
  emissive: '#9fe07a',
  emissiveIntensity: 0,
  roughness: 0.85,
  flatShading: true,
});
leaf.name = 'SharedLeaf';
const blossom = new MeshStandardMaterial({
  color: '#f6bfd0',
  emissive: '#f08aa8',
  emissiveIntensity: 0.15,
  roughness: 0.7,
  flatShading: true,
});
blossom.name = 'SharedBlossom';
const stone = new MeshStandardMaterial({ color: '#8f8a80', roughness: 0.95, flatShading: true });
const bamboo = new MeshStandardMaterial({ color: '#a9b35a', roughness: 0.6 });
const water = new MeshStandardMaterial({
  color: '#5f9fc8',
  emissive: '#7cc8ff',
  emissiveIntensity: 0.15,
  roughness: 0.1,
  metalness: 0.1,
});
water.name = 'BasinWater';

const v = (x: number, y: number, z: number) => new Vector3(x, y, z);

/** Tapered limb through `pts`: one cylinder per span, a ball at each bend. */
function limb(pts: Vector3[], r0: number, r1: number, parent: Group): void {
  const n = pts.length - 1;
  for (let i = 0; i < n; i++) {
    const ra = r0 + ((r1 - r0) * i) / n;
    const rb = r0 + ((r1 - r0) * (i + 1)) / n;
    const seg = new Mesh(new CylinderGeometry(rb, ra, pts[i].distanceTo(pts[i + 1]), 9), bark);
    alignSpan(seg, pts[i], pts[i + 1]);
    parent.add(seg);
    if (i > 0) {
      const knot = new Mesh(new IcosahedronGeometry(ra * 1.02, 1), bark);
      knot.position.copy(pts[i]);
      parent.add(knot);
    }
  }
}

/** A leafy clump: a squashed low-poly ball. */
function clump(at: Vector3, r: number, parent: Group, mat = leaf, detail = 1): void {
  const m = new Mesh(new IcosahedronGeometry(r, detail), mat);
  m.position.copy(at);
  m.scale.set(1, 0.72, 1);
  parent.add(m);
}

/** Branch tips: [end point, clump radius]. The canopy is about 2.4 m wide. */
const TIPS: [Vector3, number][] = [
  [v(0.95, 2.15, 0.1), 0.55],
  [v(-0.85, 2.05, 0.25), 0.52],
  [v(0.2, 2.25, 0.85), 0.5],
  [v(-0.15, 2.2, -0.85), 0.5],
  [v(0.55, 2.55, -0.45), 0.48],
  [v(-0.45, 2.6, -0.2), 0.5],
];
/** Clumps that fill the gaps when the tree has had care today. */
const FILL: [Vector3, number][] = [
  [v(0.05, 2.75, 0.1), 0.55],
  [v(0.7, 2.3, 0.6), 0.42],
  [v(-0.7, 2.3, -0.6), 0.42],
  [v(-0.75, 2.35, 0.75), 0.4],
  [v(0.85, 2.4, -0.7), 0.4],
  [v(0.0, 2.05, 0.0), 0.5],
];

/**
 * Shared tree, about 3.2 m tall and 2.6 m wide. Origin at the foot of the
 * trunk on the ground, +Y up. Named groups the app shows by today's care:
 * Trunk (always), CanopyCore (always), CanopyFull (after the first cares),
 * Blossom_0 and Blossom_1 (more cares). Each group is merged per material.
 */
export function createSharedTree(): Group {
  const root = new Group();
  root.name = 'SharedTree';

  const trunk = new Group();
  trunk.name = 'Trunk';
  // Root flare into the ground, then a gently bending trunk.
  const flare = new Mesh(new CylinderGeometry(0.15, 0.27, 0.28, 9), bark);
  flare.position.y = 0.14;
  trunk.add(flare);
  const spine = [v(0, 0.2, 0), v(0.06, 0.8, 0.02), v(-0.04, 1.35, 0.06), v(0.05, 1.85, 0)];
  limb(spine, 0.16, 0.08, trunk);
  for (const [tip] of TIPS) {
    const from = spine[2].clone().lerp(spine[3], tip.y > 2.4 ? 1 : 0.4);
    const mid = from.clone().lerp(tip, 0.55).add(v(0, 0.12, 0));
    limb([from, mid, tip.clone().multiplyScalar(0.92)], 0.07, 0.025, trunk);
  }
  mergeByMaterial(trunk);
  root.add(trunk);

  const core = new Group();
  core.name = 'CanopyCore';
  for (const [at, r] of TIPS) clump(at, r, core);
  mergeByMaterial(core);
  root.add(core);

  const full = new Group();
  full.name = 'CanopyFull';
  for (const [at, r] of FILL) clump(at, r, full);
  mergeByMaterial(full);
  root.add(full);

  // Blossoms sit on the outside of the canopy, in two waves.
  const rand = makeRandom(8);
  const all = [...TIPS, ...FILL];
  for (let wave = 0; wave < 2; wave++) {
    const g = new Group();
    g.name = `Blossom_${wave}`;
    for (let i = 0; i < 34; i++) {
      const [c, r] = all[Math.floor(rand() * all.length)];
      const theta = rand() * Math.PI * 2;
      const phi = Math.acos(1 - rand() * 1.4); // mostly the upper and outer surface
      const dir = v(Math.sin(phi) * Math.cos(theta), Math.cos(phi) * 0.72, Math.sin(phi) * Math.sin(theta));
      clump(c.clone().addScaledVector(dir, r * 0.98), 0.1 + rand() * 0.06, g, blossom, 0);
    }
    mergeByMaterial(g);
    root.add(g);
  }
  return root;
}

/**
 * Stone water basin on a pedestal, with a bamboo pipe that fills it. Stands on
 * the floor beside the table: origin at the floor under the basin centre,
 * water surface at y = 0.785 (just above the 0.77 m table top), radius 0.108.
 * Named parts: Stone, Kakei (bamboo post and pipe), Water (its glow is animated).
 */
export function createStoneBasin(): Group {
  const root = new Group();
  root.name = 'StoneBasin';
  const body = new Group();
  body.name = 'Stone';
  const profile: [number, number][] = [
    [0.001, 0],
    [0.13, 0],
    [0.12, 0.05],
    [0.095, 0.1],
    [0.085, 0.6],
    [0.11, 0.7],
    [0.165, 0.73],
    [0.17, 0.795],
    [0.15, 0.805],
    [0.112, 0.8],
    [0.105, 0.76],
    [0.001, 0.755],
  ];
  body.add(new Mesh(new LatheGeometry(profile.map(([r, y]) => new Vector2(r, y)), 8), stone));
  mergeByMaterial(body);
  root.add(body);

  const kakei = new Group();
  kakei.name = 'Kakei';
  // A bamboo post behind the basin and a pipe angled down over the water.
  const post = new Mesh(new CylinderGeometry(0.018, 0.02, 0.98, 10), bamboo);
  post.position.set(0, 0.49, -0.24);
  kakei.add(post);
  const pipe = new Mesh(new CylinderGeometry(0.012, 0.012, 1, 10), bamboo);
  alignSpan(pipe, v(0, 0.95, -0.24), v(0, 0.86, -0.07));
  pipe.scale.y = v(0, 0.95, -0.24).distanceTo(v(0, 0.86, -0.07));
  kakei.add(pipe);
  mergeByMaterial(kakei);
  root.add(kakei);

  const surface = new Mesh(new CircleGeometry(0.108, 20), water);
  surface.name = 'Water';
  surface.rotation.x = -Math.PI / 2;
  surface.position.y = 0.785;
  root.add(surface);
  return root;
}
