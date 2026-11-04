import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
} from '@iwsdk/core';

/**
 * Low wooden garden table with a sand-colored tray on top.
 * Origin: center of the table top surface at floor-height 0 (legs reach y=0,
 * top surface at y=TABLE_HEIGHT). Light: ~60 triangles-ish primitives.
 */
export const TABLE_HEIGHT = 0.75;
const W = 1.0;
const D = 0.7;
const TOP_T = 0.04;

const wood = new MeshStandardMaterial({ color: '#7a5a3c', roughness: 0.75 });
const sand = new MeshStandardMaterial({ color: '#e6dcc3', roughness: 0.95 });
const rim = new MeshStandardMaterial({ color: '#4d3826', roughness: 0.7 });

export function createZenTable(): Group {
  const root = new Group();

  const top = new Mesh(new BoxGeometry(W, TOP_T, D), wood);
  top.position.y = TABLE_HEIGHT - TOP_T / 2;
  root.add(top);

  // Sand tray inset in the table top.
  const tray = new Mesh(new BoxGeometry(W - 0.14, 0.02, D - 0.14), sand);
  tray.position.y = TABLE_HEIGHT + 0.01 - 0.0;
  root.add(tray);

  // Tray border (four thin boxes).
  const b = 0.02;
  const bh = 0.03;
  const iw = W - 0.14;
  const id = D - 0.14;
  const borders: [number, number, number, number][] = [
    [0, (id + b) / 2, iw + 2 * b, b],
    [0, -(id + b) / 2, iw + 2 * b, b],
    [(iw + b) / 2, 0, b, id],
    [-(iw + b) / 2, 0, b, id],
  ];
  for (const [x, z, sx, sz] of borders) {
    const m = new Mesh(new BoxGeometry(sx, bh, sz), rim);
    m.position.set(x, TABLE_HEIGHT + bh / 2, z);
    root.add(m);
  }

  const legGeo = new CylinderGeometry(0.03, 0.025, TABLE_HEIGHT - TOP_T, 10);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = new Mesh(legGeo, wood);
      leg.position.set(
        sx * (W / 2 - 0.06),
        (TABLE_HEIGHT - TOP_T) / 2,
        sz * (D / 2 - 0.06),
      );
      root.add(leg);
    }
  }
  return root;
}
