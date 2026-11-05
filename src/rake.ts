import {
  CanvasTexture,
  createSystem,
  GrabSystem,
  Grabbed,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  Vector3,
  VisibilityState,
} from '@iwsdk/core';
import { ComfortSystem } from './comfort.js';
import { trackFirst, FirstEntity } from './ecs-utils.js';
import { AssistHeld, PruningShears, WateringCan } from './garden-components.js';
import { HandReader } from './hand-joints.js';
import { loadSand, storeSand } from './save/garden-save.js';

/** The sand tray on the table, in world space (table at z = -0.5, top at y = 0.77). */
const SAND_Y = 0.77;
const TRAY = { x0: -0.43, x1: 0.43, z0: -0.78, z1: -0.22 };
const TEX_W = 512;
const TEX_H = Math.round((TEX_W * (TRAY.z1 - TRAY.z0)) / (TRAY.x1 - TRAY.x0));
/** A fingertip this close above the sand (metres) draws in it. */
const TOUCH = 0.015;
/** Objects the raked rings go around: [x, z, radius] in world metres. */
const RINGED: [number, number, number][] = [
  [0, -0.58, 0.115], // the pot
  [0.08, -0.27, 0.07], // the meditation stone
];
/** Joints read each frame: the three raking fingertips (0-2), then the wrist (3). */
const JOINTS: readonly XRHandJoint[] = ['index-finger-tip', 'middle-finger-tip', 'ring-finger-tip', 'wrist'];
const FINGER_COUNT = 3;
/** The sand sound keeps going this long after the last groove (slow strokes do not flicker it). */
const SOUND_HOLD = 0.2;
const UPLOAD_EVERY = 1 / 15;
const SAVE_AFTER = 3;
const SAND = '#e6dcc3';
const SHADOW = 'rgba(110, 92, 64, 0.38)';
const LIGHT = 'rgba(255, 251, 238, 0.55)';
/** The player's own grooves are a touch deeper than the raked pattern. */
const DEEP = 'rgba(96, 76, 50, 0.55)';

/**
 * The table's sand, raked: straight lines with rings around the pot and the
 * stone, drawn into a canvas texture. Fingertips touching the sand draw new
 * grooves (three fingers = a little rake), which stay, and are kept between
 * visits. A soft sand sound follows the strokes.
 */
