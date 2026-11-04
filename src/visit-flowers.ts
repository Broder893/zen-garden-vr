import { Color, createSystem, Entity, Mesh, MeshStandardMaterial, Vector3 } from '@iwsdk/core';
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

/**
 * The reward for coming back: each return visit grows one more flower in the
 * sand. The new one rises with a few sparkles when the player enters VR.
 */
export class VisitFlowerSystem extends createSystem({
  flowers: { required: [VisitFlower] },
}) {
  private persistence?: PersistenceSystem;
  private entrance?: EntranceSystem;
  private shown = -1;
  /** Grow progress per flower order (index 1..7); 1 = fully grown. */
  private grow = new Float32Array(MAX_FLOWERS + 1).fill(1);
  private sparkles!: Sparkles;
  private at = new Vector3();

  init(): void {
    this.persistence = this.world.getSystem(PersistenceSystem);
    this.entrance = this.world.getSystem(EntranceSystem);
    this.sparkles = new Sparkles(24, '#ffe9f2');
    this.world.createTransformEntity(this.sparkles.mesh);
    const bound = new WeakSet<Entity>();
    const bind = (e: Entity) => {
      if (bound.has(e)) return;
      bound.add(e);
      const order = e.getValue(VisitFlower, 'order') ?? 1;
      // Recolour every petal mesh with its own material clone.
      e.object3D?.getObjectByName('Petals')?.traverse((o) => {
        const mesh = o as Mesh;
        if (!mesh.isMesh || Array.isArray(mesh.material)) return;
        const mat = (mesh.material as MeshStandardMaterial).clone();
        mat.color.copy(PETALS[(order - 1) % PETALS.length]);
        mesh.material = mat;
      });
      if (e.object3D) e.object3D.visible = order <= this.shown;
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
      for (const e of this.queries.flowers.entities) {
        const order = e.getValue(VisitFlower, 'order') ?? 1;
        const obj = e.object3D;
        if (!obj) continue;
        obj.visible = order <= count;
        // Flowers from earlier visits are simply there; a new one grows in.
        if (!firstLook && order > this.shown && order <= count) {
          this.grow[order] = 0;
          obj.getWorldPosition(this.at);
          this.at.y += 0.05;
          this.sparkles.burst(this.at, 18, 0.05);
        }
      }
      this.shown = count;
    }
    for (const e of this.queries.flowers.entities) {
      const order = e.getValue(VisitFlower, 'order') ?? 1;
      if (this.grow[order] >= 1) continue;
      this.grow[order] = Math.min(1, this.grow[order] + delta / GROW_SECONDS);
      const k = this.grow[order];
      e.object3D?.scale.setScalar(Math.max(0.001, 1 - (1 - k) ** 3));
    }
  }
}
