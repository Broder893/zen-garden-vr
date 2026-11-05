import {
  Color,
  createSystem,
  Entity,
  MeshStandardMaterial,
  Object3D,
  PointLightComponent,
  VisibilityState,
} from '@iwsdk/core';
import { trackFirst, FirstEntity } from './ecs-utils.js';
import { FirstMomentsSystem } from './first-moments.js';
import { Bonsai } from './garden-components.js';
import { MeditationSystem } from './meditation.js';
import { PersistenceSystem } from './persistence.js';
import {
  BREATH_RECOVERY_FACTOR,
  Health,
  HealthState,
  healthOf,
  OVERWATER_DRAIN_SECONDS,
  STRESS_EASE_SECONDS,
  stressFromOverwater,
} from './save/plant-health.js';

/** Stress rises toward its cause this fast (per second), so a mistake shows within seconds. */
const STRESS_RISE = 1 / 5;
/** How far the canopy sinks and leans when fully wilted. */
const DROOP = 0.2;
const LEAN = 0.09;
const STRESSED_LEAF = new Color('#9a9440');
const WILTED_LEAF = new Color('#7a6a45');
const WILTED_FLOWER = new Color('#b9a58f');
const COOL_LIGHT = new Color('#a9b8ff');
const STAGES = ['Sprout', 'Young', 'Mature', 'Flowers'] as const;

interface Tinted {
  mat: MeshStandardMaterial;
  base: Color;
  flower: boolean;
}

/**
 * The tree's health (src/save/plant-health.ts). Eases stress toward its cause
 * (excess water now, wrong cuts later), faster during a breathing session,
 * and shows it in shape and light, not colour alone: the canopy sinks and
 * leans, the leaves fade toward olive and dry brown, the lantern light cools.
 * Nothing negative happens before the first rewarding moment of a first visit.
 */
