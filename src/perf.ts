import {
  CanvasTexture,
  createSystem,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  VisibilityState,
} from '@iwsdk/core';
import { ComfortSystem } from './comfort.js';
import type { Quality } from './save/comfort-settings.js';

/** Measured over windows this long. */
const WINDOW_SECONDS = 4;
/** No judgement in the first seconds of a session (loading and shader warm-up hitches). */
const SETTLE_SECONDS = 10;
/** Auto lowers the quality after two windows in a row below this share of the headset's rate. */
const SLOW_SHARE = 0.85;
/** Low quality: share of fireflies and raindrops kept, and the XR resolution for the next session. */
const LOW_EFFECTS = 0.5;
const LOW_FRAMEBUFFER = 0.8;
/** Scenery hidden in low quality (background only, never something to care for). */
const LOW_HIDDEN = ['Garden Lantern', 'Rocks'];
/** The debug readout redraws this often (seconds). */
const HUD_EVERY = 0.5;

/**
 * Performance and quality. Measures frames per second, applies the visual
 * quality chosen in the Comfort panel (auto, high, low) and, in auto, lowers
 * it once for the rest of the session when the headset cannot keep its frame
 * rate. Low quality halves fireflies and raindrops, hides two background
 * pieces and lowers the XR resolution from the next session. With ?debug a
 * small readout behind the table shows fps, frame time, draw calls and
 * triangles; ?quality=high|low forces a level for tests.
 */
export class PerfSystem extends createSystem({}) {
  /** Average frames per second of the last window (0 until measured). */
  fps = 0;
  /** Worst frame of the last window, in ms. */
  worstMs = 0;
  /** The quality in effect: 'high' or 'low'. */
  level: Exclude<Quality, 'auto'> = 'high';
  /** True once auto lowered the quality: kept for the visit (the device stays as slow). */
  autoLowered = false;
  /** Share of effect particles to draw (1 high, 0.5 low): read by DayNight and Weather. */
  effects = 1;
  private comfort?: ComfortSystem;
  private forced?: Quality;
  private applied: Quality | null = null;
  private frames = 0;
  private elapsed = 0;
  private worst = 0;
  private slowWindows = 0;
  private sessionTime = 0;
  private hud: { ctx: CanvasRenderingContext2D; texture: CanvasTexture } | null = null;
  private sinceHud = HUD_EVERY;
  /** The background pieces low quality hides, found once the level has loaded. */
  private scenery: Object3D[] = [];
  private sinceLookup = 1;

  init(): void {
    const q = new URLSearchParams(window.location.search);
    const forced = q.get('quality');
    if (forced === 'high' || forced === 'low') this.forced = forced;
    if (q.has('debug')) this.createHud();
    this.cleanupFuncs.push(
      this.world.visibilityState.subscribe((state) => {
        // Entering, pausing (system menu) or leaving: measure afresh, so a
        // pause never joins two slow windows or desktop frames into a VR one.
        this.frames = 0;
        this.elapsed = 0;
        this.worst = 0;
        this.slowWindows = 0;
        if (state === VisibilityState.NonImmersive) {
          this.sessionTime = 0;
          // Out of the session the resolution can change: an auto-lowered one applies next time.
          this.apply();
        }
      }),
    );
  }

  update(delta: number): void {
    this.comfort ??= this.world.getSystem(ComfortSystem);
    const chosen = this.chosen;
    if (chosen !== this.applied) {
      // Only a change of the quality choice itself (not other comfort settings) judges afresh.
      if (this.applied !== null) this.autoLowered = false;
      this.applied = chosen;
      this.slowWindows = 0;
      this.apply();
    }
    if (this.scenery.length < LOW_HIDDEN.length) this.findScenery(delta);
    this.measure(delta);
    if (this.hud) {
      this.sinceHud += delta;
      if (this.sinceHud >= HUD_EVERY) {
        this.sinceHud = 0;
        this.drawHud();
      }
    }
  }

  /** The quality the player (or ?quality=) chose. */
  get chosen(): Quality {
    return this.forced ?? this.comfort?.settings.quality ?? 'auto';
  }

