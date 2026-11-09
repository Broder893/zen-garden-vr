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
import { heavier, lighter, loadAutoLevel, QUALITY, QualityLevel, storeAutoLevel } from './save/quality.js';

/** Measured over windows this long. */
const WINDOW_SECONDS = 4;
/** No judgement in the first seconds of a session (loading and shader warm-up hitches). */
const SETTLE_SECONDS = 10;
/**
 * The threshold: Auto steps one level lighter after two windows in a row (8 s)
 * below this share of the headset's rate (61 fps at 72 Hz, 76 at 90 Hz).
 */
export const SLOW_SHARE = 0.85;
/**
 * And back up one level (never above its start) after this many windows in a
 * row (60 s) at 97% of the rate or better: one bad stretch is not forever.
 */
const FAST_SHARE = 0.97;
const FAST_WINDOWS = 15;
/**
 * Where Auto starts on a device it has not measured yet: conservative, since
 * the app could never be tried on a real headset. Medium halves the particle
 * effects and renders at 90% resolution; High stays one tap away (Comfort).
 */
const AUTO_START: QualityLevel = 'medium';
/** Scenery hidden in low quality (background only, never something to care for). */
const LOW_HIDDEN = ['Garden Lantern', 'Rocks'];
/** The debug readout redraws this often (seconds). */
const HUD_EVERY = 0.5;

/**
 * Performance and quality. Measures frames per second (the same counter the
 * ?debug readout shows) and applies the visual quality chosen in the Comfort
 * panel: Auto, High, Medium or Low (src/save/quality.ts). In Auto, whenever
 * the headset stays under the threshold (SLOW_SHARE of its frame rate) the
 * quality steps one level lighter, as many times as needed; the level reached
 * is remembered, so the next visit starts there and its lower XR resolution
 * (which can only change between sessions) applies from the start. With
 * ?debug a small readout behind the table shows fps, the worst frame, draw
 * calls, triangles and the level; ?quality=high|medium|low forces one.
 */
export class PerfSystem extends createSystem({}) {
  /** Average frames per second of the last window (0 until measured). */
  fps = 0;
  /** Worst frame of the last window, in ms. */
  worstMs = 0;
  /** The quality in effect. */
  level: QualityLevel = AUTO_START;
  /** Where Auto stands: its start, or lighter after slow windows (remembered between visits). */
  autoLevel: QualityLevel = loadAutoLevel() ?? AUTO_START;
  /** Steps Auto took down during this visit. */
  autoSteps = 0;
  /** Share of effect particles to draw: read by DayNight and Weather. */
  effects = 1;
  private comfort?: ComfortSystem;
  private forced?: Quality;
  private applied: Quality | null = null;
  private frames = 0;
  private elapsed = 0;
  private worst = 0;
  private slowWindows = 0;
  private fastWindows = 0;
  private sessionTime = 0;
  private hud: { ctx: CanvasRenderingContext2D; texture: CanvasTexture } | null = null;
  private sinceHud = HUD_EVERY;
  /** The background pieces low quality hides, found once the level has loaded. */
  private scenery: Object3D[] = [];
  private sinceLookup = 1;

  init(): void {
    const q = new URLSearchParams(window.location.search);
    const forced = q.get('quality');
    if (forced === 'high' || forced === 'medium' || forced === 'low') this.forced = forced;
    if (q.has('debug')) this.createHud();
    this.cleanupFuncs.push(
      this.world.visibilityState.subscribe((state) => {
        // Entering, pausing (system menu) or leaving: measure afresh, so a
        // pause never joins two slow windows or desktop frames into a VR one.
        this.frames = 0;
        this.elapsed = 0;
        this.worst = 0;
        this.slowWindows = 0;
        this.fastWindows = 0;
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
      // Choosing Auto again (not other comfort settings) judges the device afresh.
      if (this.applied !== null && chosen === 'auto') {
        this.autoLevel = AUTO_START;
        storeAutoLevel(null);
      }
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
    if (!inVR || this.chosen !== 'auto' || this.sessionTime < SETTLE_SECONDS) return;
    const target = this.world.session?.frameRate ?? 72;
    this.slowWindows = this.fps < target * SLOW_SHARE ? this.slowWindows + 1 : 0;
    this.fastWindows = this.fps >= target * FAST_SHARE ? this.fastWindows + 1 : 0;
    if (this.fastWindows >= FAST_WINDOWS && this.autoLevel !== AUTO_START && this.autoLevel !== 'high') {
      // Plenty of headroom for a minute: one level back up, toward the start.
      this.fastWindows = 0;
      const from = this.autoLevel;
      this.autoLevel = heavier(from);
      storeAutoLevel(this.autoLevel === AUTO_START ? null : this.autoLevel);
      this.apply();
      console.info(`[zen] ${this.fps.toFixed(0)} fps for a minute: visual quality ${from} -> ${this.autoLevel}`);
      return;
    }
    if (this.slowWindows < 2 || this.autoLevel === 'low') return;
    this.slowWindows = 0;
    this.fastWindows = 0;
    const from = this.autoLevel;
    this.autoLevel = lighter(from);
    this.autoSteps++;
    storeAutoLevel(this.autoLevel);
    this.apply();
    console.info(`[zen] ${this.fps.toFixed(0)} fps (target ${target}): visual quality ${from} -> ${this.autoLevel}`);
  }

  private apply(): void {
    const chosen = this.chosen;
    this.level = chosen === 'auto' ? this.autoLevel : chosen;
    const spec = QUALITY[this.level];
    this.effects = spec.effects;
    for (const o of this.scenery) o.visible = !spec.hideScenery;
    const xr = this.world.renderer.xr;
    // Resolution can only change between sessions; it applies on the next entry.
    if (!xr.isPresenting) xr.setFramebufferScaleFactor(spec.framebuffer);
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
