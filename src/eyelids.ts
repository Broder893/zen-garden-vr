import { ChangeKind, ChangeQueue, EyesNow } from './change-queue.js';
import {
  createSystem,
  Material,
  Mesh,
  Object3D,
  PlaneGeometry,
  ShaderMaterial,
  UIKit,
  UIKitMLAsset,
  Vector3,
  Vector4,
  VisibilityState,
} from '@iwsdk/core';
import { ComfortSystem } from './comfort.js';
import { createEyelidMaterial } from './eyelid-shader.js';
import { MeditationSystem } from './meditation.js';
import { OpenHandDetector } from './open-hand.js';

/** The lids' quad: this far in front of the eyes (beyond the near plane), this big. */
const QUAD_DISTANCE = 0.15;
const QUAD_HALF = 0.42;
/** Drawn after everything else in the scene; what must stay readable is drawn after it. */
export const EYELID_RENDER_ORDER = 10000;
/** Default time for the lids to close or open (seconds). */
export const LID_SECONDS = 2;
/** "Gentle transitions" (Comfort): a plain fade, this much slower. */
const FADE_SLOWER = 1.5;
/** Closed at least this long before opening, so changes land unseen. */
const MIN_CLOSED_SECONDS = 0.6;
/** ...and at most this much longer while changes are still arriving. */
const FLUSH_SECONDS = 1.5;
/** A session: the lids start closing this long after "Close your eyes" begins. */
const CLOSE_DELAY = 1.5;
/** ...and stay closed this long into its end, while its rewards land. */
const OUTRO_HOLD = 0.8;
/** Never more than this in the dark with nothing to follow (no breathing light). */
const MAX_DARK_SECONDS = 10;
/** Ways out: an open hand held this long, or a look at the ring of light this long. */
const OPEN_HAND_SECONDS = 0.4;
const RING_AFTER = 1;
const RING_DWELL = 2;
/**
 * The ring: fixed in the room, straight ahead and 25 degrees above the
 * horizon, where the player was facing when the eyes closed. The breathing
 * light is at eye level and the tree below, so only a deliberate look up
 * reaches it; looked at within about 8 degrees.
 */
const RING_DISTANCE = 0.6;
const RING_UP = (25 * Math.PI) / 180;
const RING_CONE_TAN = Math.tan((8 * Math.PI) / 180);
/** Opening when the player asks for it: quicker. */
const ESCAPE_SECONDS = 1;

export type { ChangeKind } from './change-queue.js';

/** Why the eyes are closed: each owner closes them and lets them open again. */
export type CloseReason = 'session' | 'entrance' | 'return' | 'test';
const REASONS: readonly CloseReason[] = ['session', 'entrance', 'return', 'test'];

const smooth = (x: number) => x * x * (3 - 2 * x);

/** A UIKit panel root or a mesh lifted above the lids while they show. */
interface Above {
  ui?: UIKit.Component;
  meshes?: Mesh[];
  orders?: number[];
  depth?: boolean[];
}

/**
 * Closed-eye transitions. One quad fixed to the headset, in front of the
 * eyes, draws two eyelids (src/eyelid-shader.ts) that close toward the
 * middle with a soft curve, or open again. It is hidden while the eyes are
 * open, so it costs no draw call then; when shown it is drawn last, with no
 * depth test, over the whole garden. The subtitles, the breathing light and
 * its card stay above it: seen through closed eyes.
 *
 * Changes to the garden (the tree's stage, season, time of day, weather,
 * unlocks) wait in a queue and land while the eyes are closed: each system
 * asks mayApply() before applying its change. Owners close the eyes with a
 * reason (hold) and release it; the eyes open once every reason is gone, the
 * lids have been closed a moment and the queue is empty.
 *
 * A breathing session (the stone, or a break) closes the eyes after "Close
 * your eyes", keeps them closed through the breaths, lets its rewards land,
 * then opens them with "Open your eyes" and a bell. The entrance and coming
 * back start with closed eyes. Always a way out: an open hand, or a steady
 * look at a small ring of light, opens them at once; never more than 10 s
 * of darkness with nothing to follow; losing focus opens them.
 * ?lids=off turns the eyelids off (they never show; changes apply at once).
 */
