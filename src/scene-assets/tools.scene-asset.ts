import {
  ConeGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Shape,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
} from '@iwsdk/core';
import { alignSpan } from './lib/hardsurface.js';
import { mergeByMaterial } from './lib/merge.js';

/**
 * Invisible, generous grab target so a loose pinch near the tool still grabs
 * it. `visible: false` on the material skips its draw call; the mesh still
 * counts for grabbing and bounds.
 */
const grabVolumeMat = new MeshBasicMaterial({ visible: false });
function grabVolume(radius: number, x: number, y: number, z: number): Mesh {
  const m = new Mesh(new SphereGeometry(radius, 12, 8), grabVolumeMat);
  m.name = 'GrabVolume';
  m.position.set(x, y, z);
  m.userData.iwsdkPreviewBounds = 'exclude';
  return m;
}

const v = (x: number, y: number, z: number) => new Vector3(x, y, z);

const canMat = new MeshStandardMaterial({ color: '#4c8a86', roughness: 0.4, metalness: 0.3 });
const brassMat = new MeshStandardMaterial({ color: '#c89b52', roughness: 0.35, metalness: 0.8 });
const steelMat = new MeshStandardMaterial({ color: '#c9ced4', roughness: 0.25, metalness: 0.9 });
const lacquerMat = new MeshStandardMaterial({ color: '#a8342b', roughness: 0.45 });

function tube(name: string, pts: Vector3[], r0: number, r1: number, mat: MeshStandardMaterial): Group {
  const g = new Group();
  g.name = name;
  const n = pts.length - 1;
  for (let i = 0; i < n; i++) {
    const ra = r0 + ((r1 - r0) * i) / n;
    const rb = r0 + ((r1 - r0) * (i + 1)) / n;
    const m = new Mesh(new CylinderGeometry(rb, ra, pts[i].distanceTo(pts[i + 1]), 10), mat);
    m.name = `${name}_Seg${i}`;
    alignSpan(m, pts[i], pts[i + 1]);
    g.add(m);
    if (i > 0) {
      const k = new Mesh(new SphereGeometry(ra, 10, 8), mat);
      k.name = `${name}_Joint${i}`;
      k.position.copy(pts[i]);
      g.add(k);
    }
  }
  return g;
}

/**
 * Watering can. Origin: base centre, contact y = 0, spout points along +X.
 * Envelope ~0.24 x 0.15 x 0.12 m. Anchor "SpoutTip" marks where water leaves.
 */
export function createWateringCan(): Group {
  const root = new Group();
  root.name = 'WateringCan';
  const profile = [
    [0.001, 0],
    [0.05, 0],
    [0.056, 0.008],
    [0.058, 0.08],
    [0.05, 0.1],
    [0.03, 0.108],
    [0.026, 0.115],
    [0.022, 0.115],
  ].map(([x, y]) => new Vector2(x, y));
  const body = new Mesh(new LatheGeometry(profile, 28), canMat);
  body.name = 'Body';
  root.add(body);
  const band = new Mesh(new CylinderGeometry(0.0585, 0.0585, 0.008, 28), brassMat);
  band.name = 'Band';
  band.position.y = 0.012;
  root.add(band);
  const cap = new Mesh(new CylinderGeometry(0.026, 0.026, 0.006, 20), brassMat);
  cap.name = 'Cap';
  cap.position.y = 0.116;
  root.add(cap);
  const spoutPts = [v(0.045, 0.025, 0), v(0.09, 0.07, 0), v(0.13, 0.115, 0)];
  root.add(tube('Spout', spoutPts, 0.011, 0.006, canMat));
  const rose = new Mesh(new ConeGeometry(0.016, 0.022, 14, 1, true), brassMat);
  rose.name = 'Rose';
  alignSpan(rose, v(0.145, 0.132, 0), v(0.129, 0.114, 0));
  root.add(rose);
  root.add(tube('Handle', [v(-0.02, 0.105, 0), v(-0.05, 0.135, 0), v(-0.08, 0.12, 0), v(-0.085, 0.08, 0), v(-0.055, 0.05, 0)], 0.007, 0.007, brassMat));
  const tip = new Object3D();
  tip.name = 'SpoutTip';
  tip.position.set(0.148, 0.135, 0);
  // One draw call per material instead of one per part (nothing animates them).
  mergeByMaterial(root);
  root.add(tip);
  root.add(grabVolume(0.1, -0.01, 0.07, 0));
  return root;
}

function bladeGeometry(): ExtrudeGeometry {
  // Outline in the XY plane: from the pivot (0,0) out to the tip along +X.
  const s = new Shape();
  s.moveTo(-0.012, -0.006);
  s.lineTo(0.03, -0.007);
  s.quadraticCurveTo(0.07, -0.005, 0.095, 0.0);
  s.quadraticCurveTo(0.06, 0.006, 0.02, 0.01);
  s.lineTo(-0.012, 0.008);
  s.closePath();
  return new ExtrudeGeometry(s, { depth: 0.003, bevelEnabled: true, bevelThickness: 0.0008, bevelSize: 0.0008, bevelSegments: 1 });
}

/**
 * Pruning shears lying flat. Origin: pivot at table contact y = 0,
 * blades point along +X, handles along -X. Envelope ~0.18 x 0.012 x 0.07 m.
 * Anchor "BladeTip" sits between the blades near the cutting edge.
 */
export function createShears(): Group {
  const root = new Group();
  root.name = 'Shears';
  const blade = bladeGeometry();
  for (const [name, yaw, side] of [['BladeUpper', 0.12, 1], ['BladeLower', -0.12, -1]] as const) {
    const pivot = new Group();
    pivot.name = `${name}Arm`;
    pivot.rotation.y = yaw;
    pivot.position.y = side > 0 ? 0.0075 : 0.0035;
    const b = new Mesh(blade, steelMat);
    b.name = name;
    b.rotation.x = -Math.PI / 2;
    b.scale.y = side;
    pivot.add(b);
    const arm = tube(`${name}Handle`, [v(-0.008, 0, 0), v(-0.04, 0, side * 0.012), v(-0.06, 0, side * 0.024)], 0.005, 0.0045, lacquerMat);
    pivot.add(arm);
    const loop = new Mesh(new TorusGeometry(0.02, 0.0055, 8, 20), lacquerMat);
    loop.name = `${name}Loop`;
    loop.rotation.x = Math.PI / 2;
    loop.position.set(-0.078, 0, side * 0.03);
    pivot.add(loop);
    // Each arm swings as one piece: merge it per material (steel, lacquer).
    mergeByMaterial(pivot);
    root.add(pivot);
  }
  const screw = new Mesh(new CylinderGeometry(0.006, 0.006, 0.012, 14), brassMat);
  screw.name = 'PivotScrew';
  screw.position.y = 0.006;
  root.add(screw);
  const tip = new Object3D();
  tip.name = 'BladeTip';
  tip.position.set(0.06, 0.006, 0);
  root.add(tip);
  root.add(grabVolume(0.07, -0.04, 0.01, 0));
  return root;
}
