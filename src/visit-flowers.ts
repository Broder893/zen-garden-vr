import { Color, createSystem, Entity, InstancedMesh, Matrix4, Mesh, Object3D, Vector3 } from '@iwsdk/core';
import { Sparkles } from './effects/sparkles.js';
import { VisitFlower } from './garden-components.js';
import { EntranceSystem } from './entrance.js';
import { PersistenceSystem } from './persistence.js';
import { flowersForVisits } from './save/garden-save.js';

const MAX_FLOWERS = 7;
const GROW_SECONDS = 2.2;
/** Petal colour per flower, in the order they appear. */
const PETALS = ['#ffd1e3', '#fff4c2', '#c9d8ff', '#ffc9a8', '#e3ccff', '#ffffff', '#ff9fb8'].map(
  (c) => new Color(c),
);

/** One part of the flower model (stem and leaves, centre, petals), drawn for every flower at once. */
interface Part {
  mesh: InstancedMesh;
  /** The part's matrix relative to the flower's root. */
  local: Matrix4;
}

/**
 * The reward for coming back: each return visit grows one more flower in the
 * sand. The new one rises with a few sparkles when the player enters VR.
 *
 * The scene places the seven flowers (VisitFlower entities); this system draws
 * them all as one instanced mesh per part, with each flower's petal colour per
 * instance: 3 draw calls however many flowers have grown.
 */
export class VisitFlowerSystem extends createSystem({
  flowers: { required: [VisitFlower] },
}) {
  private persistence?: PersistenceSystem;
  private entrance?: EntranceSystem;
  private shown = -1;
  /** Grow progress per flower order (index 1..7); 1 = fully grown. */
  private grow = new Float32Array(MAX_FLOWERS + 1).fill(1);
  /** The placed flower roots by order (index 1..7). */
  private roots: (Object3D | null)[] = new Array(MAX_FLOWERS + 1).fill(null);
  private parts: Part[] = [];
  private dirty = true;
  private sparkles!: Sparkles;
  private at = new Vector3();
  private m = new Matrix4();
  private s = new Matrix4();

  init(): void {
    this.persistence = this.world.getSystem(PersistenceSystem);
    this.entrance = this.world.getSystem(EntranceSystem);
    this.sparkles = new Sparkles(24, '#ffe9f2');
    this.world.createTransformEntity(this.sparkles.mesh);
    const bound = new WeakSet<Entity>();
    const bind = (e: Entity) => {
      const root = e.object3D;
      if (bound.has(e) || !root) return;
      bound.add(e);
      const order = e.getValue(VisitFlower, 'order') ?? 1;
      if (order < 1 || order > MAX_FLOWERS) return;
      if (this.parts.length === 0) this.buildParts(root);
      // The placed copy only marks the spot: the instanced parts draw it.
      root.traverse((o) => {
        if ((o as Mesh).isMesh) o.visible = false;
      });
      this.roots[order] = root;
      this.dirty = true;
    };
    this.cleanupFuncs.push(this.queries.flowers.subscribe('qualify', bind));
    for (const e of this.queries.flowers.entities) bind(e);
  }

  update(delta: number): void {
    this.sparkles.update(delta);
    const count = flowersForVisits(this.persistence?.save.visits ?? 0);
    const firstLook = this.shown < 0;
    // A new flower waits for the lights to warm up, so its moment is seen.
    const ready = firstLook || (this.entrance?.lit ?? true);
    if (count !== this.shown && ready) {
      // Flowers from earlier visits are simply there; a new one grows in.
      for (let order = 1; order <= MAX_FLOWERS; order++) {
        const root = this.roots[order];
        if (firstLook || !root || order <= this.shown || order > count) continue;
        this.grow[order] = 0;
        root.getWorldPosition(this.at);
        this.at.y += 0.05;
        this.sparkles.burst(this.at, 18, 0.05);
      }
      this.shown = count;
      this.dirty = true;
    }
    for (let order = 1; order <= MAX_FLOWERS; order++) {
      if (this.grow[order] >= 1) continue;
      this.grow[order] = Math.min(1, this.grow[order] + delta / GROW_SECONDS);
      this.dirty = true;
    }
    if (this.dirty) this.draw();
  }

  /** One instanced mesh per part of the flower model, sharing its geometry and material. */
  private buildParts(root: Object3D): void {
    root.updateWorldMatrix(true, true);
    const inverse = new Matrix4().copy(root.matrixWorld).invert();
    root.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh) return;
      const inst = new InstancedMesh(mesh.geometry, mesh.material, MAX_FLOWERS);
      inst.name = `VisitFlowers_${mesh.name}`;
      inst.count = 0;
      inst.visible = false;
      // Petals: white material, tinted per flower.
      let petals = false;
      for (let p: Object3D | null = mesh; p && p !== root; p = p.parent) if (p.name === 'Petals') petals = true;
      if (petals) for (let i = 0; i < MAX_FLOWERS; i++) inst.setColorAt(i, PETALS[i % PETALS.length]);
      this.world.createTransformEntity(inst);
      this.parts.push({ mesh: inst, local: new Matrix4().multiplyMatrices(inverse, mesh.matrixWorld) });
    });
  }

  /** Writes every shown flower (grown to its current size) into the instanced parts. */
  private draw(): void {
    this.dirty = false;
    const n = Math.max(0, this.shown);
    for (const part of this.parts) {
      let i = 0;
      for (let order = 1; order <= n; order++) {
        const root = this.roots[order];
        if (!root) continue;
        root.updateWorldMatrix(true, false);
        const g = Math.max(0.001, 1 - (1 - this.grow[order]) ** 3);
        this.m.multiplyMatrices(root.matrixWorld, this.s.makeScale(g, g, g)).multiply(part.local);
        part.mesh.setMatrixAt(i, this.m);
        // The instance keeps its flower's petal colour whatever its slot.
        if (part.mesh.instanceColor) part.mesh.setColorAt(i, PETALS[(order - 1) % PETALS.length]);
        i++;
      }
      part.mesh.count = i;
      part.mesh.visible = i > 0;
      part.mesh.instanceMatrix.needsUpdate = true;
      if (part.mesh.instanceColor) part.mesh.instanceColor.needsUpdate = true;
      part.mesh.computeBoundingSphere();
    }
  }
}
