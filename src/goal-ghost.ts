import {
  AdditiveBlending,
  createSystem,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  VisibilityState,
} from '@iwsdk/core';
import { ArrivalSystem } from './arrival.js';
import { BlenderBonsaiSystem } from './blender-bonsai.js';
import { trackFirst, FirstEntity } from './ecs-utils.js';
import { Bonsai } from './garden-components.js';
import { GuideSystem } from './guide.js';
import { PersistenceSystem } from './persistence.js';
import { mergeByMaterial } from './scene-assets/lib/merge.js';

/** The blooming model's parts that make the silhouette (no snow, fallen leaves or puddle). */
const PARTS = /^Blooming_(trunk|foliage|flowers)$/;
/** In, a moment, out: about 2 s in all. */
const IN_SECONDS = 0.5;
const HOLD_SECONDS = 1;
const OUT_SECONDS = 0.7;
const OPACITY = 0.28;
/** It rises this much while it appears (m). */
const RISE = 0.02;
/** After the firefly lands, a breath before the promise shows. */
const DELAY_SECONDS = 0.6;

/**
 * The goal, shown once: while the firefly invites the player to plant (first
 * visit only), a soft, see-through silhouette of the tree in bloom rises from
 * the empty pot for about 2 s and fades. Built once from the blooming model,
 * merged into one mesh: one draw call, and only while it shows.
 */
export class GoalGhostSystem extends createSystem({
  bonsai: { required: [Bonsai] },
}) {
  /** Seconds into the showing (-1 before, Infinity once shown or skipped). */
  t = -1;
  private ghost: Object3D | null = null;
  /** Warm light, added to what is behind it: it glows like the firefly, never hides the pot. */
  private material = new MeshBasicMaterial({
    color: '#ffc874',
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  private bonsai!: FirstEntity;
  private guide?: GuideSystem;
  private arrival?: ArrivalSystem;
  private persistence?: PersistenceSystem;
  private blender?: BlenderBonsaiSystem;
  private waited = 0;
  private baseY = 0;

  init(): void {
    this.bonsai = trackFirst(this.queries.bonsai, this.cleanupFuncs);
  }

  update(delta: number): void {
    if (this.t === Infinity) return;
    if (this.world.visibilityState.peek() !== VisibilityState.Visible) return;
    const b = this.bonsai.entity;
    if (!b) return;
    this.persistence ??= this.world.getSystem(PersistenceSystem);
    this.blender ??= this.world.getSystem(BlenderBonsaiSystem);
    this.guide ??= this.world.getSystem(GuideSystem);
    this.arrival ??= this.world.getSystem(ArrivalSystem);
    // First visit, before planting, with the Blender tree (the classic one has no bloom model).
    if (this.persistence?.returning || (b.getValue(Bonsai, 'planted') ?? false) || this.blender?.status === 'failed') {
      return this.finish();
    }
    if (this.t < 0) {
      if (this.blender?.status !== 'blender' || this.guide?.shownLine !== 'plantSeed') return;
      if (this.arrival && this.arrival.t !== Infinity) return;
      this.waited += delta;
      if (this.waited < DELAY_SECONDS) return;
      if (!this.build(b.object3D)) return this.finish();
      this.t = 0;
    }
    this.t += delta;
    const t = this.t;
    const a = t < IN_SECONDS ? t / IN_SECONDS : t < IN_SECONDS + HOLD_SECONDS ? 1 : 1 - (t - IN_SECONDS - HOLD_SECONDS) / OUT_SECONDS;
    if (a <= 0) return this.finish();
    const e = a * a * (3 - 2 * a);
    this.material.opacity = OPACITY * e;
    if (this.ghost) this.ghost.position.y = this.baseY + RISE * Math.min(1, t / (IN_SECONDS + HOLD_SECONDS));
  }

  /** One mesh from the blooming model's trunk, foliage and blossoms, beside it in the tree. */
  private build(root: Object3D | null | undefined): boolean {
    const bloom = root?.getObjectByName('Blooming');
    if (!root || !bloom) return false;
    root.updateMatrixWorld(true);
    const parts = new Group();
    const toBloom = new Matrix4().copy(bloom.matrixWorld).invert();
    bloom.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh || !PARTS.test(mesh.name)) return;
      const copy = new Mesh(mesh.geometry, this.material);
      new Matrix4().multiplyMatrices(toBloom, mesh.matrixWorld).decompose(copy.position, copy.quaternion, copy.scale);
      parts.add(copy);
    });
    if (parts.children.length === 0) return false;
    mergeByMaterial(parts);
    parts.name = 'Goal Ghost';
    parts.renderOrder = 2;
    // Where the blooming model sits (its parent is the tree: same place, same size).
    bloom.parent?.add(parts);
    parts.position.copy(bloom.position);
    parts.quaternion.copy(bloom.quaternion);
    parts.scale.copy(bloom.scale);
    this.baseY = bloom.position.y;
    this.ghost = parts;
    return true;
  }

  private finish(): void {
    this.t = Infinity;
    if (!this.ghost) return;
    this.ghost.removeFromParent();
    this.ghost.traverse((o) => (o as Mesh).geometry?.dispose());
    this.ghost = null;
  }
}
