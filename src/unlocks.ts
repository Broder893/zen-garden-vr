import {
  Color,
  createSystem,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  Vector3,
} from '@iwsdk/core';
import { BonsaiGrowthSystem } from './bonsai-growth.js';
import { trackFirst, FirstEntity } from './ecs-utils.js';
import { Sparkles } from './effects/sparkles.js';
import { EyelidSystem } from './eyelids.js';
import { Bonsai } from './garden-components.js';
import { isUnlocked, Unlock } from './save/growth-levels.js';
import { DASH_Y, FLOW_DASHES, streamPoint, streamTangent } from './scene-assets/unlocks.scene-asset.js';

/** The glaze the pot gets at level 6: a soft celadon. */
const GLAZE = new Color('#4f8f86');
const REVEAL_SECONDS = 1.6;
const FLOW_SPEED = 0.04; // fraction of the stream per second (about 8 cm/s)
const UP = new Vector3(0, 1, 0);

interface Reveal {
  obj: Object3D;
  t: number;
}

/**
 * Shows what the garden has unlocked (src/save/growth-levels.ts): a glazed pot
 * (level 6), the stone lantern (7) and the little stream (8). Items earned on
 * an earlier visit are simply there; one earned now grows in with sparkles.
 * Also keeps the stream flowing and the lantern softly flickering.
 */
