import { IcosahedronGeometry, InstancedMesh, Matrix4, MeshBasicMaterial, Vector3 } from '@iwsdk/core';

const LIFE_SECONDS = 1.4;

/**
 * A small pool of glowing motes that burst outward and drift up, used to mark
 * a moment (planting, growing, a gift). One draw call, no per-frame allocation.
 * The owner adds `mesh` to the world and calls `update` every frame.
 */
export class Sparkles {
  readonly mesh: InstancedMesh;
  private readonly count: number;
  private pos: Float32Array;
  private vel: Float32Array;
  private life: Float32Array;
  private next = 0;
  private alive = 0;
  private m = new Matrix4();
  private hidden = new Matrix4().makeScale(0, 0, 0);

  /** `size`: mote radius in metres (the default suits the table; far objects need bigger). */
  constructor(count = 40, color = '#fff2c4', size = 0.0035) {
    this.count = count;
    this.pos = new Float32Array(count * 3);
    this.vel = new Float32Array(count * 3);
    this.life = new Float32Array(count);
    const mat = new MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false });
    this.mesh = new InstancedMesh(new IcosahedronGeometry(size, 0), mat, count);
    this.mesh.name = 'Sparkles';
    this.mesh.frustumCulled = false;
    for (let i = 0; i < count; i++) this.mesh.setMatrixAt(i, this.hidden);
    // Nothing to draw until the first burst: no draw call while idle.
    this.mesh.visible = false;
  }

  /** Releases `n` motes from `center`, spread over a sphere of `radius` metres. */
  burst(center: Vector3, n: number, radius: number): void {
    for (let k = 0; k < n; k++) {
      const i = this.next;
      this.next = (this.next + 1) % this.count;
      const th = Math.random() * Math.PI * 2;
      const y = Math.random() * 2 - 1;
      const r = Math.sqrt(1 - y * y);
      const dx = r * Math.cos(th);
      const dz = r * Math.sin(th);
      this.pos[i * 3] = center.x + dx * radius * 0.4;
      this.pos[i * 3 + 1] = center.y + y * radius * 0.4;
      this.pos[i * 3 + 2] = center.z + dz * radius * 0.4;
      const speed = 0.05 + Math.random() * 0.07;
      this.vel[i * 3] = dx * speed;
      this.vel[i * 3 + 1] = Math.abs(y) * speed + 0.04;
      this.vel[i * 3 + 2] = dz * speed;
      this.life[i] = LIFE_SECONDS * (0.7 + Math.random() * 0.3);
    }
    this.alive = LIFE_SECONDS;
    this.mesh.visible = true;
  }

  update(delta: number): void {
    if (this.alive <= 0) return;
    this.alive -= delta;
    if (this.alive <= 0) this.mesh.visible = false;
    const drag = Math.exp(-1.8 * delta);
    for (let i = 0; i < this.count; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= delta;
      if (this.life[i] <= 0) {
        this.mesh.setMatrixAt(i, this.hidden);
        continue;
      }
      const j = i * 3;
      this.vel[j] *= drag;
      this.vel[j + 1] = this.vel[j + 1] * drag + 0.02 * delta;
      this.vel[j + 2] *= drag;
      this.pos[j] += this.vel[j] * delta;
      this.pos[j + 1] += this.vel[j + 1] * delta;
      this.pos[j + 2] += this.vel[j + 2] * delta;
      const s = Math.min(1, this.life[i] / 0.5) * (0.8 + 0.4 * Math.sin(i * 7.1 + this.life[i] * 12));
      this.m.makeScale(s, s, s).setPosition(this.pos[j], this.pos[j + 1], this.pos[j + 2]);
      this.mesh.setMatrixAt(i, this.m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
