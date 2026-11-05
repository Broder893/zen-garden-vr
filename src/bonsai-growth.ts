import { Color, createSystem, Entity, MeshStandardMaterial, Object3D, Vector3 } from '@iwsdk/core';
import { trackFirst, FirstEntity } from './ecs-utils.js';
import { Sparkles } from './effects/sparkles.js';
import { Bonsai, BonsaiStage } from './garden-components.js';
import { MeditationSystem } from './meditation.js';
import { stageFor, XP } from './save/growth-levels.js';

const MATURE_SHOOTS = ['Overgrowth_Mature_0', 'Overgrowth_Mature_1', 'Overgrowth_Mature_2'];
/** Glowing shoots to trim at each stage. A blooming tree grows the mature ones back on each return. */
export const SHOOTS_BY_STAGE: Record<number, string[]> = {
  [BonsaiStage.Young]: ['Overgrowth_Young_0', 'Overgrowth_Young_1'],
  [BonsaiStage.Mature]: MATURE_SHOOTS,
  [BonsaiStage.Blooming]: MATURE_SHOOTS,
};
const ALL_SHOOTS = ['Overgrowth_Young_0', 'Overgrowth_Young_1', ...MATURE_SHOOTS];

/** Number of bits set (shoots cut in a mask). */
function bits(mask: number): number {
  let n = 0;
  for (let m = mask; m; m &= m - 1) n++;
  return n;
}

const DRY = new Color('#8a6a4c');
const WET = new Color('#2a1c12');
/** Soil dries back toward the stage's water level over roughly this long. */
const DRY_SECONDS = 45;
/** A blooming tree is cared for: its soil never looks fully dry. */
const BLOOM_MOISTURE = 0.6;

/**
 * Care earns experience and experience grows the tree: planting, filling its
 * water, each trimmed shoot, each breathing session or break add XP (see
 * growth-levels.ts), and the stage follows the XP thresholds. Also shows the
 * right stage, darkens the soil as it is watered, and celebrates growth.
 */