export class HealthSystem extends createSystem({
  bonsai: { required: [Bonsai] },
}) {
  /** Current health state (read by the guide and the audio). */
  state: HealthState = Health.Healthy;
  /** Displayed wilt, 0..1 (eases toward the stress). */
  wilt = 0;
  /** Sway angle (radians) from the breeze, set by WeatherSystem. */
  sway = 0;
  /** Extra easing of stress and excess water (a breeze dries the soil), set by WeatherSystem. */
  weatherEase = 1;
  /** Times a breathing session brought the tree back to health (this visit). */
  healedByBreath = 0;
  private sessionsSeen = 0;
  private bonsai!: FirstEntity;
  private moments?: FirstMomentsSystem;
  private persistence?: PersistenceSystem;
  private meditation?: MeditationSystem;
  private stages: Object3D[] = [];
  private tinted: Tinted[] = [];
  private bound = new WeakSet<Entity>();
  private lantern: Entity | null = null;
  private lanternBase = new Color();
  private lanternColor = new Color();
  private seasonLeaf: Color | null = null;
  private seasonFlower: Color | null = null;

  init(): void {
    this.bonsai = trackFirst(this.queries.bonsai, this.cleanupFuncs);
    this.cleanupFuncs.push(this.queries.bonsai.subscribe('qualify', (e) => this.bind(e)));
    for (const e of this.queries.bonsai.entities) this.bind(e);
  }

  /**
   * True once mistakes may show: a returning gardener, or after the first
   * visit's first rewarding moment (the tree's first growth).
   */
  get mistakesShow(): boolean {
    // Resolved lazily: these systems are registered after this one.
    this.moments ??= this.world.getSystem(FirstMomentsSystem);
    this.persistence ??= this.world.getSystem(PersistenceSystem);
    return (this.persistence?.returning ?? false) || this.moments?.times.firstGrowth !== undefined;
  }

  update(delta: number): void {
    const b = this.bonsai.entity;
    if (!b) return;
    if (this.world.visibilityState.peek() === VisibilityState.Visible) this.ease(b, delta);
    const stress = b.getValue(Bonsai, 'stress') ?? 0;
    this.state = healthOf(stress);
    this.wilt += (stress - this.wilt) * (1 - Math.exp(-1.5 * delta));
    this.show(this.wilt);
  }

  /** Overwater drains; stress follows its causes, and fades faster while breathing. */
  private ease(b: Entity, delta: number): void {
    let overwater = b.getValue(Bonsai, 'overwater') ?? 0;
    let stress = b.getValue(Bonsai, 'stress') ?? 0;
    if (!this.mistakesShow) {
      // The first minutes stay serene: nothing negative before the first growth.
      if (overwater > 0) b.setValue(Bonsai, 'overwater', 0);
      if (stress > 0) b.setValue(Bonsai, 'stress', 0);
      return;
    }
    this.meditation ??= this.world.getSystem(MeditationSystem);
    const med = this.meditation;
    // Breathing near the tree is its best care: everything eases faster meanwhile...
    const breathing = !!med?.active && !med.paused;
    const k = (breathing ? BREATH_RECOVERY_FACTOR : 1) * this.weatherEase;
    if (overwater > 0) {
      overwater = Math.max(0, overwater - (delta / OVERWATER_DRAIN_SECONDS) * k);
      b.setValue(Bonsai, 'overwater', overwater);
    }
    // ...and a finished session leaves it well again.
    const sessions = (med?.completed ?? 0) + (med?.breaksCompleted ?? 0);
    if (sessions > this.sessionsSeen) {
      this.sessionsSeen = sessions;
      if (stress > 0 || overwater > 0) {
        this.healedByBreath++;
        b.setValue(Bonsai, 'overwater', 0);
        b.setValue(Bonsai, 'stress', 0);
        return;
      }
    }
    const floor = stressFromOverwater(overwater);
    if (stress < floor) stress = Math.min(floor, stress + delta * STRESS_RISE);
    else if (stress > floor) stress = Math.max(floor, stress - (delta / STRESS_EASE_SECONDS) * k);
    b.setValue(Bonsai, 'stress', stress);
  }

  /** Shape, colour and light for a wilt of w (0 healthy .. 1 wilted). */
  private show(w: number): void {
    for (const g of this.stages) {
      // The canopy sinks and leans a little (uniform growth scale lives in x/z).
      g.scale.y = g.scale.x * (1 - DROOP * w);
      // Wilt leans it; a breeze (WeatherSystem) sways it.
      g.rotation.z = LEAN * w + this.sway;
      g.rotation.x = this.sway * 0.5;
    }
    const toStressed = Math.min(1, w / 0.5);
    const toWilted = Math.max(0, (w - 0.5) / 0.5);
    for (const t of this.tinted) {
      if (t.flower) t.mat.color.copy(t.base).lerp(WILTED_FLOWER, w * 0.8);
      else t.mat.color.copy(t.base).lerp(STRESSED_LEAF, toStressed * 0.7).lerp(WILTED_LEAF, toWilted * 0.8);
    }
    this.coolLantern(w);
  }

  private coolLantern(w: number): void {
    if (!this.lantern) {
      this.lantern = this.world.getSceneEntity('lantern-light') ?? null;
      if (!this.lantern) return;
      this.lanternBase.fromArray(this.lantern.getVectorView(PointLightComponent, 'color'));
    }
    this.lanternColor.copy(this.lanternBase).lerp(COOL_LIGHT, 0.45 * w);
    const view = this.lantern.getVectorView(PointLightComponent, 'color');
    view[0] = this.lanternColor.r;
    view[1] = this.lanternColor.g;
    view[2] = this.lanternColor.b;
  }

  /** The season's leaf and blossom colours become the healthy look (src/season.ts). */
  setSeasonColors(leaf: Color, flower: Color): void {
    this.seasonLeaf = leaf;
    this.seasonFlower = flower;
    for (const t of this.tinted) t.base.copy(t.flower ? flower : leaf);
  }

  /** Own the foliage materials (never tint the shared prototype) and find the stage groups. */
  private bind(e: Entity): void {
    if (this.bound.has(e)) return;
    this.bound.add(e);
    const root = e.object3D;
    if (!root) return;
    for (const name of STAGES) {
      const g = root.getObjectByName(name);
      if (g) this.stages.push(g);
    }
    const owned = new Map<MeshStandardMaterial, MeshStandardMaterial>();
    root.traverse((o) => {
      const mesh = o as unknown as { isMesh?: boolean; material: MeshStandardMaterial };
      if (!mesh.isMesh) return;
      const m = mesh.material;
      if (m.name !== 'Leaf' && m.name !== 'Flower') return;
      let mine = owned.get(m);
      if (!mine) {
        mine = m.clone();
        owned.set(m, mine);
        const flower = m.name === 'Flower';
        const season = flower ? this.seasonFlower : this.seasonLeaf;
        this.tinted.push({ mat: mine, base: (season ?? mine.color).clone(), flower });
      }
      mesh.material = mine;
    });
  }
}
