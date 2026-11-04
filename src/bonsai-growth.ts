import { Color, createSystem, Entity, MeshStandardMaterial, Object3D } from '@iwsdk/core';
import { Bonsai, BonsaiStage } from './garden-components.js';

/** Shoots that must be pruned before each stage can grow, by bonsai stage. */
export const SHOOTS_BY_STAGE: Record<number, string[]> = {
  [BonsaiStage.Young]: ['Overgrowth_Young_0', 'Overgrowth_Young_1'],
  [BonsaiStage.Mature]: ['Overgrowth_Mature_0', 'Overgrowth_Mature_1', 'Overgrowth_Mature_2'],
};

const DRY = new Color('#8a6a4c');
const WET = new Color('#2a1c12');

/**
 * Shows the right stage, darkens the soil as it is watered, and advances the
 * stage once it has had its water and every glowing shoot has been cut.
 */
export class BonsaiGrowthSystem extends createSystem({
  bonsai: { required: [Bonsai] },
}) {
  private shownStage = -1;
  private shownMask = -1;
  private pop = 1;
  private parts = new Map<string, Object3D>();
  private soil: MeshStandardMaterial | null = null;

  init(): void {
    const bind = (entity: Entity) => {
      const root = entity.object3D;
      if (!root) return;
      root.traverse((o) => {
        if (/^(Sprout|Young|Mature|Flowers|Overgrowth_\w+_\d)$/.test(o.name)) this.parts.set(o.name, o);
        if (o.name === 'Soil') {
          // Own soil material so darkening it never touches another asset.
          const mesh = o as unknown as { material: MeshStandardMaterial };
          this.soil = mesh.material.clone();
          mesh.material = this.soil;
        }
      });
      this.shownStage = -1;
    };
    this.cleanupFuncs.push(this.queries.bonsai.subscribe('qualify', bind));
    for (const e of this.queries.bonsai.entities) bind(e);
  }

  update(delta: number): void {
    for (const entity of this.queries.bonsai.entities) {
      const stage = entity.getValue(Bonsai, 'stage') ?? 0;
      const water = entity.getValue(Bonsai, 'water') ?? 0;
      const mask = entity.getValue(Bonsai, 'prunedMask') ?? 0;

      if (stage !== this.shownStage || mask !== this.shownMask) {
        if (stage !== this.shownStage && this.shownStage >= 0) this.pop = 0;
        this.applyVisibility(stage, mask);
        this.shownStage = stage;
        this.shownMask = mask;
      }
      if (this.soil) this.soil.color.copy(DRY).lerp(WET, Math.min(1, water));

      if (this.pop < 1) {
        this.pop = Math.min(1, this.pop + delta / 1.2);
        const s = 0.7 + 0.3 * (1 - (1 - this.pop) ** 3);
        this.scaleStage(stage, s);
      }

      if (stage >= BonsaiStage.Blooming || water < 1) continue;
      const shoots = SHOOTS_BY_STAGE[stage] ?? [];
      const allCut = (1 << shoots.length) - 1;
      if ((mask & allCut) !== allCut) continue;
      entity.setValue(Bonsai, 'stage', stage + 1);
      entity.setValue(Bonsai, 'water', 0);
      entity.setValue(Bonsai, 'prunedMask', 0);
    }
  }

  /** World-space shoot objects still to be cut at this stage (for PruningSystem). */
  getShoot(name: string): Object3D | undefined {
    return this.parts.get(name);
  }

  private applyVisibility(stage: number, mask: number): void {
    const set = (name: string, on: boolean) => {
      const o = this.parts.get(name);
      if (o) o.visible = on;
    };
    set('Sprout', stage === BonsaiStage.Sprout);
    set('Young', stage === BonsaiStage.Young);
    set('Mature', stage >= BonsaiStage.Mature);
    set('Flowers', stage === BonsaiStage.Blooming);
    for (const [s, names] of Object.entries(SHOOTS_BY_STAGE)) {
      names.forEach((n, i) => set(n, Number(s) === stage && (mask & (1 << i)) === 0));
    }
  }

  private scaleStage(stage: number, s: number): void {
    const name = stage === BonsaiStage.Sprout ? 'Sprout' : stage === BonsaiStage.Young ? 'Young' : 'Mature';
    this.parts.get(name)?.scale.setScalar(s);
    if (stage === BonsaiStage.Blooming) this.parts.get('Flowers')?.scale.setScalar(s);
  }
}
