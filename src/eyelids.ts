import { createSystem, Mesh, PlaneGeometry, ShaderMaterial, VisibilityState } from '@iwsdk/core';
import { createEyelidMaterial } from './eyelid-shader.js';

/** The lids' quad: this far in front of the eyes (beyond the near plane), this big. */
const QUAD_DISTANCE = 0.15;
const QUAD_HALF = 0.42;
/** Drawn after everything else in the scene. */
export const EYELID_RENDER_ORDER = 10000;
/** Default time for the lids to close or open (seconds). */
export const LID_SECONDS = 2;

/** Closed at least this long before opening, so changes land unseen. */
const MIN_CLOSED_SECONDS = 0.6;
/** ...and at most this much longer while changes are still arriving. */
const FLUSH_SECONDS = 1.5;

/** Changes that wait for closed eyes (see mayApply). */
export type ChangeKind = 'stage' | 'season' | 'time' | 'weather' | 'unlock';
/**
 * How long each change may wait for closed eyes before it applies anyway,
 * gently (seconds). 0: only while a closure is under way (a breathing session,
 * the entrance); otherwise at once, as the tree's soft growth.
 */
const MAX_WAIT: Record<ChangeKind, number> = { stage: 0, season: 300, time: 300, weather: 120, unlock: 300 };

/** Why the eyes are closed: each owner closes them and lets them open again. */
export type CloseReason = 'session' | 'entrance' | 'return' | 'test';

const smooth = (x: number) => x * x * (3 - 2 * x);

/**
 * Closed-eye transitions. One quad fixed to the headset, in front of the
 * eyes, draws two eyelids (src/eyelid-shader.ts) that close toward the
 * middle with a soft curve, or open again. It is hidden while the eyes are
 * open, so it costs no draw call then; when shown it is drawn last, with no
 * depth test, over the whole garden.
 *
 * Changes to the garden (the tree's stage, season, time of day, weather,
 * unlocks) wait in a queue and land while the eyes are closed: each system
 * asks mayApply() before applying its change. Owners close the eyes with a
 * reason (hold) and release it; the eyes open once every reason is gone, the
 * lids have been closed a moment and the queue is empty.
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
  private clock = 0;
  private closedFor = 0;
  /** Changes waiting for closed eyes, with when each was first asked. */
  readonly pending = new Map<ChangeKind, number>();
  /** Why the eyes are meant to be closed now. */
  readonly reasons = new Set<CloseReason>();

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

  /**
   * Asked by a system before it changes the garden: true when it may apply
   * its change now (eyes closed, or the change has waited long enough, or the
   * eyelids are off); false keeps it in the queue for the next closed eyes.
   */
  mayApply(kind: ChangeKind): boolean {
    if (!this.enabled || this.closed) {
      this.pending.delete(kind);
      return true;
    }
    const closing = this.reasons.size > 0;
    if (!closing && MAX_WAIT[kind] === 0) {
      this.pending.delete(kind);
      return true;
    }
    const first = this.pending.get(kind);
    if (first === undefined) {
      this.pending.set(kind, this.clock);
      return false;
    }
    if (!closing && this.clock - first >= MAX_WAIT[kind]) {
      this.pending.delete(kind);
      return true;
    }
    return false;
  }

  /** Closes the eyes for `reason` (over `seconds`, or at once with 0). */
  hold(reason: CloseReason, seconds = LID_SECONDS): void {
    if (!this.enabled) return;
    this.reasons.add(reason);
    if (seconds <= 0) this.setNow(1);
    else this.close(seconds);
  }

  /** Lets the eyes open again once no other reason keeps them closed. */
  release(reason: CloseReason): void {
    this.reasons.delete(reason);
  }

  update(delta: number): void {
    this.clock += delta;
    this.closedFor = this.closed ? this.closedFor + delta : 0;
    // Every reason gone: open once the lids have been closed a moment and the
    // queued changes have landed (or stopped arriving).
    if (this.reasons.size === 0 && this.to === 1 && (this.closed || this.t >= 1)) {
      const settled = this.pending.size === 0 || this.closedFor >= MIN_CLOSED_SECONDS + FLUSH_SECONDS;
      if (!this.closed || (this.closedFor >= MIN_CLOSED_SECONDS && settled)) this.openEyes();
    }
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
