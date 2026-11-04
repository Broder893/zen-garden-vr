import {
  Color,
  createSystem,
  Entity,
  GrabSystem,
  Grabbed,
  MeshBasicMaterial,
  Object3D,
  UIKit,
  UIKitMLAsset,
  Vector3,
} from '@iwsdk/core';
import { SHOOTS_BY_STAGE } from './bonsai-growth.js';
import {
  Bonsai,
  BonsaiStage,
  FireflyGuide,
  PruningShears,
  Seed,
  WateringCan,
} from './garden-components.js';
import { PruningSystem } from './pruning.js';
import { WateringSystem } from './watering.js';

/** Firefly moods: each tints the glow so the task reads before the words do. */
const MOOD = {
  welcome: new Color('#ffd76a'),
  water: new Color('#8fd3ff'),
  prune: new Color('#b8ff7a'),
  bloom: new Color('#ffb3d1'),
} as const;
type Mood = keyof typeof MOOD;

/** Short subtitle lines (English). Kept under ~60 characters each. */
export const LINES = {
  plantSeed: 'Welcome. Pinch the glowing seed to plant it.',
  planted: 'Your seed is planted. Let us help it grow.',
  pickCan: 'Pinch the watering can to lift it.',
  tiltCan: 'Tilt the can over the little tree to pour.',
  moveSpout: 'Bring the spout over the tree.',
  pouring: 'Gently... keep pouring.',
  grewYoung: 'It is growing! The glowing shoots need a trim.',
  grewMature: 'Beautiful. Your tree is getting stronger.',
  pickShears: 'Pinch the shears to pick them up.',
  touchShoot: 'Touch a glowing shoot with the blades.',
  snip: 'Snip! Nicely done.',
  bloomed: 'Your bonsai is in bloom. Well done.',
  rest: 'Rest here a while, or come back tomorrow.',
} as const;
export type LineId = keyof typeof LINES;

/** How long a one-off event line stays before the next task line returns. */
const EVENT_SECONDS = 3;
const SNIP_SECONDS = 1.6;

/**
 * Tutorial and guidance. Each frame it reads the garden state, picks the one
 * line and target that matter now, flies the firefly there and updates the
 * subtitle. One-off moments (planted, grew, snip) briefly take priority.
 */
