import {
  BoxGeometry,
  createSystem,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Vector3,
  VisibilityState,
} from '@iwsdk/core';
import { trackFirst, FirstEntity } from './ecs-utils.js';
import { Bonsai, BonsaiStage } from './garden-components.js';
import type { LineId } from './guide.js';
import { BreathBreakSystem } from './breath-break.js';
import { HealthSystem } from './health.js';
import { MeditationSystem } from './meditation.js';
import { overridesFrom, Weather } from './save/atmosphere.js';

/** A first shower or breeze comes after this much time with a planted tree (seconds). */
const FIRST_MIN = 70;
const FIRST_MAX = 160;
/** ...then the next one after a longer while. */
const NEXT_MIN = 240;
const NEXT_MAX = 420;
const DURATION_MIN = 40;
const DURATION_MAX = 60;
/** Forced weather (?weather=) starts this soon and comes back often. */
const FORCED_DELAY = 8;
/** Levels ramp in and out over about this long. */
const RAMP_SECONDS = 3;
/** Rain gives the tree water at this rate (full in ~20 s): it helps growth, never overwaters. */
const RAIN_WATER_SECONDS = 20;
/** A breeze dries the soil and eases stress this much faster. */
const BREEZE_EASE = 2;
const DROPS = 140;
const RAIN_RADIUS = 2.2;
const RAIN_TOP = 3.2;
const FALL_SPEED = 3.2;
/** The table top, where drops stop instead of the floor. */
const TABLE = { x0: -0.5, x1: 0.5, z0: -0.85, z1: -0.15, y: 0.77 };

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/**
 * Now and then the garden has weather: a gentle rain that waters the tree
 * (and so helps it grow), or a breeze that sways it and dries the soil. Each
 * comes with its own sound and a word from the firefly. ?weather=rain|breeze
 * brings it at once. Rain is one instanced draw call; the breeze is only motion.
 */
export class WeatherSystem extends createSystem({
  bonsai: { required: [Bonsai] },
}) {
  weather: Weather = 'clear';
  /** 0..1, ramped: read by the audio. */
  rainLevel = 0;
  windLevel = 0;
  private forced?: Weather;
  private wait = rand(FIRST_MIN, FIRST_MAX);
  private left = 0;
  private time = 0;
  private bonsai!: FirstEntity;
  private health?: HealthSystem;
  private guide?: { showEvent(id: LineId, seconds: number): void; readonly busy: boolean };
  private meditation?: MeditationSystem;
  private breaks?: BreathBreakSystem;
  private drops!: InstancedMesh;
  private pos = new Float32Array(DROPS * 3);
  private m = new Matrix4();
  private p = new Vector3();

  init(): void {
    this.bonsai = trackFirst(this.queries.bonsai, this.cleanupFuncs);
    this.forced = overridesFrom(window.location.search).weather;
    if (this.forced) this.wait = FORCED_DELAY;
    this.drops = new InstancedMesh(
      new BoxGeometry(0.0025, 0.1, 0.0025),
      new MeshBasicMaterial({ color: '#cfe2ff', transparent: true, opacity: 0.45, depthWrite: false }),
      DROPS,
    );
    this.drops.name = 'Rain';
    this.drops.frustumCulled = false;
    this.drops.count = 0;
    for (let i = 0; i < DROPS; i++) this.spawn(i, rand(0, RAIN_TOP));
    this.world.createTransformEntity(this.drops);
  }

  /** The guide registers itself (it is created after this system). */
  attachGuide(guide: { showEvent(id: LineId, seconds: number): void; readonly busy: boolean }): void {
    this.guide = guide;
  }

  update(delta: number): void {
    this.health ??= this.world.getSystem(HealthSystem);
    this.meditation ??= this.world.getSystem(MeditationSystem);
    this.breaks ??= this.world.getSystem(BreathBreakSystem);
    const b = this.bonsai.entity;
    const visible = this.world.visibilityState.peek() === VisibilityState.Visible;
    if (visible && b && (b.getValue(Bonsai, 'planted') ?? false)) this.advance(delta, b);
    // Levels follow the weather smoothly (and fade out when the headset is off).
    const rainOn = visible && this.weather === 'rain' ? 1 : 0;
    const windOn = visible && this.weather === 'breeze' ? 1 : 0;
    this.rainLevel = this.ramp(this.rainLevel, rainOn, delta);
    this.windLevel = this.ramp(this.windLevel, windOn, delta);
    this.time += delta;
    if (this.health) {
      this.health.sway = this.windLevel * (0.05 * Math.sin(this.time * 1.3) + 0.025 * Math.sin(this.time * 2.9));
      this.health.weatherEase = this.windLevel > 0.5 ? BREEZE_EASE : 1;
    }
    this.rain(delta);
  }

  private advance(delta: number, b: NonNullable<FirstEntity['entity']>): void {
    if (this.weather === 'clear') {
      this.wait -= delta;
      // Never interrupt: wait until the firefly is free and no breathing is under way.
      if (this.wait > 0 || this.guide?.busy || this.meditation?.active || this.breaks?.inviteLine) return;
      this.weather = this.forced ?? (Math.random() < 0.5 ? 'rain' : 'breeze');
      this.left = rand(DURATION_MIN, DURATION_MAX);
      this.guide?.showEvent(this.weather === 'rain' ? 'rainStarts' : 'breezeStarts', 4);
      return;
    }
    this.left -= delta;
    if (this.weather === 'rain') {
      // Rain waters the tree gently: it counts as care (full water still earns its XP).
      const water = b.getValue(Bonsai, 'water') ?? 0;
      const stage = b.getValue(Bonsai, 'stage') ?? 0;
      if (water < 1 && stage <= BonsaiStage.Blooming) b.setValue(Bonsai, 'water', Math.min(1, water + delta / RAIN_WATER_SECONDS));
    }
    if (this.left <= 0) {
      this.weather = 'clear';
      this.wait = this.forced ? FORCED_DELAY * 4 : rand(NEXT_MIN, NEXT_MAX);
    }
  }

  private ramp(level: number, target: number, delta: number): number {
    const step = delta / RAMP_SECONDS;
    return target > level ? Math.min(target, level + step) : Math.max(target, level - step);
  }

  private spawn(i: number, y: number): void {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * RAIN_RADIUS;
    this.pos[i * 3] = Math.sin(a) * r;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = -0.5 - Math.cos(a) * r;
  }

  /** Falling streaks, as many as the rain is strong; they stop on the table or the ground. */
  private rain(delta: number): void {
    const n = Math.round(this.rainLevel * DROPS);
    this.drops.count = n;
    if (n === 0) return;
    for (let i = 0; i < n; i++) {
      const j = i * 3;
      this.pos[j + 1] -= FALL_SPEED * delta;
      const x = this.pos[j];
      const z = this.pos[j + 2];
      const onTable = x > TABLE.x0 && x < TABLE.x1 && z > TABLE.z0 && z < TABLE.z1;
      if (this.pos[j + 1] < (onTable ? TABLE.y : 0)) this.spawn(i, RAIN_TOP + Math.random() * 0.5);
      this.m.makeTranslation(this.p.set(this.pos[j], this.pos[j + 1], this.pos[j + 2]));
      this.drops.setMatrixAt(i, this.m);
    }
    this.drops.instanceMatrix.needsUpdate = true;
  }
}
