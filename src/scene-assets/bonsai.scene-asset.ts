import {
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
  Vector2,
  Vector3,
} from '@iwsdk/core';
import { alignSpan, makeRandom } from './lib/hardsurface.js';
import { mergeByMaterial } from './lib/merge.js';

/**
 * Bonsai in a shallow glazed pot.
 * Origin: pot base centre, contact plane y = 0, +Y up, front faces +Z.
 * Envelope: ~0.23 m wide, up to ~0.37 m tall with overgrowth.
 *
 * Runtime contract (BonsaiSystem toggles visibility by name):
 *   Sprout, Young, Mature  - growth stage groups (one visible at a time)
 *   Flowers                - shown on top of Mature at the final stage
 *   Overgrowth_<Stage>_<n> - wild shoots to prune; each has a child "CutPoint"
 */

const potMat = new MeshStandardMaterial({ color: '#3f5a6b', roughness: 0.35 });
const soilMat = new MeshStandardMaterial({ color: '#3a2a1e', roughness: 1 });
const barkMat = new MeshStandardMaterial({ color: '#5b4330', roughness: 0.9 });
const leafMat = new MeshStandardMaterial({
  color: '#4f8a3c',
  roughness: 0.8,
  flatShading: true,
});
const wildMat = new MeshStandardMaterial({
  color: '#9bd35a',
  emissive: '#c8ff6a',
  emissiveIntensity: 0.35,
  roughness: 0.7,
  flatShading: true,
});
const flowerMat = new MeshStandardMaterial({
  color: '#f6b8cf',
  emissive: '#f6b8cf',
  emissiveIntensity: 0.15,
  roughness: 0.6,
  flatShading: true,
});
// Named so runtime systems can find them (health tints the foliage, never the prototype).
leafMat.name = 'Leaf';
flowerMat.name = 'Flower';
wildMat.name = 'Wild';

const padGeo = new IcosahedronGeometry(1, 1);
const flowerGeo = new IcosahedronGeometry(0.011, 0);
const knuckleGeo = new SphereGeometry(1, 10, 8);

const v = (x: number, y: number, z: number) => new Vector3(x, y, z);

/** Tapered limb through points; spheres at joints so segments read as one form. */
function limb(
  name: string,
  pts: Vector3[],
  r0: number,
  r1: number,
  mat = barkMat,
): Group {
  const g = new Group();
  g.name = name;
  const n = pts.length - 1;
  for (let i = 0; i < n; i++) {
    const ra = r0 + ((r1 - r0) * i) / n;
    const rb = r0 + ((r1 - r0) * (i + 1)) / n;
    const len = pts[i].distanceTo(pts[i + 1]);
    const seg = new Mesh(new CylinderGeometry(rb, ra, len, 8), mat);
    seg.name = `${name}_Seg${i}`;
    alignSpan(seg, pts[i], pts[i + 1]);
    g.add(seg);
    if (i > 0) {
      const k = new Mesh(knuckleGeo, mat);
      k.name = `${name}_Joint${i}`;
      k.position.copy(pts[i]);
      k.scale.setScalar(ra);
      g.add(k);
    }
  }
  return g;
}

function pad(name: string, c: Vector3, s: Vector3, mat = leafMat): Mesh {
  const m = new Mesh(padGeo, mat);
  m.name = name;
  m.position.copy(c);
  m.scale.copy(s);
  return m;
}

function overgrowth(name: string, from: Vector3, to: Vector3): Group {
  const g = new Group();
  g.name = name;
  const mid = from.clone().lerp(to, 0.5).add(v(0, 0.01, 0));
  g.add(limb(`${name}_Shoot`, [from, mid, to], 0.0035, 0.002, wildMat));
  g.add(pad(`${name}_Tuft`, to, v(0.02, 0.014, 0.018), wildMat));
  // The shoot shows and hides as a whole: one draw call instead of four.
  mergeByMaterial(g);
  // Where the shoot leaves the tree, so a different tree model can move it onto its own cut point.
  g.userData.shootBase = [from.x, from.y, from.z];
  const cut = new Object3D();
  cut.name = 'CutPoint';
  cut.position.copy(from.clone().lerp(to, 0.6));
  g.add(cut);
  return g;
}

function createPot(): Group {
  const g = new Group();
  g.name = 'Pot';
  const profile = [
    [0.001, 0],
    [0.085, 0],
    [0.1, 0.008],
    [0.108, 0.046],
    [0.114, 0.054],
    [0.1, 0.056],
    [0.096, 0.048],
    [0.001, 0.048],
  ].map(([x, y]) => new Vector2(x, y));
  const shell = new Mesh(new LatheGeometry(profile, 36), potMat);
  shell.name = 'PotShell';
  g.add(shell);
  const soil = new Mesh(new CylinderGeometry(0.097, 0.097, 0.006, 32), soilMat);
  soil.name = 'Soil';
  soil.position.y = 0.049;
  g.add(soil);
  return g;
}

function createSprout(): Group {
  const g = new Group();
  g.name = 'Sprout';
  g.add(limb('SproutStem', [v(0, 0.05, 0), v(0.002, 0.07, 0), v(0, 0.088, 0)], 0.003, 0.0022));
  g.add(pad('SproutLeafL', v(-0.012, 0.09, 0), v(0.013, 0.003, 0.007)));
  g.add(pad('SproutLeafR', v(0.012, 0.09, 0), v(0.013, 0.003, 0.007)));
  return g;
}

/**
 * A healthy branch (not glowing): cutting it is a mistake. The base stays as a
 * stump; 'Leafy' (the outer twig and its leaf pad) is hidden when it is cut.
 * Its CutPoint sits along the twig, at least 10 cm from every glowing shoot.
 */
