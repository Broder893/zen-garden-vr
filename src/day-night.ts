import {
  AdditiveBlending,
  createSystem,
  DomeGradient,
  Entity,
  IBLGradient,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  SphereGeometry,
  Vector3,
} from '@iwsdk/core';
import { PerfSystem } from './perf.js';
import { overridesFrom, TimeOfDay, timeOfDayFor } from './save/atmosphere.js';

type RGB = [number, number, number];
type Palette = { sky: RGB; equator: RGB; ground: RGB };
/**
 * Sky (dome) and ambient light (IBL) colours for each time of day, as the scene
 * file writes them; sunset is the authored look of main.iwsdk.scene.json.
 */
const DOME: Record<TimeOfDay, Palette> = {
  day: { sky: [0.36, 0.55, 0.82], equator: [0.78, 0.82, 0.86], ground: [0.3, 0.28, 0.26] },
  sunset: { sky: [0.17, 0.13, 0.32], equator: [0.62, 0.34, 0.24], ground: [0.1, 0.07, 0.09] },
  night: { sky: [0.02, 0.03, 0.1], equator: [0.08, 0.1, 0.2], ground: [0.02, 0.02, 0.03] },
};
const IBL: Record<TimeOfDay, Palette> = {
  day: { sky: [0.64, 0.7, 0.81], equator: [0.72, 0.7, 0.66], ground: [0.33, 0.29, 0.26] },
  sunset: { sky: [0.4, 0.37, 0.56], equator: [0.6, 0.44, 0.38], ground: [0.22, 0.17, 0.17] },
  night: { sky: [0.18, 0.2, 0.34], equator: [0.14, 0.14, 0.22], ground: [0.08, 0.07, 0.09] },
};
/** Garden fireflies by time of day: none by day, a few at sunset, many at night. */
const FIREFLIES: Record<TimeOfDay, number> = { day: 0, sunset: 12, night: 36 };
const MAX_FIREFLIES = 36;
const RECHECK_SECONDS = 30;
/** Hours over which one time of day fades into the next. */
const FADE_HOURS = 1;

/**
 * The garden's sky follows the real clock: a clear day, a golden sunset, a
 * deep night where the lantern glows. Fireflies gather around the garden in
 * the evening. Colours change gradually around the hour boundaries; ?time=
 * forces one look (demos). One draw call for all the fireflies.
 */
export class DayNightSystem extends createSystem({}) {
  time: TimeOfDay = 'sunset';
  private forced?: TimeOfDay;
  private level: Entity | null = null;
  private sinceCheck = RECHECK_SECONDS;
  private flies!: InstancedMesh;
  private seeds = new Float32Array(MAX_FIREFLIES * 4);
  private visibleFlies = 0;
  private perf?: PerfSystem;
  private targetFlies = 0;
  private clock = 0;
  private m = new Matrix4();
  private p = new Vector3();

  init(): void {
    this.forced = overridesFrom(window.location.search).time;
    const mat = new MeshBasicMaterial({ color: '#e8ff9a', transparent: true, opacity: 0.9, depthWrite: false, blending: AdditiveBlending });
    this.flies = new InstancedMesh(new SphereGeometry(0.018, 6, 4), mat, MAX_FIREFLIES);
    this.flies.name = 'GardenFireflies';
    this.flies.frustumCulled = false;
    this.flies.count = 0;
    // Each firefly: an angle and radius around the table, a height and a phase (deterministic).
    for (let i = 0; i < MAX_FIREFLIES; i++) {
      const r = (k: number) => {
        const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
        return x - Math.floor(x);
      };
      this.seeds.set([r(1) * Math.PI * 2, 1.3 + r(2) * 2.6, 0.35 + r(3) * 1.6, r(4) * 100], i * 4);
    }
    this.world.createTransformEntity(this.flies);
  }