export class EyelidSystem extends createSystem({}) {
  /** Shown closure, 0 open .. 1 closed. */
  amount = 0;
  /** False with ?lids=off: the eyelids never show. */
  enabled = true;
  /** Changes waiting for closed eyes (src/change-queue.ts). */
  private readonly queue = new ChangeQueue();
  /** Changes waiting for closed eyes, with when each was first asked. */
  readonly pending = this.queue.pending;
  /** Scratch for mayApply (no allocation per call). */
  private eyesNow: EyesNow = { clock: 0, closedOrOff: false, closing: false };
  /** Why the eyes are meant to be closed now. */
  readonly reasons = new Set<CloseReason>();
  /** True from a session's end (eyes still closed) until they are open: "Open your eyes". */
  sessionEnding = false;
  /** Increments when the eyes open after a session (the audio rings the bell). */
  reopenings = 0;
  /** Increments when the player opened the eyes (hand, look, or the darkness limit). */
  escapes = 0;
  private from = 0;
  private to = 0;
  private t = 1;
  private seconds = LID_SECONDS;
  private mesh!: Mesh;
  private mat!: ShaderMaterial;
  private clock = 0;
  private closedFor = 0;
  /** Closed with nothing to follow (no breathing session): capped at MAX_DARK_SECONDS. */
  private darkFor = 0;
  private timers: Record<CloseReason, number> = { session: 0, entrance: 0, return: 0, test: 0 };
  private meditation?: MeditationSystem;
  private comfort?: ComfortSystem;
  private sessionClock = 0;
  private outroClock = 0;
  /** The player opened the eyes during this session: they stay open until it ends. */
  private dismissed = false;
  private openHand!: OpenHandDetector;
  private openHandTime = 0;
  private ring = new Vector3();
  private ringPlaced = false;
  private ringProgress = 0;
  private ringAlpha = 0;
  private local = new Vector3();
  private above: Above[] = [];
  private lifted = false;
  private lastPhase = 'idle';

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
    this.openHand = new OpenHandDetector(this.renderer.xr, this.player, this.player.head, (side) => this.comfort?.usesHand(side) ?? true);
    this.findAbove();
    this.cleanupFuncs.push(
      this.world.visibilityState.subscribe((state) => {
        if (state === VisibilityState.Visible) return;
        // Never leave anyone in the dark: losing focus opens the eyes at once.
        this.reasons.clear();
        this.sessionEnding = false;
        this.setNow(0);
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
    this.moveTo(1, seconds * this.slower);
  }

  /** Opens the eyes over `seconds`. */
  openEyes(seconds = LID_SECONDS): void {
    this.moveTo(0, seconds * this.slower);
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
    this.eyesNow.clock = this.clock;
    this.eyesNow.closedOrOff = !this.enabled || this.closed;
    this.eyesNow.closing = this.reasons.size > 0;
    return this.queue.mayApply(kind, this.eyesNow);
  }

  /** Closes the eyes for `reason` (over `seconds`, or at once with 0). */
  hold(reason: CloseReason, seconds = LID_SECONDS): void {
    if (!this.enabled) return;
    this.reasons.add(reason);
    this.timers[reason] = 0;
    if (seconds <= 0) this.setNow(1);
    else this.close(seconds);
  }

  /** Closes the eyes at once for `reason` and lets them open after `seconds` (entrance, coming back). */
  holdFor(reason: CloseReason, seconds: number): void {
    this.hold(reason, 0);
    this.timers[reason] = seconds;
  }

  /** Lets the eyes open again once no other reason keeps them closed. */
  release(reason: CloseReason): void {
    this.reasons.delete(reason);
    this.timers[reason] = 0;
  }

  /** The player asked to see: open now, and keep them open for the rest of this session. */
  openNow(): void {
    if (this.amount <= 0) return;
    this.reasons.clear();
    this.dismissed = this.meditation?.active ?? false;
    this.sessionEnding = false;
    this.escapes++;
    this.moveTo(0, ESCAPE_SECONDS);
  }

  update(delta: number): void {
    this.clock += delta;
    this.comfort ??= this.world.getSystem(ComfortSystem);
    this.meditation ??= this.world.getSystem(MeditationSystem);
    this.mat.uniforms.uMode.value = this.gentle ? 1 : 0;
    this.closedFor = this.closed ? this.closedFor + delta : 0;
    this.darkFor = this.closed && !this.reasons.has('session') && !this.sessionEnding ? this.darkFor + delta : 0;
    for (const r of REASONS) {
      if (this.timers[r] <= 0) continue;
      this.timers[r] -= delta;
      if (this.timers[r] <= 0) this.release(r);
    }
    this.followSession(delta);
    this.waysOut(delta);
    // Every reason gone: open once the lids have been closed a moment and the
    // queued changes have landed (or stopped arriving).
    if (this.reasons.size === 0 && this.to === 1 && (this.closed || this.t >= 1)) {
      const settled = this.pending.size === 0 || this.closedFor >= MIN_CLOSED_SECONDS + FLUSH_SECONDS;
      if (!this.closed || (this.closedFor >= MIN_CLOSED_SECONDS && settled)) {
        if (this.sessionEnding) this.reopenings++;
        this.openEyes();
      }
    }
    if (this.t < 1) {
      this.t = Math.min(1, this.t + delta / this.seconds);
      this.amount = this.from + (this.to - this.from) * smooth(this.t);
    }
    if (this.sessionEnding && this.amount <= 0 && this.to === 0) this.sessionEnding = false;
    this.show();
  }

  private get gentle(): boolean {
    return this.comfort?.settings.softTransitions ?? false;
  }

  private get slower(): number {
    return this.gentle ? FADE_SLOWER : 1;
  }

  /** A breathing session closes the eyes after its first words and opens them at its end. */
  private followSession(delta: number): void {
    const med = this.meditation;
    const phase = med?.phase ?? 'idle';
    if (phase === 'intro' && this.lastPhase !== 'intro') {
      // A new session: count from its first words, and the eyes may close again.
      this.sessionClock = 0;
      this.dismissed = false;
    }
    this.lastPhase = phase;
    if (!med || phase === 'idle') {
      if (this.reasons.has('session')) this.release('session');
      this.dismissed = false;
      this.outroClock = 0;
      return;
    }
    if (phase === 'outro') {
      this.outroClock += delta;
      if (this.reasons.has('session')) {
        // Its rewards (water, a new stage, an unlock) land unseen, then the eyes open.
        this.sessionEnding = true;
        if (this.outroClock >= OUTRO_HOLD) this.release('session');
      }
      return;
    }
    this.outroClock = 0;
    this.sessionClock += delta;
    const want = !med.paused && !this.dismissed && (phase !== 'intro' || this.sessionClock >= CLOSE_DELAY);
    if (want && !this.reasons.has('session')) this.hold('session');
    else if (!want && this.reasons.has('session')) this.release('session');
  }

  /** An open hand, a steady look at the ring, or too long in the dark: open now. */
  private waysOut(delta: number): void {
    const shut = this.to === 1 && this.amount > 0.6;
    if (!shut) {
      this.openHandTime = 0;
      this.ringPlaced = false;
      this.ringProgress = 0;
      this.ringAlpha = 0;
      this.setRing(0, 0, 0, 0);
      return;
    }
    this.openHandTime = this.openHand.shown() ? this.openHandTime + delta : 0;
    if (this.openHandTime >= OPEN_HAND_SECONDS) return this.openNow();
    // With nothing to follow (no breathing light), never more than a few seconds of dark.
    if (this.darkFor >= MAX_DARK_SECONDS) return this.openNow();
    if (this.closedFor < RING_AFTER) return;
    if (!this.ringPlaced) {
      // Fixed in the room: ahead (where the player faces) and up.
      this.ringPlaced = true;
      this.player.head.getWorldPosition(this.ring);
      // getWorldDirection gives the head's +Z axis: it looks along -Z.
      this.player.head.getWorldDirection(this.local).negate();
      this.local.y = 0;
      if (this.local.lengthSq() < 1e-6) this.local.set(0, 0, -1);
      this.local.normalize();
      this.ring.addScaledVector(this.local, RING_DISTANCE * Math.cos(RING_UP));
      this.ring.y += RING_DISTANCE * Math.sin(RING_UP);
    }
    this.local.copy(this.ring);
    this.player.head.worldToLocal(this.local);
    const ahead = this.local.z < -0.05;
    const x = ahead ? this.local.x / -this.local.z : 0;
    const y = ahead ? this.local.y / -this.local.z : 0;
    this.ringAlpha = Math.min(1, this.ringAlpha + delta / 0.8);
    const looking = ahead && Math.hypot(x, y) < RING_CONE_TAN;
    this.ringProgress = looking ? this.ringProgress + delta / RING_DWELL : Math.max(0, this.ringProgress - delta);
    if (this.ringProgress >= 1) return this.openNow();
    this.setRing(ahead ? this.ringAlpha : 0, x, y, this.ringProgress);
  }

  private setRing(alpha: number, x: number, y: number, progress: number): void {
    (this.mat.uniforms.uRing.value as Vector4).set(x, y, alpha, progress);
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
    const visible = this.amount > 0.001;
    this.mesh.visible = visible;
    this.mat.uniforms.uAmount.value = this.amount;
    if (visible !== this.lifted) this.lift(visible);
  }

  /** The subtitles, the breathing light and its card: found once, lifted above the lids while they show. */
  private findAbove(): void {
    const ui = (node: string, id: string) =>
      this.world.getSceneObject<UIKitMLAsset>(node)?.getElementById<UIKit.Component>(id) ?? undefined;
    for (const [node, id] of [['subtitle-panel', 'subtitle-pill'], ['breath-panel', 'breath-card']] as const) {
      const root = ui(node, id);
      if (root) this.above.push({ ui: root });
    }
    const orb = this.world.getSceneObject<Object3D>('breath-orb');
    const meshes: Mesh[] = [];
    orb?.traverse((o) => {
      if ((o as Mesh).isMesh) meshes.push(o as Mesh);
    });
    if (meshes.length) {
      this.above.push({
        meshes,
        orders: meshes.map((m) => m.renderOrder),
        depth: meshes.map((m) => (m.material as Material).depthTest),
      });
    }
  }

  private lift(on: boolean): void {
    this.lifted = on;
    const order = EYELID_RENDER_ORDER + 1;
    for (const a of this.above) {
      a.ui?.setProperties({ renderOrder: on ? order : 0, depthTest: !on });
      if (!a.meshes || !a.orders || !a.depth) continue;
      for (let i = 0; i < a.meshes.length; i++) {
        a.meshes[i].renderOrder = on ? order : a.orders[i];
        (a.meshes[i].material as Material).depthTest = on ? false : a.depth[i];
      }
    }
  }
}