export class GuideSystem extends createSystem({
  guide: { required: [FireflyGuide] },
  bonsai: { required: [Bonsai] },
  seeds: { required: [Seed] },
  seedPinched: { required: [Seed, Grabbed] },
  cans: { required: [WateringCan] },
  heldCans: { required: [WateringCan, Grabbed] },
  shears: { required: [PruningShears] },
  heldShears: { required: [PruningShears, Grabbed] },
}) {
  /** Current line id (read by audio/voice later). */
  line: LineId = 'plantSeed';
  private shownText = '';
  private subtitle: UIKit.Text | null = null;
  private panel: Object3D | null = null;
  private event: LineId | null = null;
  private eventLeft = 0;
  private lastStage = -1;
  private lastCuts = 0;
  private flash = 0;
  private time = 0;
  private mood: Mood = 'welcome';
  private color = new Color('#ffd76a');
  private mats: MeshBasicMaterial[] = [];
  private target = new Vector3();
  private head = new Vector3();
  private tmp = new Vector3();
  private watering?: WateringSystem;
  private pruning?: PruningSystem;
  private grab?: GrabSystem;

  init(): void {
    this.watering = this.world.getSystem(WateringSystem);
    this.pruning = this.world.getSystem(PruningSystem);
    this.grab = this.world.getSystem(GrabSystem);

    const panel = this.world.getSceneObject<UIKitMLAsset>('subtitle-panel');
    this.panel = panel ?? null;
    this.subtitle = panel?.getElementById<UIKit.Text>('subtitle') ?? null;
    if (this.subtitle) this.subtitle.name = 'subtitle';

    const bindGuide = (e: Entity) => {
      // Own the glow materials so recolouring never leaks into the asset prototype.
      e.object3D?.traverse((o) => {
        const mesh = o as unknown as { isMesh?: boolean; material: MeshBasicMaterial };
        if (!mesh.isMesh) return;
        mesh.material = mesh.material.clone();
        this.mats.push(mesh.material);
      });
    };
    const plant = (seed: Entity) => {
      for (const b of this.queries.bonsai.entities) b.setValue(Bonsai, 'planted', true);
      this.grab?.forceRelease(seed);
      if (seed.object3D) seed.object3D.visible = false;
      this.showEvent('planted', EVENT_SECONDS);
    };
    this.cleanupFuncs.push(
      this.queries.guide.subscribe('qualify', bindGuide),
      this.queries.seedPinched.subscribe('qualify', plant),
    );
    for (const e of this.queries.guide.entities) bindGuide(e);
  }

  update(delta: number): void {
    this.time += delta;
    this.player.head.getWorldPosition(this.head);
    this.disposePlantedSeeds();

    const bonsai = this.first(this.queries.bonsai.entities);
    if (!bonsai) return;
    this.watchEvents(bonsai);

    if (this.eventLeft > 0) this.eventLeft -= delta;
    const mood = this.chooseTask(bonsai);
    this.setLine(this.eventLeft > 0 && this.event ? this.event : this.line);
    this.moveFirefly(delta, mood);
    this.billboardPanel();
  }

  private showEvent(id: LineId, seconds: number): void {
    this.event = id;
    this.eventLeft = seconds;
  }

  private watchEvents(bonsai: Entity): void {
    const stage = bonsai.getValue(Bonsai, 'stage') ?? 0;
    if (this.lastStage >= 0 && stage !== this.lastStage) {
      if (stage === BonsaiStage.Young) this.showEvent('grewYoung', EVENT_SECONDS + 1);
      if (stage === BonsaiStage.Mature) this.showEvent('grewMature', EVENT_SECONDS);
      if (stage === BonsaiStage.Blooming) this.showEvent('bloomed', EVENT_SECONDS + 2);
    }
    this.lastStage = stage;
    const cuts = this.pruning?.cuts ?? 0;
    if (cuts !== this.lastCuts && this.eventLeft <= 0) this.showEvent('snip', SNIP_SECONDS);
    this.lastCuts = cuts;
  }

  /** Sets this.line and this.target for the one thing to do next; returns the mood. */
  private chooseTask(bonsai: Entity): Mood {
    const bonsaiObj = bonsai.object3D;
    if (!bonsai.getValue(Bonsai, 'planted')) {
      this.line = 'plantSeed';
      this.targetOf(this.first(this.queries.seeds.entities)?.object3D, 0);
      return 'welcome';
    }
    const stage = bonsai.getValue(Bonsai, 'stage') ?? 0;
    if (stage >= BonsaiStage.Blooming) {
      this.line = 'rest';
      this.targetOf(bonsaiObj, 0.3);
      return 'bloom';
    }

    const shoots = SHOOTS_BY_STAGE[stage] ?? [];
    const mask = bonsai.getValue(Bonsai, 'prunedMask') ?? 0;
    let nextShoot = -1;
    for (let i = 0; i < shoots.length && nextShoot < 0; i++) {
      if ((mask & (1 << i)) === 0) nextShoot = i;
    }
    if (nextShoot >= 0) {
      if (this.queries.heldShears.entities.size === 0) {
        this.line = 'pickShears';
        this.targetOf(this.first(this.queries.shears.entities)?.object3D, 0.02);
      } else {
        this.line = 'touchShoot';
        this.targetOf(bonsaiObj?.getObjectByName(shoots[nextShoot])?.getObjectByName('CutPoint'), -0.05);
      }
      return 'prune';
    }

    if (this.queries.heldCans.entities.size === 0) {
      this.line = 'pickCan';
      this.targetOf(this.first(this.queries.cans.entities)?.object3D, 0.12);
    } else if (this.watering?.wateringBonsai) {
      this.line = 'pouring';
      this.targetOf(bonsaiObj, 0.18);
    } else {
      this.line = this.watering?.pouring ? 'moveSpout' : 'tiltCan';
      this.targetOf(bonsaiObj, 0.18);
    }
    return 'water';
  }

  /** Target = object's world position raised by `lift` metres (plus hover height). */
  private targetOf(obj: Object3D | undefined, lift: number): void {
    if (!obj) return;
    obj.getWorldPosition(this.target);
    this.target.y += lift;
  }

  private setLine(id: LineId): void {
    const text = LINES[id];
    if (text === this.shownText) return;
    this.shownText = text;
    this.flash = 1;
    this.subtitle?.setProperties({ text });
  }

  private moveFirefly(delta: number, mood: Mood): void {
    const guide = this.first(this.queries.guide.entities);
    const obj = guide?.object3D;
    if (!guide || !obj) return;
    const hover = guide.getValue(FireflyGuide, 'hoverHeight') ?? 0.1;
    const t = this.time;
    // Gentle figure-of-eight drift around the hover point.
    this.tmp.set(
      this.target.x + Math.sin(t * 0.9) * 0.025,
      this.target.y + hover + Math.sin(t * 1.7) * 0.015,
      this.target.z + Math.sin(t * 0.9 * 2) * 0.012,
    );
    const parent = obj.parent;
    if (parent) parent.worldToLocal(this.tmp);
    obj.position.lerp(this.tmp, 1 - Math.exp(-2.2 * delta));

    if (mood !== this.mood) {
      this.mood = mood;
      this.flash = 1;
    }
    this.color.lerp(MOOD[mood], 1 - Math.exp(-3 * delta));
    this.flash = Math.max(0, this.flash - delta * 1.5);
    const pulse = 1 + 0.12 * Math.sin(t * 3) + 0.25 * this.flash;
    obj.scale.setScalar(pulse);
    for (let i = 1; i < this.mats.length; i++) this.mats[i].color.copy(this.color);
  }

  /** Yaw the subtitle panel toward the viewer so it never shows its back. */
  private billboardPanel(): void {
    const p = this.panel;
    if (!p) return;
    p.getWorldPosition(this.tmp);
    p.rotation.y = Math.atan2(this.head.x - this.tmp.x, this.head.z - this.tmp.z);
  }

  private disposePlantedSeeds(): void {
    for (const seed of this.queries.seeds.entities) {
      if (seed.object3D?.visible === false && !seed.hasComponent(Grabbed)) {
        seed.dispose();
      }
    }
  }

  private first(set: Set<Entity>): Entity | undefined {
    for (const e of set) return e;
    return undefined;
  }
}
