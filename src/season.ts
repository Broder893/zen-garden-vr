import { Color, createSystem, Mesh, MeshStandardMaterial } from '@iwsdk/core';
import { DayNightSystem } from './day-night.js';
import { EyelidSystem } from './eyelids.js';
import { HealthSystem } from './health.js';
import { GROUND_MATERIAL } from './scene-assets/backdrop.scene-asset.js';
import { overridesFrom, Season, SEASON_COLORS, seasonFor, TimeOfDay } from './save/atmosphere.js';

/** The forest's tintable canopy material (public/models/forest.glb). */
const FOREST_LEAF = 'foliage_forest';
/** Trunks and pines (vertex colours only): authored very dark, lifted to sit with the garden. */
const FOREST_FIXED = 'forest_fixed';
const FIXED_LIFT = 3.2;
/** The canopy tint is multiplied by grey shading (0.33-0.76): lifted so it reads at its colour. */
const LEAF_LIFT = 1.35;
/** The snow's own light follows the daylight, so the canopy does not shine at night. */
const GLOW_BY_TIME: Record<TimeOfDay, number> = { day: 1, sunset: 0.6, night: 0.2 };
/** How often to look for the forest until the level has it (seconds). */
const LOOKUP_SECONDS = 1;
/** How often to check whether the real season has turned (seconds). */
const SEASON_CHECK_SECONDS = 60;

/**
 * The bonsai and the forest follow the real season: fresh green in spring,
 * deep green in summer, red in autumn, a cool green in winter, with matching
 * blossoms; the forest's canopy turns blossom pink, green, rust and frosty
 * white, and the ground around the sand turns fresh green, deep green, brown
 * and snow white. Only colours: no extra draw calls. A season that turns during a
 * visit waits for closed eyes (EyelidSystem). ?season= forces one (demos).
 */
export class SeasonSystem extends createSystem({}) {
  season: Season = 'summer';
  /** True once the forest's canopy and the ground have the season's colour. */
  forestTinted = false;
  private forced = false;
  private forest: MeshStandardMaterial | null = null;
  private fixed: MeshStandardMaterial | null = null;
  /** The ground disc: its shown material is tinted (DomeFade swaps in a clone of it). */
  private ground: Mesh | null = null;
  private sinceLookup = LOOKUP_SECONDS;
  private sinceCheck = 0;
  /** A new season waiting for closed eyes (checked every frame until it lands). */
  private waiting: Season | null = null;
  private lids?: EyelidSystem;
  private dayNight?: DayNightSystem;
  /** The time of day the canopy's glow was set for. */
  private glowTime: TimeOfDay | null = null;

  init(): void {
    const forced = overridesFrom(window.location.search).season;
    this.forced = forced !== undefined;
    this.paint(forced ?? seasonFor(new Date()));
  }

  update(delta: number): void {
    if (!this.forestTinted) this.findForest(delta);
    this.dayNight ??= this.world.getSystem(DayNightSystem);
    const time = this.dayNight?.time ?? 'day';
    if (time !== this.glowTime) {
      this.glowTime = time;
      this.paint(this.season);
    }
    if (this.forced) return;
    this.lids ??= this.world.getSystem(EyelidSystem);
    if (this.waiting) {
      if (this.lids?.mayApply('season') ?? true) {
        this.paint(this.waiting);
        this.waiting = null;
      }
      return;
    }
    this.sinceCheck += delta;
    if (this.sinceCheck < SEASON_CHECK_SECONDS) return;
    this.sinceCheck = 0;
    const now = seasonFor(new Date());
    if (now !== this.season) this.waiting = now;
  }

  private paint(season: Season): void {
    this.season = season;
    const c = SEASON_COLORS[season];
    this.world.getSystem(HealthSystem)?.setSeasonColors(new Color(c.leaf), new Color(c.flower));
    // Multiplies the canopy's vertex colours (forest_fixed keeps its own, untinted).
    if (this.forest) {
      this.forest.color.set(c.forest).multiplyScalar(LEAF_LIFT);
      // Winter: a little light of its own, so the canopy reads as snow, not grey.
      this.forest.emissive.set(c.forest).multiplyScalar(c.forestGlow * GLOW_BY_TIME[this.glowTime ?? 'day']);
    }
    this.fixed?.color.setScalar(FIXED_LIFT);
    (this.ground?.material as MeshStandardMaterial | undefined)?.color.set(c.ground);
  }

  /** The forest and the ground arrive with the level: find their materials once they are there. */
  private findForest(delta: number): void {
    this.sinceLookup += delta;
    if (this.sinceLookup < LOOKUP_SECONDS) return;
    this.sinceLookup = 0;
    this.world.scene.traverse((o) => {
      const mat = (o as Mesh).isMesh ? ((o as Mesh).material as MeshStandardMaterial) : null;
      if (mat?.name === FOREST_LEAF) this.forest = mat;
      if (mat?.name === FOREST_FIXED) this.fixed = mat;
      if (mat?.name === GROUND_MATERIAL) this.ground = o as Mesh;
    });
    this.forestTinted = !!this.forest && !!this.fixed && !!this.ground;
    if (this.forest || this.ground) this.paint(this.season);
  }
}
