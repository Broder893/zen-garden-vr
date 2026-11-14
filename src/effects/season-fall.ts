import {
  BufferGeometry,
  CircleGeometry,
  DoubleSide,
  Euler,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  OctahedronGeometry,
  Quaternion,
  Vector3,
} from '@iwsdk/core';
import type { Season } from '../save/atmosphere.js';

/** Most particles at once (all of one season's kind). */
export const SEASON_PARTICLES = 40;
/** Around the table's centre (x 0, z -0.5): never closer than this, mostly far. */
const NEAR = 1.8;
const FAR = 4.6;
const TABLE_Z = -0.5;
/** Seated eyes: nothing drifts closer than this to them. */
const EYES = new Vector3(0, 1.2, 0);
const EYES_CLEAR = 1.4;
const TOP_MIN = 2.6;
const TOP_MAX = 4.6;

interface Look {
  geometry: BufferGeometry;
  color: string;
  emissive: number;
  /** Falling speed (m/s), side drift (m/s at full wind), flutter (m), tumbling (rad/s). */
  fall: number;
  drift: number;
  flutter: number;
  spin: number;
}

const flat = (r: number, sides: number, sx: number, sy: number) => {
  const g = new CircleGeometry(r, sides);
  g.scale(sx, sy, 1);
  return g;
};

/** Pink petals, dandelion seeds, orange leaves, snow: each small, slow and light. */
const LOOKS: Record<Season, Look> = {
  spring: { geometry: flat(0.04, 6, 1, 0.65), color: '#f6b8cf', emissive: 0.1, fall: 0.22, drift: 0.25, flutter: 0.25, spin: 1.6 },
  summer: { geometry: new OctahedronGeometry(0.024), color: '#fbf8ee', emissive: 0.25, fall: 0.08, drift: 0.3, flutter: 0.35, spin: 0.6 },
  autumn: { geometry: flat(0.05, 4, 1.4, 0.75), color: '#e0782e', emissive: 0.05, fall: 0.32, drift: 0.2, flutter: 0.3, spin: 2.2 },
  winter: { geometry: new OctahedronGeometry(0.026), color: '#ffffff', emissive: 0.35, fall: 0.28, drift: 0.12, flutter: 0.12, spin: 0.8 },
};

/**
 * The season in the air, around the garden: a few petals in spring, dandelion
 * seeds in summer, leaves in autumn, snow in winter. One instanced draw call
 * (none when no particle shows). They fall mostly far from the table and never
 * near the eyes. `level` (0..1) sets how many show; the WeatherSystem owns it
 * (they give way to the rain and to closed eyes).
 */
export class SeasonFall {
  readonly mesh: InstancedMesh;
  private season: Season | null = null;
  private look: Look = LOOKS.summer;
  private material = new MeshStandardMaterial({ roughness: 1, side: DoubleSide });
  /** Per particle: x, y, z, phase, spin axis x, spin axis y, speed scale, unused. */
  private state = new Float32Array(SEASON_PARTICLES * 8);
  private time = 0;
  private m = new Matrix4();
  private p = new Vector3();
  private q = new Quaternion();
  private e = new Euler();
  private s = new Vector3(1, 1, 1);

  constructor() {
    this.mesh = new InstancedMesh(LOOKS.summer.geometry, this.material, SEASON_PARTICLES);
    this.mesh.name = 'Season Particles';
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.visible = false;
    for (let i = 0; i < SEASON_PARTICLES; i++) this.spawn(i, TOP_MIN + Math.random() * (TOP_MAX - TOP_MIN) * 1.5 - 1.5);
  }

  /** Dresses the particles for a season (geometry and colour; no new draw call). */
  setSeason(season: Season): void {
    if (season === this.season) return;
    this.season = season;
    this.look = LOOKS[season];
    this.mesh.geometry = this.look.geometry;
    this.material.color.set(this.look.color);
    this.material.emissive.set(this.look.color).multiplyScalar(this.look.emissive);
  }

  /**
   * Moves them. `shown` is how many show (0..SEASON_PARTICLES), `wind` the
   * wind's strength (they drift more in a breeze), `pace` slows them (Gentle).
   */
  update(delta: number, shown: number, wind: number, pace: number): void {
    const n = Math.min(SEASON_PARTICLES, Math.round(shown));
    this.mesh.count = n;
    this.mesh.visible = n > 0;
    if (n === 0) return;
    this.time += delta;
    const L = this.look;
    const t = this.time;
    for (let i = 0; i < n; i++) {
      const o = i * 8;
      const st = this.state;
      const ph = st[o + 3];
      const k = st[o + 6] * pace;
      st[o + 1] -= L.fall * k * delta;
      st[o] += (L.drift * wind * 0.5 + Math.cos(t * 0.7 + ph) * L.flutter * 0.6) * k * delta;
      st[o + 2] += Math.sin(t * 0.9 + ph * 1.3) * L.flutter * 0.5 * k * delta;
      // Down, or drifted too near the eyes or too far: back to the top, somewhere else.
      this.p.set(st[o], st[o + 1], st[o + 2]);
      if (st[o + 1] < 0 || this.p.distanceTo(EYES) < EYES_CLEAR || Math.hypot(st[o], st[o + 2] - TABLE_Z) > FAR + 1) {
        this.spawn(i, TOP_MIN + Math.random() * (TOP_MAX - TOP_MIN));
        this.p.set(st[o], st[o + 1], st[o + 2]);
      }
      this.e.set(t * L.spin * st[o + 4] + ph, t * L.spin * 0.7 + ph * 2, t * L.spin * st[o + 5]);
      this.q.setFromEuler(this.e);
      this.m.compose(this.p, this.q, this.s);
      this.mesh.setMatrixAt(i, this.m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  private spawn(i: number, y: number): void {
    const o = i * 8;
    const a = Math.random() * Math.PI * 2;
    // Mostly far: the square root of a random number leans toward the outer edge.
    const r = NEAR + (FAR - NEAR) * Math.sqrt(Math.random());
    this.state[o] = Math.sin(a) * r;
    this.state[o + 1] = y;
    this.state[o + 2] = TABLE_Z - Math.cos(a) * r;
    this.state[o + 3] = Math.random() * Math.PI * 2;
    this.state[o + 4] = 0.5 + Math.random();
    this.state[o + 5] = 0.5 + Math.random();
    this.state[o + 6] = 0.7 + Math.random() * 0.6;
  }
}
