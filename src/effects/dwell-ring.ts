import {
  AdditiveBlending,
  Color,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Object3D,
  SphereGeometry,
  Vector3,
} from '@iwsdk/core';

const DOTS = 18;
const RADIUS = 0.035;

/**
 * A ring of light dots that fills clockwise as a "hold to select" completes,
 * so the player sees the selection coming and can move away to cancel.
 * One draw call; nothing allocated per frame.
 */
export class DwellRing {
  readonly root = new Object3D();
  private dots: InstancedMesh;
  private mat: MeshBasicMaterial;
  private m = new Matrix4();
  private time = 0;

  constructor() {
    this.root.name = 'DwellRing';
    this.mat = new MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      depthTest: false,
      blending: AdditiveBlending,
    });
    this.dots = new InstancedMesh(new SphereGeometry(0.0045, 6, 4), this.mat, DOTS);
    this.dots.frustumCulled = false;
    this.dots.renderOrder = 10;
    this.root.add(this.dots);
    this.root.visible = false;
  }

  /** progress 0..1 (or <= 0 to hide), drawn at `at` facing `eye`. */
  update(delta: number, progress: number, at: Vector3, eye: Vector3, color: Color): void {
    this.time += delta;
    if (progress <= 0) {
      this.root.visible = false;
      return;
    }
    this.root.visible = true;
    this.root.position.copy(at);
    this.root.lookAt(eye);
    this.mat.color.copy(color);
    const lit = progress * DOTS;
    for (let i = 0; i < DOTS; i++) {
      // Clockwise from the top, as seen by the viewer.
      const a = Math.PI / 2 - (i / DOTS) * Math.PI * 2;
      const on = Math.min(1, Math.max(0, lit - i));
      const s = 0.45 + 0.75 * on + (on > 0 && on < 1 ? 0.2 * Math.sin(this.time * 12) : 0);
      this.m.makeScale(s, s, s).setPosition(-Math.cos(a) * RADIUS, Math.sin(a) * RADIUS, 0);
      this.dots.setMatrixAt(i, this.m);
    }
    this.dots.instanceMatrix.needsUpdate = true;
  }
}
