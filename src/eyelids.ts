import { createSystem, Mesh, PlaneGeometry, ShaderMaterial, VisibilityState } from '@iwsdk/core';
import { createEyelidMaterial } from './eyelid-shader.js';

/** The lids' quad: this far in front of the eyes (beyond the near plane), this big. */
const QUAD_DISTANCE = 0.15;
const QUAD_HALF = 0.42;
/** Drawn after everything else in the scene. */
export const EYELID_RENDER_ORDER = 10000;
/** Default time for the lids to close or open (seconds). */
export const LID_SECONDS = 2;

const smooth = (x: number) => x * x * (3 - 2 * x);

/**
 * Closed-eye transitions. One quad fixed to the headset, in front of the
 * eyes, draws two eyelids (src/eyelid-shader.ts) that close toward the
 * middle with a soft curve, or open again. It is hidden while the eyes are
 * open, so it costs no draw call then; when shown it is drawn last, with no
 * depth test, over the whole garden.
 * ?lids=off turns the eyelids off (they never show; changes apply at once).
 */
export class EyelidSystem extends createSystem({}) {
  /** Shown closure, 0 open .. 1 closed. */
  amount = 0;
  /** False with ?lids=off: the eyelids never show. */
  enabled = true;
  private from = 0;
  private to = 0;
  private t = 1;
  private seconds = LID_SECONDS;
  private mesh!: Mesh;
  private mat!: ShaderMaterial;

  init(): void {
    this.enabled = new URLSearchParams(window.location.search).get('lids') !== 'off';
    this.mat = createEyelidMaterial(QUAD_HALF / QUAD_DISTANCE);
    this.mesh = new Mesh(new PlaneGeometry(QUAD_HALF * 2, QUAD_HALF * 2), this.mat);
    this.mesh.name = 'Eyelids';
    this.mesh.position.set(0, 0, -QUAD_DISTANCE);
    this.mesh.renderOrder = EYELID_RENDER_ORDER;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.world.createTransformEntity(this.mesh, { parent: this.world.playerHeadEntity, persistent: true });
    this.cleanupFuncs.push(
      this.world.visibilityState.subscribe((state) => {
        // Never leave anyone in the dark: losing focus opens the eyes at once.
        if (state !== VisibilityState.Visible) this.setNow(0);
      }),
    );
  }

  /** True once the lids are (all but) fully closed. */
  get closed(): boolean {
    return this.amount >= 0.98;
  }

  /** True while the lids are fully open and not moving. */
  get open(): boolean {
    return this.amount <= 0 && this.to === 0;
  }

  /** Closes the eyes over `seconds`. */
  close(seconds = LID_SECONDS): void {
    this.moveTo(1, seconds);
  }

  /** Opens the eyes over `seconds`. */
  openEyes(seconds = LID_SECONDS): void {
    this.moveTo(0, seconds);
  }

  /** Jumps to a closure at once (0 open, 1 closed). */
  setNow(amount: number): void {
    this.from = this.to = this.amount = this.enabled ? amount : 0;
    this.t = 1;
    this.show();
  }

  update(delta: number): void {
    if (this.t < 1) {
      this.t = Math.min(1, this.t + delta / this.seconds);
      this.amount = this.from + (this.to - this.from) * smooth(this.t);
    }
    this.show();
  }

  private moveTo(target: number, seconds: number): void {
    if (!this.enabled) target = 0;
    if (target === this.to && this.t < 1) return;
    this.from = this.amount;
    this.to = target;
    this.seconds = Math.max(0.05, seconds * Math.abs(target - this.amount));
    this.t = 0;
  }

  private show(): void {
    this.mesh.visible = this.amount > 0.001;
    this.mat.uniforms.uAmount.value = this.amount;
  }
}
