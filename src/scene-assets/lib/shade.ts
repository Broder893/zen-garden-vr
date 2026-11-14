import { BufferAttribute, Color, Material, Mesh, MeshStandardMaterial } from '@iwsdk/core';

/**
 * Paints a soft shade into a mesh's vertex colours: full colour from local
 * height y1 up, darkening to `low` times it at y0 and below (where it meets the
 * ground), so it reads as resting there and heavy. Uses the mesh's own vertex
 * colours when it has them; otherwise bakes its material colour into new ones
 * on a copy of the material (vertex colours on, colour white): same look above
 * y1, no extra draw call.
 */
export function shadeToGround(mesh: Mesh, y0: number, y1: number, low: number): void {
  const geo = mesh.geometry;
  const pos = geo.getAttribute('position');
  let col = geo.getAttribute('color') as BufferAttribute | undefined;
  if (!col) {
    const base = (mesh.material as MeshStandardMaterial).color ?? new Color(1, 1, 1);
    const arr = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) base.toArray(arr, i * 3);
    col = new BufferAttribute(arr, 3);
    geo.setAttribute('color', col);
    const mat = (mesh.material as Material).clone() as MeshStandardMaterial;
    mat.vertexColors = true;
    mat.color.setRGB(1, 1, 1);
    mesh.material = mat;
  }
  for (let i = 0; i < pos.count; i++) {
    const t = Math.min(1, Math.max(0, (pos.getY(i) - y0) / (y1 - y0)));
    const k = low + (1 - low) * t * t * (3 - 2 * t);
    col.setXYZ(i, col.getX(i) * k, col.getY(i) * k, col.getZ(i) * k);
  }
  col.needsUpdate = true;
}
