import { Color, createSystem, Entity, MeshStandardMaterial, Vector3 } from '@iwsdk/core';
import { Sparkles } from './effects/sparkles.js';
import { VisitFlower } from './garden-components.js';
import { PersistenceSystem } from './persistence.js';

const MAX_FLOWERS = 7;
const GROW_SECONDS = 2.2;
/** Petal colour per flower, in the order they appear. */
const PETALS = ['#ffd1e3', '#fff4c2', '#c9d8ff', '#ffc9a8', '#e3ccff', '#ffffff', '#ff9fb8'].map(
  (c) => new Color(c),
);

/** Flowers earned after `visits` VR visits: one per return, up to seven. */
export function flowersForVisits(visits: number): number {
  return Math.min(MAX_FLOWERS, Math.max(0, visits - 1));
}

/** True when this visit is the one that grows a new flower. */
export function visitGrowsFlower(visits: number): boolean {
  return flowersForVisits(visits) > flowersForVisits(visits - 1);
}

/**
 * The reward for coming back: each return visit grows one more flower in the
 * sand. The new one rises with a few sparkles when the player enters VR.
 */
export class VisitFlowerSystem extends createSystem({
  flowers: { required: [VisitFlower] },
}) {
  private persistence?: PersistenceSystem;
  private shown = -1;
  /** Grow progress per flower order (index 1..7); 1 = fully grown. */
  private grow = new Float32Array(MAX_FLOWERS + 1).fill(1);
  private sparkles!: Sparkles;
  private at = new Vector3();

  init(): void {
    this.persistence = this.world.getSystem(PersistenceSystem);
    this.sparkles = new Sparkles(24, '#ffe9f2');
    this.world.createTransformEntity(this.sparkles.mesh);
    const bound = new WeakSet<Entity>();
    const bind = (e: Entity) => {
      if (bound.has(e)) return;
      bound.add(e);
      const order = e.getValue(VisitFlower, 'order') ?? 1;
      const petals = e.object3D?.getObjectByName('Petals')?.children[0] as
        | { material: MeshStandardMaterial }
        | undefined;
      if (petals) {
        petals.material = petals.material.clone();
        petals.material.color.copy(PETALS[(order - 1) % PETALS.length]);
      }
      if (e.object3D) e.object3D.visible = order <= this.shown;
    };
    this.cleanupFuncs.push(this.queries.flowers.subscribe('qualify', bind));
    for (const e of this.queries.flowers.entities) bind(e);
  }

  update(delta: number): void {
    this.sparkles.update(delta);
    const count = flowersForVisits(this.persistence?.save.visits ?? 0);
    const firstLook = this.shown < 0;
    if (count !== this.shown) {
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
