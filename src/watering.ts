import {
  createSystem,
  Entity,
  Grabbed,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  SphereGeometry,
  Vector3,
} from '@iwsdk/core';
import { trackFirst, FirstEntity } from './ecs-utils.js';
import { AssistHeld, Bonsai, WateringCan } from './garden-components.js';
import { OVERWATER_POUR_SECONDS } from './save/plant-health.js';

const MAX_DROPS = 48;
const EMIT_PER_SEC = 45;
const FILL_SECONDS = 3;
/** Horizontal metres between spout and trunk that still count as watering. */
const REACH = 0.22;
/** After the bonsai grows, pause filling so one long pour can't skip a stage. */
const GRACE_SECONDS = 1.5;

/**
 * Tilting a held watering can spout-down pours drops. Pouring while the spout
 * is roughly over the bonsai fills its water meter.
 */
export class WateringSystem extends createSystem({
  held: { required: [WateringCan, Grabbed] },
  assisted: { required: [WateringCan, AssistHeld] },
  cans: { required: [WateringCan] },
  bonsai: { required: [Bonsai] },
}) {
  private tips = new Map<number, Object3D>();
  private bonsai!: FirstEntity;
  private drops!: InstancedMesh;
  private pos = new Float32Array(MAX_DROPS * 3);
  private vel = new Float32Array(MAX_DROPS * 3);
  private life = new Float32Array(MAX_DROPS);
  private next = 0;
  private emitDebt = 0;
  private tip = new Vector3();
  private dir = new Vector3();
  private quat = new Quaternion();
  private target = new Vector3();
  private m = new Matrix4();
  private hidden = new Matrix4().makeScale(0, 0, 0);
  private floorY = 0;
  private lastStage = -1;
  private stageAge = 0;
  /** True while any can is pouring this frame (read by audio/guide later). */
  pouring = false;
  /** Where the pouring spout is (world), valid while `pouring`. */
  readonly pourTip = new Vector3();
  /** Where the pouring can itself is (world), valid while `pouring`. */
  readonly pourCan = new Vector3();
  /** The pouring can is held hands-free ("hold to select"): it tips by itself. */
  pourAssisted = false;
  /** True while pouring lands on the bonsai. */
  wateringBonsai = false;
  /** True while pouring onto a tree that already has all its water (too much). */
  overflowing = false;
  /**
   * The player filled this water by pouring. Only then is more "too much": water
   * given as a gift (a blooming tree, a breathing break) never starts overwatering.
   */
  private filledByPouring = false;

  init(): void {
    this.bonsai = trackFirst(this.queries.bonsai, this.cleanupFuncs);
    const mat = new MeshStandardMaterial({
      color: '#9fd4ff',
      emissive: '#3a7fb8',
      emissiveIntensity: 0.4,
      transparent: true,
      opacity: 0.8,
      roughness: 0.1,
    });
    this.drops = new InstancedMesh(new SphereGeometry(0.0045, 6, 4), mat, MAX_DROPS);
    this.drops.name = 'WaterDrops';
    this.drops.frustumCulled = false;
    for (let i = 0; i < MAX_DROPS; i++) this.drops.setMatrixAt(i, this.hidden);
    this.world.createTransformEntity(this.drops);

    const bind = (e: Entity) => {
      const t = e.object3D?.getObjectByName('SpoutTip');
      if (t) this.tips.set(e.index, t);
    };
    this.cleanupFuncs.push(this.queries.cans.subscribe('qualify', bind));
    for (const e of this.queries.cans.entities) bind(e);
  }

  update(delta: number): void {
    const bonsai = this.bonsai.entity;
    const bonsaiObj = bonsai?.object3D;
    if (bonsaiObj) {
      bonsaiObj.getWorldPosition(this.target);
      this.floorY = this.target.y + 0.05;
      const stage = bonsai?.getValue(Bonsai, 'stage') ?? 0;
      if (stage !== this.lastStage) {
        this.lastStage = stage;
        this.stageAge = 0;
        this.filledByPouring = false;
      }
      if ((bonsai?.getValue(Bonsai, 'water') ?? 0) < 1) this.filledByPouring = false;
      this.stageAge += delta;
    }
    this.pouring = false;
    this.wateringBonsai = false;
    this.overflowing = false;

    // Pinch-held and hands-free ("hold to select") cans pour the same way.
    this.pourAssisted = false;
    for (const can of this.queries.held.entities) this.pourFrom(can, delta, bonsai);
    for (const can of this.queries.assisted.entities) {
      if (this.pourFrom(can, delta, bonsai)) this.pourAssisted = true;
    }
    this.stepDrops(delta);
  }

  /** Pours from one can if it is tipped; true when it pours this frame. */
  private pourFrom(can: Entity, delta: number, bonsai: Entity | null): boolean {
    const tip = this.tips.get(can.index);
    const obj = can.object3D;
    if (!tip || !obj) return false;
    obj.getWorldQuaternion(this.quat);
    this.dir.set(1, 0, 0).applyQuaternion(this.quat);
    const threshold = can.getValue(WateringCan, 'pourThreshold') ?? 0.35;
    if (-this.dir.y < threshold) return false;
    this.pouring = true;
    tip.getWorldPosition(this.tip);
    this.pourTip.copy(this.tip);
    obj.getWorldPosition(this.pourCan);
    this.emit(delta);

    if (!bonsai?.object3D) return true;
    const dx = this.tip.x - this.target.x;
    const dz = this.tip.z - this.target.z;
    if (dx * dx + dz * dz > REACH * REACH || this.tip.y < this.target.y) return true;
    this.wateringBonsai = true;
    const water = bonsai.getValue(Bonsai, 'water') ?? 0;
    if (water < 1 && this.stageAge >= GRACE_SECONDS) {
      const next = Math.min(1, water + delta / FILL_SECONDS);
      bonsai.setValue(Bonsai, 'water', next);
      if (next >= 1) this.filledByPouring = true;
    } else if (water >= 1 && this.filledByPouring && this.stageAge >= GRACE_SECONDS) {
      // Already full: the excess pools (no experience for it); HealthSystem drains it and shows the stress.
      this.overflowing = true;
      const over = bonsai.getValue(Bonsai, 'overwater') ?? 0;
      bonsai.setValue(Bonsai, 'overwater', Math.min(1, over + delta / OVERWATER_POUR_SECONDS));
    }
    return true;
  }

  private emit(delta: number): void {
    this.emitDebt += delta * EMIT_PER_SEC;
    while (this.emitDebt >= 1) {
      this.emitDebt -= 1;
      const i = this.next;
      this.next = (this.next + 1) % MAX_DROPS;
      const j = i * 3;
      const jitter = (Math.random() - 0.5) * 0.12;
      this.pos[j] = this.tip.x;
      this.pos[j + 1] = this.tip.y;
      this.pos[j + 2] = this.tip.z;
      this.vel[j] = this.dir.x * 0.35 + jitter;
      this.vel[j + 1] = this.dir.y * 0.35;
      this.vel[j + 2] = this.dir.z * 0.35 + (Math.random() - 0.5) * 0.12;
      this.life[i] = 1.2;
    }
  }

  private stepDrops(delta: number): void {
    let any = false;
    for (let i = 0; i < MAX_DROPS; i++) {
      if (this.life[i] <= 0) continue;
      const j = i * 3;
      this.vel[j + 1] -= 9.8 * delta;
      this.pos[j] += this.vel[j] * delta;
      this.pos[j + 1] += this.vel[j + 1] * delta;
      this.pos[j + 2] += this.vel[j + 2] * delta;
      this.life[i] -= delta;
      if (this.life[i] <= 0 || this.pos[j + 1] < this.floorY) {
        this.life[i] = 0;
        this.drops.setMatrixAt(i, this.hidden);
      } else {
        this.m.makeTranslation(this.pos[j], this.pos[j + 1], this.pos[j + 2]);
        this.drops.setMatrixAt(i, this.m);
      }
      any = true;
    }
    if (any) this.drops.instanceMatrix.needsUpdate = true;
  }
}
