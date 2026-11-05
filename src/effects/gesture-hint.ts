import {
  AdditiveBlending,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  SphereGeometry,
  Vector3,
} from '@iwsdk/core';

/** Which gesture the ghost hint acts out. */
export type GestureKind = 'pinch' | 'tilt';

const DOTS = 5;
const DOT_RADIUS = 0.0065;
const PINCH_PERIOD = 1.4;
const TILT_PERIOD = 1.6;
const ARC_RADIUS = 0.035;
const FADE_RATE = 4;

/**
 * A tiny ghost gesture drawn in light next to the thing to do, so the
 * tutorial shows the motion instead of describing it:
 * - pinch: two fingertip dots close together, a ring flashes as they meet;
 * - tilt: dots chase along an arc, like a spout turning downward.
 * Two draw calls when visible, none when hidden; no allocation per frame.
 */
export class GestureHint {
  readonly root = new Group();
  private dots: InstancedMesh;
  private ring: Mesh;
  private dotMat: MeshBasicMaterial;
  private ringMat: MeshBasicMaterial;
  private m = new Matrix4();
  private p = new Vector3();
  private time = 0;
  private fade = 0;

  constructor() {
    this.root.name = 'GestureHint';
    this.dotMat = new MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    this.dots = new InstancedMesh(new SphereGeometry(DOT_RADIUS, 8, 6), this.dotMat, DOTS);
    this.dots.frustumCulled = false;
    this.ringMat = this.dotMat.clone();
    this.ring = new Mesh(new RingGeometry(0.012, 0.016, 24), this.ringMat);
    this.root.add(this.dots, this.ring);
    // Big enough to read from a seated distance of about 70 cm.
    this.root.scale.setScalar(1.7);
    this.root.visible = false;
  }

  /**
   * Call every frame. `kind` null fades the hint out. `at` is the world point
   * to draw at, `eye` the viewer's head (the glyph faces it), `color` its tint.
   */
  update(delta: number, kind: GestureKind | null, at: Vector3, eye: Vector3, color: Color, strength = 1): void {
    this.time += delta;
    const want = kind ? strength : 0;
    this.fade += (want - this.fade) * (1 - Math.exp(-FADE_RATE * delta));
    if (this.fade < 0.02 && !kind) {
      this.root.visible = false;
      return;
    }
    this.root.visible = true;
    this.root.position.copy(at);
    this.root.lookAt(eye);
    this.dotMat.color.copy(color);
    this.ringMat.color.copy(color);
    if (kind === 'tilt') this.drawTilt();
    else this.drawPinch();
  }

  private drawPinch(): void {
    const k = (this.time % PINCH_PERIOD) / PINCH_PERIOD;
    // Open, close (fast), hold closed, open again.
    const closed = k < 0.35 ? k / 0.35 : k < 0.55 ? 1 : 1 - (k - 0.55) / 0.45;
    const ease = closed * closed * (3 - 2 * closed);
    const gap = 0.026 * (1 - ease) + 0.004;
    // Thumb below-left, index above-right: reads as a pinching hand.
    this.place(0, -gap * 0.6, -gap * 0.8, 1);
    this.place(1, gap * 0.6, gap * 0.8, 1);
    for (let i = 2; i < DOTS; i++) this.place(i, 0, 0, 0);
    this.dots.instanceMatrix.needsUpdate = true;
    this.dotMat.opacity = 0.95 * this.fade;
    // The ring flashes outward at the moment the fingers meet.
    const flash = k >= 0.35 && k < 0.75 ? (k - 0.35) / 0.4 : -1;
    this.ring.visible = flash >= 0;
    if (flash >= 0) {
      this.ring.scale.setScalar(1 + flash * 1.6);
      this.ringMat.opacity = (1 - flash) * 0.8 * this.fade;
    }
  }

  private drawTilt(): void {
    const k = (this.time % TILT_PERIOD) / TILT_PERIOD;
    // A quarter arc from the top, curving forward and down; a bright head runs along it.
    for (let i = 0; i < DOTS; i++) {
      const a = (i / (DOTS - 1)) * (Math.PI / 2);
      const head = k * (DOTS + 1) - 1;
      const glow = Math.max(0, 1 - Math.abs(head - i) / 1.6);
      this.place(i, Math.sin(a) * ARC_RADIUS, Math.cos(a) * ARC_RADIUS, 0.45 + 0.75 * glow);
    }
    this.dots.instanceMatrix.needsUpdate = true;
    this.dotMat.opacity = 0.9 * this.fade;
    this.ring.visible = false;
  }

  private place(i: number, x: number, y: number, scale: number): void {
    this.p.set(x, y, 0);
    this.m.makeScale(scale, scale, scale).setPosition(this.p);
    this.dots.setMatrixAt(i, this.m);
  }
}