export class BonsaiGrowthSystem extends createSystem({
  bonsai: { required: [Bonsai] },
}) {
  private shownStage = -1;
  private shownMask = -1;
  private pop = 1;
  private parts = new Map<string, Object3D>();
  private soil: MeshStandardMaterial | null = null;
  /** Soil darkness shown, 0 dry .. 1 wet; follows water up fast, dries slowly. */
  private wetness = -1;
  private sparkles!: Sparkles;
  private burstAt = new Vector3();
  private bonsaiRef!: FirstEntity;
  private meditation?: MeditationSystem;
  // Last seen care state, to award XP once per action (null until the first frame).
  private seen = false;
  private lastPlanted = false;
  private lastMask = 0;
  private waterRewarded = false;
  private lastMeditations = 0;
  private lastBreaks = 0;
  /** XP gained by the latest award, and how many awards so far (read by the level badge). */
  lastGain = 0;
  gains = 0;

  init(): void {
    this.bonsaiRef = trackFirst(this.queries.bonsai, this.cleanupFuncs);
    this.sparkles = new Sparkles();
    this.world.createTransformEntity(this.sparkles.mesh);
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
    this.sparkles.update(delta);
    const entity = this.bonsaiRef.entity;
    if (!entity) return;
    this.awardXp(entity);
    const planted = entity.getValue(Bonsai, 'planted') ?? false;
    if (!planted) {
      if (this.shownStage !== -2) this.applyVisibility(-1, 0);
      this.shownStage = -2;
      return;
    }

    // Enough experience: the tree grows (never shrinks), and the new stage starts dry and untrimmed.
    let stage = entity.getValue(Bonsai, 'stage') ?? 0;
    const earned = stageFor(entity.getValue(Bonsai, 'xp') ?? 0);
    if (earned > stage) {
      stage = earned;
      this.wetness = 1; // just watered in full: the soil starts the new stage wet
      entity.setValue(Bonsai, 'stage', stage);
      // A new stage needs its own care; the bloom arrives fully tended
      // (its shoots grow back, and the soil dries, on the next visit).
      const bloom = stage >= BonsaiStage.Blooming;
      entity.setValue(Bonsai, 'water', bloom ? 1 : 0);
      entity.setValue(Bonsai, 'prunedMask', bloom ? (1 << MATURE_SHOOTS.length) - 1 : 0);
    }
    const water = entity.getValue(Bonsai, 'water') ?? 0;
    const mask = entity.getValue(Bonsai, 'prunedMask') ?? 0;

    if (stage !== this.shownStage || mask !== this.shownMask) {
      // -1 means first frame (restored save): show it without ceremony.
      if (stage !== this.shownStage && this.shownStage !== -1) {
        this.pop = 0;
        this.celebrate(entity, stage);
      }
      this.applyVisibility(stage, mask);
      this.shownStage = stage;
      this.shownMask = mask;
    }
    this.updateSoil(delta, stage, water);

    if (this.pop < 1) {
      this.pop = Math.min(1, this.pop + delta / 1.2);
      const s = 0.7 + 0.3 * (1 - (1 - this.pop) ** 3);
      this.scaleStage(stage, s);
    }
  }

  /** Adds XP for each new piece of care since the last frame. */
  private awardXp(entity: Entity): void {
    const planted = entity.getValue(Bonsai, 'planted') ?? false;
    const mask = entity.getValue(Bonsai, 'prunedMask') ?? 0;
    const water = entity.getValue(Bonsai, 'water') ?? 0;
    // Resolved lazily: MeditationSystem is registered after this system.
    this.meditation ??= this.world.getSystem(MeditationSystem);
    const meditations = this.meditation?.completed ?? 0;
    const breaks = this.meditation?.breaksCompleted ?? 0;
    if (!this.seen) {
      // First frame: the restored save is the baseline, not new care.
      this.seen = true;
      this.lastPlanted = planted;
      this.lastMask = mask;
      this.waterRewarded = water >= 1;
      this.lastMeditations = meditations;
      this.lastBreaks = breaks;
      return;
    }
    let gain = 0;
    if (planted && !this.lastPlanted) gain += XP.plant;
    gain += bits(mask & ~this.lastMask) * XP.cut;
    if (water >= 1 && !this.waterRewarded && planted) {
      gain += XP.waterFull;
      this.waterRewarded = true;
    } else if (water < 1) this.waterRewarded = false;
    gain += (meditations - this.lastMeditations) * XP.meditation;
    gain += (breaks - this.lastBreaks) * XP.breathBreak;
    this.lastPlanted = planted;
    this.lastMask = mask;
    this.lastMeditations = meditations;
    this.lastBreaks = breaks;
    if (gain > 0 && planted) {
      entity.setValue(Bonsai, 'xp', (entity.getValue(Bonsai, 'xp') ?? 0) + gain);
      this.lastGain = gain;
      this.gains++;
    }
  }

  private updateSoil(delta: number, stage: number, water: number): void {
    const target = Math.min(1, stage >= BonsaiStage.Blooming ? Math.max(water, BLOOM_MOISTURE) : water);
    if (this.wetness < 0 || target > this.wetness) {
      // Darken quickly while pouring (and start at the saved level).
      this.wetness = this.wetness < 0 ? target : this.wetness + (target - this.wetness) * (1 - Math.exp(-6 * delta));
    } else {
      this.wetness = Math.max(target, this.wetness - delta / DRY_SECONDS);
    }
    if (this.soil) this.soil.color.copy(DRY).lerp(WET, this.wetness);
  }

  /** Sparkles rising from the canopy when the seed sprouts or the tree grows. */
  private celebrate(entity: Entity, stage: number): void {
    const root = entity.object3D;
    if (!root) return;
    root.getWorldPosition(this.burstAt);
    this.burstAt.y += stage === BonsaiStage.Sprout ? 0.06 : 0.16;
    this.sparkles.burst(this.burstAt, stage === BonsaiStage.Blooming ? 40 : 24, stage === BonsaiStage.Sprout ? 0.05 : 0.12);
  }

  /** A small burst of sparkles above the tree (a reward from another system). */
  sparkle(): void {
    for (const e of this.queries.bonsai.entities) {
      e.object3D?.getWorldPosition(this.burstAt);
      this.burstAt.y += 0.16;
      this.sparkles.burst(this.burstAt, 18, 0.1);
      return;
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
    for (const n of ALL_SHOOTS) set(n, false);
    const shoots = SHOOTS_BY_STAGE[stage] ?? [];
    shoots.forEach((n, i) => set(n, (mask & (1 << i)) === 0));
  }

  private scaleStage(stage: number, s: number): void {
    const name = stage === BonsaiStage.Sprout ? 'Sprout' : stage === BonsaiStage.Young ? 'Young' : 'Mature';
    this.parts.get(name)?.scale.setScalar(s);
    if (stage === BonsaiStage.Blooming) this.parts.get('Flowers')?.scale.setScalar(s);
  }
}