  private measure(delta: number): void {
    if (delta <= 0 || delta > 1) return; // paused or a tab switch
    this.frames++;
    this.elapsed += delta;
    if (delta > this.worst) this.worst = delta;
    const inVR = this.world.visibilityState.peek() === VisibilityState.Visible;
    if (inVR) this.sessionTime += delta;
    if (this.elapsed < WINDOW_SECONDS) return;
    this.fps = this.frames / this.elapsed;
    this.worstMs = this.worst * 1000;
    this.frames = 0;
    this.elapsed = 0;
    this.worst = 0;
    if (!inVR || this.chosen !== 'auto' || this.autoLowered || this.sessionTime < SETTLE_SECONDS) return;
    const target = this.world.session?.frameRate ?? 72;
    this.slowWindows = this.fps < target * SLOW_SHARE ? this.slowWindows + 1 : 0;
    if (this.slowWindows >= 2) {
      this.autoLowered = true;
      this.apply();
      console.info(`[zen] ${this.fps.toFixed(0)} fps (target ${target}): lowering visual quality`);
    }
  }

  private apply(): void {
    const chosen = this.chosen;
    this.level = chosen === 'low' || (chosen === 'auto' && this.autoLowered) ? 'low' : 'high';
    const low = this.level === 'low';
    this.effects = low ? LOW_EFFECTS : 1;
    for (const o of this.scenery) o.visible = !low;
    const xr = this.world.renderer.xr;
    // Resolution can only change between sessions; it applies on the next entry.
    if (!xr.isPresenting) xr.setFramebufferScaleFactor(low ? LOW_FRAMEBUFFER : 1);
  }

  /** Looks the background pieces up once a second until the level has them. */
  private findScenery(delta: number): void {
    this.sinceLookup += delta;
    if (this.sinceLookup < 1) return;
    this.sinceLookup = 0;
    const found: Object3D[] = [];
    for (const name of LOW_HIDDEN) {
      const o = this.world.scene.getObjectByName(name);
      if (o) found.push(o);
    }
    if (found.length === LOW_HIDDEN.length) {
      this.scenery = found;
      this.apply();
    }
  }

  private createHud(): void {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const texture = new CanvasTexture(canvas);
    const mesh = new Mesh(
      new PlaneGeometry(0.28, 0.07),
      new MeshBasicMaterial({ map: texture, transparent: true, side: DoubleSide, depthWrite: false }),
    );
    mesh.name = 'DebugHud';
    // Behind the table on the left, tilted toward the seated player.
    mesh.position.set(-0.36, 1.1, -0.9);
    mesh.rotation.set(-0.15, 0.3, 0);
    mesh.renderOrder = 10;
    this.world.createTransformEntity(mesh);
    this.hud = { ctx, texture };
  }

  /** Debug only (?debug), twice a second: the strings it builds are an accepted exception to no allocation in update. */
  private drawHud(): void {
    if (!this.hud) return;
    const { ctx, texture } = this.hud;
    const info = this.world.renderer.info.render;
    const inVR = this.world.visibilityState.peek() === VisibilityState.Visible;
    // In VR one render covers both eyes.
    const calls = inVR ? Math.round(info.calls / 2) : info.calls;
    const tris = inVR ? info.triangles / 2 : info.triangles;
    const auto = this.chosen === 'auto' ? ' (auto)' : '';
    ctx.clearRect(0, 0, 512, 128);
    ctx.fillStyle = 'rgba(10, 8, 16, 0.75)';
    ctx.fillRect(0, 0, 512, 128);
    ctx.fillStyle = this.fps > 0 && this.fps < 60 ? '#ff9a7a' : '#d8ffb0';
    ctx.font = 'bold 40px monospace';
    ctx.fillText(`${this.fps.toFixed(0)} fps  ${this.worstMs.toFixed(1)} ms max`, 16, 50);
    ctx.fillStyle = '#fff6dc';
    ctx.font = '28px monospace';
    ctx.fillText(`${calls} calls/eye  ${(tris / 1000).toFixed(1)}k tris  ${this.level}${auto}`, 16, 104);
    texture.needsUpdate = true;
  }
}