  update(delta: number): void {
    this.clock += delta;
    this.sinceCheck += delta;
    if (this.sinceCheck >= RECHECK_SECONDS) {
      this.sinceCheck = 0;
      this.applySky();
    }
    // Fireflies arrive and leave one by one.
    if (this.visibleFlies < this.targetFlies) this.visibleFlies = Math.min(this.targetFlies, this.visibleFlies + delta * 3);
    else if (this.visibleFlies > this.targetFlies) this.visibleFlies = Math.max(this.targetFlies, this.visibleFlies - delta * 3);
    this.drawFlies();
  }

  /** Sets the sky and ambient colours for now, blending near the hour boundaries. */
  private applySky(): void {
    this.level ??= this.world.activeLevel.peek() ?? null;
    const now = new Date();
    this.time = this.forced ?? timeOfDayFor(now);
    // Blend toward the neighbouring look within FADE_HOURS of a boundary (real clock only).
    const h = now.getHours() + now.getMinutes() / 60;
    let other: TimeOfDay = this.time;
    let k = 0;
    if (!this.forced) {
      for (const [edge, before, after] of BOUNDARIES) {
        const d = h - edge;
        if (Math.abs(d) < FADE_HOURS / 2) {
          other = d < 0 ? after : before;
          k = 0.5 - Math.abs(d) / FADE_HOURS;
        }
      }
    }
    this.targetFlies = Math.round(FIREFLIES[this.time] * (1 - k) + FIREFLIES[other] * k);
    const level = this.level;
    if (!level || !level.hasComponent(DomeGradient)) {
      // The level is not ready yet: try again next frame, not in 30 s.
      this.level = null;
      this.sinceCheck = RECHECK_SECONDS;
      return;
    }
    for (const field of ['sky', 'equator', 'ground'] as const) {
      if (level.hasComponent(DomeGradient)) this.blendInto(level.getVectorView(DomeGradient, field), DOME[this.time][field], DOME[other][field], k);
      if (level.hasComponent(IBLGradient)) this.blendInto(level.getVectorView(IBLGradient, field), IBL[this.time][field], IBL[other][field], k);
    }
  }

  private blendInto(view: { [i: number]: number }, from: RGB, to: RGB, k: number): void {
    for (let i = 0; i < 3; i++) view[i] = from[i] + (to[i] - from[i]) * k;
  }

  /** Slow wandering and a soft blink (scale), around the garden but never close to the table. */
  private drawFlies(): void {
    this.perf ??= this.world.getSystem(PerfSystem);
    const shown = this.visibleFlies * (this.perf?.effects ?? 1);
    const n = Math.ceil(shown);
    this.flies.count = n;
    if (n === 0) return;
    const t = this.clock;
    for (let i = 0; i < n; i++) {
      const j = i * 4;
      const ang = this.seeds[j] + Math.sin(t * 0.07 + this.seeds[j + 3]) * 0.4;
      const rad = this.seeds[j + 1] + Math.sin(t * 0.21 + this.seeds[j + 3] * 2) * 0.25;
      this.p.set(Math.sin(ang) * rad, this.seeds[j + 2] + Math.sin(t * 0.5 + this.seeds[j + 3]) * 0.15, -0.5 - Math.cos(ang) * rad);
      // The last one fades in/out while the count changes.
      const fade = i === n - 1 ? shown - (n - 1) : 1;
      const blink = 0.35 + 0.65 * Math.max(0, Math.sin(t * 1.3 + this.seeds[j + 3] * 7));
      const s = blink * fade;
      this.m.makeScale(s, s, s).setPosition(this.p);
      this.flies.setMatrixAt(i, this.m);
    }
    this.flies.instanceMatrix.needsUpdate = true;
  }
}

/** Clock boundaries: [hour, look before, look after]. */
const BOUNDARIES: [number, TimeOfDay, TimeOfDay][] = [
  [6, 'night', 'sunset'],
  [8, 'sunset', 'day'],
  [17, 'day', 'sunset'],
  [20, 'sunset', 'night'],
];
