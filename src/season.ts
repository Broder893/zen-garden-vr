import { Color, createSystem } from '@iwsdk/core';
import { HealthSystem } from './health.js';
import { overridesFrom, Season, SEASON_COLORS, seasonFor } from './save/atmosphere.js';

/**
 * The bonsai follows the real season: fresh green in spring, deep green in
 * summer, red in autumn, a cool green in winter, with matching blossoms.
 * Only colours: no extra draw calls. ?season= forces one (demos).
 */
export class SeasonSystem extends createSystem({}) {
  season: Season = 'summer';

  init(): void {
    this.season = overridesFrom(window.location.search).season ?? seasonFor(new Date());
    const c = SEASON_COLORS[this.season];
    this.world.getSystem(HealthSystem)?.setSeasonColors(new Color(c.leaf), new Color(c.flower));
  }
}
