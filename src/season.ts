import { Color, createSystem, Mesh, MeshStandardMaterial } from '@iwsdk/core';
import { HealthSystem } from './health.js';
import { overridesFrom, Season, SEASON_COLORS, seasonFor } from './save/atmosphere.js';

/** The forest's tintable canopy material (public/models/forest.glb). */
const FOREST_LEAF = 'foliage_forest';
/** How often to look for the forest until the level has it (seconds). */
const LOOKUP_SECONDS = 1;

/**
 * The bonsai and the forest follow the real season: fresh green in spring,
 * deep green in summer, red in autumn, a cool green in winter, with matching
 * blossoms; the forest's canopy turns blossom pink, green, rust and frosty
 * white. Only colours: no extra draw calls. ?season= forces one (demos).
 */
export class SeasonSystem extends createSystem({}) {
  season: Season = 'summer';
  /** True once the forest's canopy has the season's colour. */
  forestTinted = false;
  private sinceLookup = LOOKUP_SECONDS;

  init(): void {
    this.season = overridesFrom(window.location.search).season ?? seasonFor(new Date());
    const c = SEASON_COLORS[this.season];
    this.world.getSystem(HealthSystem)?.setSeasonColors(new Color(c.leaf), new Color(c.flower));
  }

  update(delta: number): void {
    if (this.forestTinted) return;
    this.sinceLookup += delta;
    if (this.sinceLookup < LOOKUP_SECONDS) return;
    this.sinceLookup = 0;
    // The forest arrives with the level: tint its canopy once it is there.
    this.world.scene.traverse((o) => {
      const mat = (o as Mesh).isMesh ? ((o as Mesh).material as MeshStandardMaterial) : null;
      if (mat?.name !== FOREST_LEAF) return;
      // Multiplies the canopy's vertex colours (forest_fixed keeps its own, untinted).
      mat.color.set(SEASON_COLORS[this.season].forest);
      this.forestTinted = true;
    });
  }
}
