import { BufferAttribute, BufferGeometry, Material, Matrix4, Mesh, Object3D } from '@iwsdk/core';

/**
 * Replaces every mesh under `group` with one mesh per material, baked into
 * the group's own space. Cuts draw calls for static decorative parts.
 * Only position and normal are kept (enough for untextured materials).
 * Names of the merged meshes are lost: use it only on groups whose
 * children are never looked up by name at runtime.
 */
export function mergeByMaterial(group: Object3D): void {
  group.updateMatrixWorld(true);
  const toGroup = new Matrix4().copy(group.matrixWorld).invert();
  const byMaterial = new Map<Material, BufferGeometry[]>();
  group.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh || Array.isArray(mesh.material)) return;
    const geo = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    geo.applyMatrix4(new Matrix4().multiplyMatrices(toGroup, mesh.matrixWorld));
    const list = byMaterial.get(mesh.material) ?? [];
    list.push(geo);
    byMaterial.set(mesh.material, list);
  });
  for (const child of [...group.children]) group.remove(child);

  let n = 0;
  for (const [material, geos] of byMaterial) {
    const merged = concat(geos);
    for (const g of geos) g.dispose();
    const mesh = new Mesh(merged, material);
    mesh.name = `${group.name}_Merged${n++}`;
    group.add(mesh);
  }
}

function concat(geos: BufferGeometry[]): BufferGeometry {
  let count = 0;
  for (const g of geos) count += g.getAttribute('position').count;
  const pos = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  let offset = 0;
  for (const g of geos) {
    const p = g.getAttribute('position');
    const nAttr = g.getAttribute('normal');
    for (let i = 0; i < p.count; i++) {
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
  out.computeBoundingSphere();
  out.computeBoundingBox();
  return out;
}
