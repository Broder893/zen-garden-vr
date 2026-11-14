import {
  BufferAttribute,
  BufferGeometry,
  createSystem,
  DoubleSide,
  Euler,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Quaternion,
  Vector3,
  VisibilityState,
} from '@iwsdk/core';
import { ComfortSystem } from './comfort.js';
import { DayNightSystem } from './day-night.js';
import { WeatherSystem } from './weather.js';

const MAX_BIRDS = 5;
/** A flock comes every 1-2 minutes by day. */
const WAIT_MIN = 60;
const WAIT_MAX = 120;
/** The first one sooner, so a short visit may see it. */
const FIRST_MIN = 25;
const FIRST_MAX = 50;
/** They pass this far from the garden, this high, along a path this long, at this speed. */
const DISTANCE_MIN = 22;
const DISTANCE_MAX = 30;
const HEIGHT_MIN = 9;
const HEIGHT_MAX = 13;
const PATH = 80;
const SPEED = 5;
/** Wing beats (rad/s) and how far the formation spreads (m). */
const FLAP = 7;
const SPACING = 1.3;

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** A stylised bird: two thin wings in a shallow V, flying along local +X (about 85 cm across). */
function birdGeometry(): BufferGeometry {
  const nose = [0.13, 0, 0];
  const tail = [-0.1, 0, 0];
  const left = [-0.06, 0.07, 0.3];
  const right = [-0.06, 0.07, -0.3];
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array([...nose, ...tail, ...left, ...nose, ...right, ...tail]), 3));
  g.scale(1.4, 1.4, 1.4);
  g.computeVertexNormals();
  return g;
}

/**
 * Now and then by day a small flock (3-5 stylised birds) crosses the far sky
 * in a loose V, wings beating, and is gone. One instanced draw call while it
 * flies, hidden the rest of the time. Not at sunset or night, nor in the
 * rain. With Gentle transitions they fly a little slower.
 */
export class BirdsSystem extends createSystem({}) {
  /** Seconds until the next flock (dev: set to 0 to call one now). */
  wait = rand(FIRST_MIN, FIRST_MAX);
  /** Seconds into the current flight (negative = none). */
  flying = -1;
  private count = 0;
  private start = new Vector3();
  private dir = new Vector3();
  private side = new Vector3();
  private phases = new Float32Array(MAX_BIRDS * 3);
  private mesh!: InstancedMesh;
  private dayNight?: DayNightSystem;
  private weather?: WeatherSystem;
  private comfort?: ComfortSystem;
  private m = new Matrix4();
  private p = new Vector3();
  private q = new Quaternion();
  private e = new Euler();
  private s = new Vector3();

  init(): void {
    this.mesh = new InstancedMesh(
      birdGeometry(),
      new MeshBasicMaterial({ color: '#3c3a44', side: DoubleSide }),
      MAX_BIRDS,
    );
    this.mesh.name = 'Birds';
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.visible = false;
    this.world.createTransformEntity(this.mesh);
  }

  update(delta: number): void {
    if (this.world.visibilityState.peek() !== VisibilityState.Visible) return;
    if (this.flying < 0) {
      this.dayNight ??= this.world.getSystem(DayNightSystem);
      this.weather ??= this.world.getSystem(WeatherSystem);
      if ((this.dayNight?.time ?? 'day') !== 'day' || this.weather?.weather === 'rain') return;
      this.wait -= delta;
      if (this.wait <= 0) this.launch();
      return;
    }
    this.comfort ??= this.world.getSystem(ComfortSystem);
    const speed = SPEED * (this.comfort?.settings.softTransitions ? 0.75 : 1);
    this.flying += delta;
    const along = this.flying * speed;
    if (along > PATH + this.count * SPACING) {
      this.flying = -1;
      this.mesh.count = 0;
      this.mesh.visible = false;
      this.wait = rand(WAIT_MIN, WAIT_MAX);
      return;
    }
    // Faces the way it flies (local +X along `dir`).
    this.q.setFromEuler(this.e.set(0, Math.atan2(-this.dir.z, this.dir.x), 0));
    for (let i = 0; i < this.count; i++) {
      const o = i * 3;
      const back = Math.ceil(i / 2) * SPACING;
      const wing = (i % 2 === 0 ? 1 : -1) * Math.ceil(i / 2) * SPACING * 0.8;
      const t = this.flying + this.phases[o + 2];
      this.p
        .copy(this.start)
        .addScaledVector(this.dir, along - back)
        .addScaledVector(this.side, wing + Math.sin(t * 0.5 + this.phases[o]) * 0.25);
      this.p.y += Math.sin(t * 0.8 + this.phases[o + 1]) * 0.35;
      // Wing beats: the V flattens and folds (a glide now and then, from the slow sine).
      const beat = Math.sin(t * FLAP + this.phases[o] * 3) * (0.6 + 0.6 * Math.max(0, Math.sin(t * 0.35 + this.phases[o + 1])));
      this.s.set(1, beat, 1);
      this.m.compose(this.p, this.q, this.s);
      this.mesh.setMatrixAt(i, this.m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** A new flock: a straight line past the garden, mostly in front, far and high. */
  private launch(): void {
    this.count = 3 + Math.floor(Math.random() * (MAX_BIRDS - 2));
    const b = rand(-1.1, 1.1);
    const d = rand(DISTANCE_MIN, DISTANCE_MAX);
    const h = rand(HEIGHT_MIN, HEIGHT_MAX);
    const way = Math.random() < 0.5 ? 1 : -1;
    // The closest point, and the way across the view (perpendicular to it, level).
    this.p.set(Math.sin(b) * d, h, -Math.cos(b) * d);
    this.dir.set(Math.cos(b) * way, rand(-0.03, 0.05), Math.sin(b) * way).normalize();
    this.side.set(-this.dir.z, 0, this.dir.x).normalize();
    this.start.copy(this.p).addScaledVector(this.dir, -PATH / 2);
    for (let i = 0; i < this.phases.length; i++) this.phases[i] = Math.random() * Math.PI * 2;
    this.flying = 0;
    this.mesh.count = this.count;
    this.mesh.visible = true;
  }
}
