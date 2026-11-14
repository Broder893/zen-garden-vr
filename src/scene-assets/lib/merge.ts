import { BufferAttribute, BufferGeometry, Material, Matrix4, Mesh, Object3D } from '@iwsdk/core';

/**
 * Replaces the single-material meshes under `group` with one mesh per
 * material, baked into the group's own space. Cuts draw calls for static
 * decorative parts. Only position, normal and (when every part has one)
 * vertex colour are kept (enough for untextured materials); names, visibility and userData of merged meshes are
 * lost, so use it only where those are never needed at runtime. Anything it
 * does not merge (multi-material meshes, empties with children) is kept.
 */
export function mergeByMaterial(group: Object3D): void {
  group.updateMatrixWorld(true);
  const toGroup = new Matrix4().copy(group.matrixWorld).invert();
  const byMaterial = new Map<Material, BufferGeometry[]>();
  const merged: Mesh[] = [];
  group.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh || Array.isArray(mesh.material)) return;
    const geo = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    if (!geo.getAttribute('normal')) geo.computeVertexNormals();
    geo.applyMatrix4(new Matrix4().multiplyMatrices(toGroup, mesh.matrixWorld));
    const list = byMaterial.get(mesh.material) ?? [];
    list.push(geo);
    byMaterial.set(mesh.material, list);
    merged.push(mesh);
  });
  for (const mesh of merged) mesh.removeFromParent();
  pruneEmpty(group);

  let n = 0;
  for (const [material, geos] of byMaterial) {
    const merged = concat(geos);
    for (const g of geos) g.dispose();
    const mesh = new Mesh(merged, material);
    mesh.name = `${group.name}_Merged${n++}`;
    group.add(mesh);
  }
}

/** Removes plain empties left behind once their meshes were merged away. */
function pruneEmpty(node: Object3D): void {
  for (const child of [...node.children]) {
    pruneEmpty(child);
    if (child.children.length === 0 && !(child as Mesh).isMesh && child.type === 'Group') {
      child.removeFromParent();
    }
  }
}

function concat(geos: BufferGeometry[]): BufferGeometry {
  let count = 0;
  for (const g of geos) count += g.getAttribute('position').count;
  const pos = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  // Vertex colours survive when every part has them (several shades, one material).
  const col = geos.every((g) => g.getAttribute('color')) ? new Float32Array(count * 3) : null;
  let offset = 0;
  for (const g of geos) {
    const p = g.getAttribute('position');
    const nAttr = g.getAttribute('normal');
    const cAttr = g.getAttribute('color');
    for (let i = 0; i < p.count; i++) {
      if (col && cAttr) {
        col[(offset + i) * 3] = cAttr.getX(i);
        col[(offset + i) * 3 + 1] = cAttr.getY(i);
        col[(offset + i) * 3 + 2] = cAttr.getZ(i);
      }
      pos[(offset + i) * 3] = p.getX(i);
      pos[(offset + i) * 3 + 1] = p.getY(i);
      pos[(offset + i) * 3 + 2] = p.getZ(i);
      if (nAttr) {
        nor[(offset + i) * 3] = nAttr.getX(i);
        nor[(offset + i) * 3 + 1] = nAttr.getY(i);
        nor[(offset + i) * 3 + 2] = nAttr.getZ(i);
      }
    }
    offset += p.count;
  }
  const out = new BufferGeometry();
  out.setAttribute('position', new BufferAttribute(pos, 3));
  out.setAttribute('normal', new BufferAttribute(nor, 3));
  if (col) out.setAttribute('color', new BufferAttribute(col, 3));
  out.computeBoundingSphere();
  out.computeBoundingBox();
  return out;
}