function healthyBranch(name: string, from: Vector3, to: Vector3): Group {
  const g = new Group();
  g.name = name;
  const knee = from.clone().lerp(to, 0.3);
  const bend = from.clone().lerp(to, 0.65).add(v(0, 0.006, 0));
  g.add(limb(`${name}_Stump`, [from, knee], 0.0042, 0.0036));
  const leafy = new Group();
  leafy.name = 'Leafy';
  leafy.add(limb(`${name}_Twig`, [knee, bend, to], 0.0036, 0.0022));
  leafy.add(pad(`${name}_Pad`, to, v(0.024, 0.013, 0.021)));
  mergeByMaterial(leafy);
  g.add(leafy);
  // Where and which way it grows, so a different tree model can move and turn it onto its trunk.
  g.userData.branchFrom = [from.x, from.y, from.z];
  g.userData.branchDir = [to.x - from.x, to.y - from.y, to.z - from.z];
  const cut = new Object3D();
  cut.name = 'CutPoint';
  cut.position.copy(from.clone().lerp(to, 0.6));
  g.add(cut);
  return g;
}

function createYoung(): Group {
  const g = new Group();
  g.name = 'Young';
  g.add(limb('YoungTrunk', [v(0, 0.05, 0), v(0.008, 0.1, 0), v(-0.005, 0.14, 0), v(-0.005, 0.155, 0)], 0.01, 0.004));
  g.add(limb('YoungBranch', [v(0.008, 0.1, 0), v(0.03, 0.11, 0.003), v(0.052, 0.117, 0)], 0.0045, 0.003));
  g.add(pad('YoungPadTop', v(-0.005, 0.165, 0), v(0.042, 0.022, 0.036)));
  g.add(pad('YoungPadSide', v(0.06, 0.122, 0), v(0.03, 0.016, 0.028)));
  return g;
}

const MATURE_PADS: [string, Vector3, Vector3][] = [
  ['MaturePadTop', v(0, 0.272, 0), v(0.062, 0.03, 0.055)],
  ['MaturePadLeft', v(-0.09, 0.185, 0.01), v(0.055, 0.025, 0.045)],
  ['MaturePadRight', v(0.095, 0.146, -0.01), v(0.05, 0.022, 0.045)],
  ['MaturePadBack', v(0.035, 0.236, -0.065), v(0.045, 0.022, 0.04)],
];

function createMature(): Group {
  const g = new Group();
  g.name = 'Mature';
  g.add(limb('MatureTrunk', [v(0, 0.05, 0), v(0.016, 0.1, 0.005), v(-0.01, 0.15, 0), v(0.005, 0.2, -0.005), v(0, 0.255, 0)], 0.02, 0.006));
  g.add(limb('MatureBranchLeft', [v(-0.01, 0.15, 0), v(-0.05, 0.165, 0.008), v(-0.082, 0.178, 0.01)], 0.008, 0.004));
  g.add(limb('MatureBranchRight', [v(0.016, 0.1, 0.005), v(0.05, 0.118, 0), v(0.088, 0.138, -0.01)], 0.009, 0.004));
  g.add(limb('MatureBranchBack', [v(0.005, 0.2, -0.005), v(0.02, 0.215, -0.035), v(0.033, 0.228, -0.06)], 0.006, 0.0035));
  for (const [name, c, s] of MATURE_PADS) g.add(pad(name, c, s));
  return g;
}

function createFlowers(): Group {
  const g = new Group();
  g.name = 'Flowers';
  const rand = makeRandom(11);
  let i = 0;
  for (const [, c, s] of MATURE_PADS) {
    for (let k = 0; k < 7; k++) {
      const th = rand() * Math.PI * 2;
      const ph = rand() * 1.1;
      const f = new Mesh(flowerGeo, flowerMat);
      f.name = `Flower${i++}`;
      f.position.set(
        c.x + s.x * 0.95 * Math.sin(ph) * Math.cos(th),
        c.y + s.y * 0.95 * Math.cos(ph),
        c.z + s.z * 0.95 * Math.sin(ph) * Math.sin(th),
      );
      g.add(f);
    }
  }
  return g;
}

export function createBonsai(): Group {
  const root = new Group();
  root.name = 'Bonsai';
  const stages = [createSprout(), createYoung(), createMature(), createFlowers()];
  // Stage groups are only toggled and scaled as a whole: one mesh per material each.
  for (const g of stages) mergeByMaterial(g);
  root.add(createPot(), ...stages);
  root.add(
    overgrowth('Overgrowth_Young_0', v(-0.005, 0.17, 0), v(-0.04, 0.23, 0.04)),
    overgrowth('Overgrowth_Young_1', v(0.06, 0.128, 0), v(0.11, 0.17, 0.03)),
    overgrowth('Overgrowth_Mature_0', v(-0.07, 0.195, 0.02), v(-0.125, 0.27, 0.06)),
    overgrowth('Overgrowth_Mature_1', v(0.085, 0.155, 0), v(0.15, 0.21, 0.05)),
    overgrowth('Overgrowth_Mature_2', v(0.02, 0.285, 0.01), v(0.05, 0.36, 0.04)),
    healthyBranch('Healthy_Young_0', v(-0.002, 0.115, 0), v(-0.05, 0.12, -0.05)),
    healthyBranch('Healthy_Young_1', v(0, 0.08, 0.005), v(-0.045, 0.075, 0.05)),
    healthyBranch('Healthy_Mature_0', v(0.005, 0.2, -0.005), v(-0.045, 0.225, -0.06)),
    healthyBranch('Healthy_Mature_1', v(0.016, 0.1, 0.005), v(0.035, 0.085, 0.065)),
  );
  return root;
}