export class RakeSystem extends createSystem({
  cans: { required: [WateringCan, Grabbed] },
  shears: { required: [PruningShears, Grabbed] },
  assisted: { required: [AssistHeld] },
}) {
  /** Grooves drawn by the player so far (this session). */
  strokes = 0;
  /** True while fingertips are drawing, held briefly between grooves (read by the audio). */
  raking = false;
  private soundLeft = 0;
  private matrices = new Float32Array(JOINTS.length * 16);
  private grab?: GrabSystem;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private texture: CanvasTexture | null = null;
  private hands!: HandReader;
  private comfort?: ComfortSystem;
  private can!: FirstEntity;
  private shearsRef!: FirstEntity;
  private assistedRef!: FirstEntity;
  // Last canvas point of each fingertip (2 hands x 3 fingers), NaN = not touching.
  private last = new Float32Array(12).fill(NaN);
  private dirty = false;
  private sinceUpload = 0;
  private sinceStroke = 0;
  private unsaved = false;
  private tip = new Vector3();

  init(): void {
    this.can = trackFirst(this.queries.cans, this.cleanupFuncs);
    this.shearsRef = trackFirst(this.queries.shears, this.cleanupFuncs);
    this.assistedRef = trackFirst(this.queries.assisted, this.cleanupFuncs);
    this.hands = new HandReader(this.renderer.xr, this.player);
    try {
      this.canvas = document.createElement('canvas');
      this.canvas.width = TEX_W;
      this.canvas.height = TEX_H;
      this.ctx = this.canvas.getContext('2d');
    } catch {
      this.ctx = null;
    }
    if (!this.ctx || !this.canvas) return; // no canvas: the plain sand stays
    this.drawPattern();
    this.texture = new CanvasTexture(this.canvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.texture.anisotropy = 4;
    const geo = new PlaneGeometry(TRAY.x1 - TRAY.x0, TRAY.z1 - TRAY.z0);
    geo.rotateX(-Math.PI / 2);
    const mesh = new Mesh(
      geo,
      new MeshStandardMaterial({ map: this.texture, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    );
    mesh.name = 'RakedSand';
    mesh.position.set((TRAY.x0 + TRAY.x1) / 2, SAND_Y + 0.0002, (TRAY.z0 + TRAY.z1) / 2);
    this.world.createTransformEntity(mesh);
    this.restore();
    // Leaving right after raking must not lose the last grooves.
    const flush = () => {
      if (!this.unsaved) return;
      this.unsaved = false;
      this.save();
    };
    window.addEventListener('pagehide', flush);
    this.cleanupFuncs.push(() => window.removeEventListener('pagehide', flush));
  }

  update(delta: number): void {
    this.soundLeft = Math.max(0, this.soundLeft - delta);
    this.raking = this.soundLeft > 0;
    if (!this.ctx) return;
    this.sinceUpload += delta;
    this.sinceStroke += delta;
    if (this.world.visibilityState.peek() === VisibilityState.Visible) this.rake();
    if (this.dirty && this.sinceUpload >= UPLOAD_EVERY) {
      this.dirty = false;
      this.sinceUpload = 0;
      if (this.texture) this.texture.needsUpdate = true;
    }
    if (this.unsaved && this.sinceStroke >= SAVE_AFTER) {
      this.unsaved = false;
      this.save();
    }
  }

  /** Draws a groove for every fingertip resting on the sand, from where it was last frame. */
  private rake(): void {
    // Resolved lazily: ComfortSystem is registered after this system.
    this.comfort ??= this.world.getSystem(ComfortSystem);
    const hands = this.hands;
    if (!hands.begin() || !hands.sources) {
      this.last.fill(NaN);
      return;
    }
    const sources = hands.sources;
    let slot = 0;
    for (let side = 0; side < 2; side++, slot += 3) {
      const handedness = side === 0 ? 'left' : 'right';
      let hand: XRHand | undefined;
      for (let i = 0; i < sources.length; i++) {
        if (sources[i].handedness === handedness && sources[i].hand) hand = sources[i].hand;
      }
      const usable =
        hand !== undefined &&
        (this.comfort?.usesHand(handedness) ?? true) &&
        !this.holdingTool(handedness) &&
        hands.fill(hand, JOINTS, this.matrices);
      for (let f = 0; f < FINGER_COUNT; f++) {
        const k = (slot + f) * 2;
        if (!usable || !this.onSand(hands.position(f, this.matrices, this.tip))) {
          this.last[k] = NaN;
          continue;
        }
        const u = ((this.tip.x - TRAY.x0) / (TRAY.x1 - TRAY.x0)) * TEX_W;
        const v = ((this.tip.z - TRAY.z0) / (TRAY.z1 - TRAY.z0)) * TEX_H;
        const lu = this.last[k];
        const lv = this.last[k + 1];
        this.last[k] = u;
        this.last[k + 1] = v;
        if (Number.isNaN(lu)) continue;
        const moved = Math.hypot(u - lu, v - lv);
        if (moved < 0.6) continue;
        this.groove(lu, lv, u, v, 3.4, DEEP);
        this.raking = true;
        this.soundLeft = SOUND_HOLD;
        this.dirty = true;
        this.unsaved = true;
        this.sinceStroke = 0;
        if (f === 0) this.strokes++;
      }
    }
  }

  private onSand(p: Vector3): boolean {
    return (
      p.y < SAND_Y + TOUCH && p.y > SAND_Y - 0.04 &&
      p.x > TRAY.x0 && p.x < TRAY.x1 && p.z > TRAY.z0 && p.z < TRAY.z1
    );
  }

  /** True when this hand holds the can or shears (by pinch or hands-free): it must not rake. */
  private holdingTool(side: 'left' | 'right'): boolean {
    this.grab ??= this.world.getSystem(GrabSystem);
    return this.holds(this.can, side) || this.holds(this.shearsRef, side) || this.holdsAssisted(side);
  }

  private holds(ref: FirstEntity, side: 'left' | 'right'): boolean {
    const e = ref.entity;
    return !!e && this.grab?.getHolderHand(e) === side;
  }

  private holdsAssisted(side: 'left' | 'right'): boolean {
    const e = this.assistedRef.entity;
    return !!e && (e.getValue(AssistHeld, 'hand') === 1 ? 'right' : 'left') === side;
  }

  /** One groove: a soft shadow line with a light edge on its far side. */
  private groove(x0: number, y0: number, x1: number, y1: number, width: number, shadow = SHADOW): void {
    const c = this.ctx;
    if (!c) return;
    c.lineCap = 'round';
    c.strokeStyle = shadow;
    c.lineWidth = width;
    c.beginPath();
    c.moveTo(x0, y0);
    c.lineTo(x1, y1);
    c.stroke();
    c.strokeStyle = LIGHT;
    c.lineWidth = width * 0.45;
    c.beginPath();
    c.moveTo(x0, y0 - width * 0.55);
    c.lineTo(x1, y1 - width * 0.55);
    c.stroke();
  }

  /** The garden as first found: straight raked lines, rings around the pot and the stone. */
  private drawPattern(): void {
    const c = this.ctx;
    if (!c) return;
    c.fillStyle = SAND;
    c.fillRect(0, 0, TEX_W, TEX_H);
    for (let y = 6; y < TEX_H; y += 9) this.groove(0, y, TEX_W, y, 2.2);
    const scale = TEX_W / (TRAY.x1 - TRAY.x0);
    for (const [x, z, r] of RINGED) {
      const cx = (x - TRAY.x0) * scale;
      const cy = (z - TRAY.z0) * scale;
      const inner = r * scale + 3;
      const outer = inner + 4 * 9;
      // Smooth the sand inside the ring field, then rake circles around the object.
      c.fillStyle = SAND;
      c.beginPath();
      c.arc(cx, cy, outer + 2, 0, Math.PI * 2);
      c.fill();
      for (let rr = inner; rr <= outer; rr += 9) {
        c.lineWidth = 2.2;
        c.strokeStyle = SHADOW;
        c.beginPath();
        c.arc(cx, cy, rr, 0, Math.PI * 2);
        c.stroke();
        c.lineWidth = 1;
        c.strokeStyle = LIGHT;
        c.beginPath();
        c.arc(cx, cy, rr - 1.2, Math.PI, Math.PI * 2);
        c.stroke();
      }
    }
  }

  /** Puts back the sand as the player left it (if saved). */
  private restore(): void {
    const data = loadSand();
    if (!data || !this.ctx) return;
    const img = new Image();
    img.onload = () => {
      // Grooves made while the image decoded win over the older sand.
      if (this.strokes > 0) return;
      this.ctx?.drawImage(img, 0, 0, TEX_W, TEX_H);
      this.dirty = true;
    };
    img.src = data;
  }

  private save(): void {
    try {
      storeSand(this.canvas?.toDataURL('image/png') ?? '');
    } catch {
      /* a tainted or huge canvas: the sand just is not kept */
    }
  }
}
