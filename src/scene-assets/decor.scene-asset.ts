import {
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
} from '@iwsdk/core';
import { mergeByMaterial } from './lib/merge.js';

/**
 * A small flower that grows in the sand, one per return visit.
 * Origin at the sand contact (y = 0). Envelope ~0.06 x 0.09 x 0.06 m.
 * Runtime contract: the "Petals" material is recoloured per placement
 * (VisitFlowerSystem clones it), so petals keep their own mesh.
 */
export function createVisitFlower(): Group {
  const root = new Group();
  root.name = 'VisitFlower';

  const body = new Group();
  body.name = 'Body';
  const stemMat = new MeshStandardMaterial({ color: '#4f7f3a', roughness: 0.8 });
  const stem = new Mesh(new CylinderGeometry(0.0022, 0.003, 0.05, 6), stemMat);
  stem.position.y = 0.025;
  body.add(stem);
  for (const side of [-1, 1]) {
    const leaf = new Mesh(new SphereGeometry(1, 8, 6), stemMat);
    leaf.scale.set(0.012, 0.0025, 0.005);
    leaf.position.set(side * 0.009, 0.014 + (side > 0 ? 0.008 : 0), 0);
    leaf.rotation.z = side * 0.5;
    body.add(leaf);
  }
  const center = new Mesh(
    new SphereGeometry(0.005, 10, 8),
    new MeshStandardMaterial({ color: '#ffd35a', emissive: '#a36a00', emissiveIntensity: 0.4, roughness: 0.6 }),
  );
  center.position.y = 0.053;
  body.add(center);
  mergeByMaterial(body);
  root.add(body);

  const petals = new Group();
  petals.name = 'Petals';
  const petalMat = new MeshStandardMaterial({ color: '#ffffff', roughness: 0.55, emissive: '#ffffff', emissiveIntensity: 0.08 });
  const petalGeo = new SphereGeometry(1, 10, 6);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const p = new Mesh(petalGeo, petalMat);
    p.scale.set(0.0095, 0.0022, 0.0055);
    p.position.set(Math.cos(a) * 0.0095, 0.052, Math.sin(a) * 0.0095);
    p.rotation.y = -a;
    p.rotation.z = 0.25;
    petals.add(p);
  }
  mergeByMaterial(petals);
  root.add(petals);
  // Sized to read from the seat; the root scale is left to the grow animation.
  body.scale.setScalar(1.3);
  petals.scale.setScalar(1.3);
  return root;
}