export class UnlocksSystem extends createSystem({
  bonsai: { required: [Bonsai] },
}) {
  private bonsai!: FirstEntity;
  private lantern: Object3D | null = null;
  private stream: Object3D | null = null;
  private dashes: InstancedMesh | null = null;
  private lanternGlow: MeshStandardMaterial | null = null;
  private potMat: MeshStandardMaterial | null = null;
  private potColor = new Color();
  private potRoughness = 1;
  private shown: Record<Unlock, boolean | null> = { glazedPot: null, lantern: null, stream: null, deepBreath: null };
  private reveals: Reveal[] = [];
  private sparkles!: Sparkles;
  private growth?: BonsaiGrowthSystem;
  private lids?: EyelidSystem;
  private time = 0;
  private flow = 0;
  private m = new Matrix4();
  private q = new Quaternion();
  private p = new Vector3();
  private t = new Vector3();
  private s = new Vector3();
  private burst = new Vector3();

  init(): void {
    this.bonsai = trackFirst(this.queries.bonsai, this.cleanupFuncs);
    this.growth = this.world.getSystem(BonsaiGrowthSystem);
    this.sparkles = new Sparkles();
    this.world.createTransformEntity(this.sparkles.mesh);
    this.lantern = this.world.getSceneObject('stone-lantern') ?? null;
    this.stream = this.world.getSceneObject('zen-stream') ?? null;
    if (this.lantern) this.lantern.visible = false;
    if (this.stream) this.stream.visible = false;
    this.dashes = (this.stream?.getObjectByName('FlowDashes') as InstancedMesh | undefined) ?? null;
    // Bind the pot once the bonsai exists (not a per-frame scene search).
    this.cleanupFuncs.push(this.queries.bonsai.subscribe('qualify', (e) => this.bindPot(e.object3D)));
    for (const e of this.queries.bonsai.entities) this.bindPot(e.object3D);
    // The merged lantern keeps one glowing mesh: own its material to flicker it.
    this.lantern?.traverse((o) => {
      const mesh = o as unknown as { isMesh?: boolean; material: MeshStandardMaterial };
      if (mesh.isMesh && mesh.material.emissiveIntensity >= 1) {
        mesh.material = mesh.material.clone();
        this.lanternGlow = mesh.material;
      }
    });
  }

  update(delta: number): void {
    this.time += delta;
    this.sparkles.update(delta);
    const b = this.bonsai.entity;
    if (!b) return;
    const xp = b.getValue(Bonsai, 'xp') ?? 0;
    this.apply('glazedPot', isUnlocked(xp, 'glazedPot'));
    this.apply('lantern', isUnlocked(xp, 'lantern'));
    this.apply('stream', isUnlocked(xp, 'stream'));
    this.animateReveals(delta);
    if (this.stream?.visible) this.flowStream(delta);
    if (this.lantern?.visible && this.lanternGlow) {
      this.lanternGlow.emissiveIntensity = 1.5 + 0.12 * Math.sin(this.time * 7.3) + 0.08 * Math.sin(this.time * 3.1);
    }
  }

  /** Brings one unlock to its state; `null` = first frame, where it appears without ceremony. */
  private apply(id: Unlock, on: boolean): void {
    const was = this.shown[id];
    if (was === on) return;
    // The pot is not bound yet: wait, keeping the pending change (and its ceremony).
    if (id === 'glazedPot' && !this.potMat) return;
    // A new unlock appears while the eyes are closed (EyelidSystem); the restored ones at once.
    this.lids ??= this.world.getSystem(EyelidSystem);
    if (was !== null && !(this.lids?.mayApply('unlock') ?? true)) return;
    this.shown[id] = on;
    const first = was === null;
    if (id === 'glazedPot') this.glaze(on, first);
    else {
      const obj = id === 'lantern' ? this.lantern : this.stream;
      if (!obj) return;
      obj.visible = on;
      if (on && !first) {
        obj.scale.setScalar(0.01);
        this.reveals.push({ obj, t: 0 });
        this.sparkleAt(obj, 0.06);
      }
    }
  }

  private bindPot(root: Object3D | undefined): void {
    if (this.potMat) return;
    const shell = root?.getObjectByName('PotShell') as unknown as { material: MeshStandardMaterial } | undefined;
    if (!shell) return;
    shell.material = shell.material.clone();
    this.potMat = shell.material;
    this.potColor.copy(this.potMat.color);
    this.potRoughness = this.potMat.roughness;
  }

  private glaze(on: boolean, first: boolean): void {
    const mat = this.potMat;
    if (!mat) return;
    mat.color.copy(on ? GLAZE : this.potColor);
    mat.roughness = on ? 0.3 : this.potRoughness;
    if (on && !first) {
      const tree = this.bonsai.entity?.object3D;
      if (tree) this.sparkleAt(tree, 0.04);
      this.growth?.sparkle();
    }
  }

  private sparkleAt(obj: Object3D, lift: number): void {
    obj.getWorldPosition(this.burst);
    this.burst.y += lift;
    this.sparkles.burst(this.burst, 26, 0.09);
  }

  private animateReveals(delta: number): void {
    for (let i = this.reveals.length - 1; i >= 0; i--) {
      const r = this.reveals[i];
      r.t = Math.min(1, r.t + delta / REVEAL_SECONDS);
      const k = 1 - (1 - r.t) ** 3;
      r.obj.scale.setScalar(Math.max(0.01, k));
      if (r.t >= 1) this.reveals.splice(i, 1);
    }
  }

  /** Light streaks drift downstream, growing in at the source and fading at the mouth. */
  private flowStream(delta: number): void {
    const dashes = this.dashes;
    if (!dashes) return;
    this.flow = (this.flow + delta * FLOW_SPEED) % 1;
    for (let i = 0; i < FLOW_DASHES; i++) {
      const k = (i / FLOW_DASHES + this.flow) % 1;
      streamPoint(k, this.p).setY(DASH_Y);
      streamTangent(k, this.t);
      this.q.setFromAxisAngle(UP, -Math.atan2(this.t.z, this.t.x));
      const ends = Math.min(1, Math.min(k, 1 - k) * 8);
      this.s.set(0.4 + 0.6 * ends, 1, ends);
      dashes.setMatrixAt(i, this.m.compose(this.p, this.q, this.s));
    }
    dashes.instanceMatrix.needsUpdate = true;
  }
}
