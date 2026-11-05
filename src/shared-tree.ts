import {
  createSystem,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  UIKit,
  UIKitMLAsset,
  Vector3,
  VisibilityState,
} from '@iwsdk/core';
import { ComfortSystem } from './comfort.js';
import { trackFirst, FirstEntity } from './ecs-utils.js';
import { Sparkles } from './effects/sparkles.js';
import { Bonsai, BonsaiStage } from './garden-components.js';
import type { LineId } from './guide.js';
import { MeditationSystem } from './meditation.js';
import {
  fetchTree,
  loadShared,
  MAX_PER_REQUEST,
  SHARED_TREE_URL,
  SharedLocal,
  sendCare,
  storeShared,
  TreeState,
  utcDay,
} from './save/shared-tree-api.js';
import { WateringSystem } from './watering.js';

/** Horizontal metres between the spout and the basin centre that still fill it. */
export const BASIN_REACH = 0.17;
/** Same as DwellSystem's reach for tipping a hands-free can. */
const ASSISTED_REACH = 0.25;
/** Seconds of pouring into the basin for one care. */
const CARE_POUR_SECONDS = 1.2;
/** After a care the basin rests this long before the next one counts. */
const CARE_COOLDOWN = 10;
/** Asks the service for news this often while in VR (seconds). */
const SYNC_SECONDS = 60;
/** Seconds of quiet (no other line, no session, no pouring) before the introduction. */
const INTRO_CALM_SECONDS = 8;
/** The light carrying the water to the tree takes this long. */
const FLIGHT_SECONDS = 2.4;
/** Today's cares at which the canopy fills, then blossoms in two waves. */
const FULL_AT = 1;
const BLOSSOM_AT = [8, 20];
/** The basin's world x, beside the table on the right; it moves left when only the left hand is used. */
const BASIN_X = 0.7;
/** Its yaw on the right (radians, as authored: -60 degrees); mirrored on the left. */
const BASIN_YAW = Math.PI / 3;
/** Where the light enters the canopy, above the tree's origin. */
const CANOPY_HEIGHT = 2.35;

type Guide = { showEvent(id: LineId, seconds: number, target?: Object3D | null): void; readonly busy: boolean };

/**
 * The shared tree (PROGETTO.md point 8): one big tree in the garden that
 * everyone who visits cares for together, asynchronously. Pouring the can
 * into the stone basin beside the table sends a light to the tree and adds a
 * care to the online count (server/shared-tree). The tree fills and blossoms
 * with today's cares from all gardens; a sign shows the counts. Offline, the
 * last counts stay on the sign, cares wait on this device and go out later,
 * and nothing else changes: the garden never depends on the service.
 */
export class SharedTreeSystem extends createSystem({
  bonsai: { required: [Bonsai] },
}) {
  /** null until the first answer; then whether the service answered last time. */
  online: boolean | null = null;
  /** Cares this player gave this visit (read by the audio). */
  caresGiven = 0;
  /** Lights that reached the tree (read by the audio). */
  arrivals = 0;
  /** True while pouring lands in the basin (read by the guide). */
  fillingBasin = false;
  private local: SharedLocal = loadShared();
  private bonsai!: FirstEntity;
  private watering?: WateringSystem;
  private comfort?: ComfortSystem;
  private meditation?: MeditationSystem;
  private guide?: Guide;
  private tree: Object3D | null = null;
  private basin: Object3D | null = null;
  /** The water surface: where the firefly hovers when it introduces the basin. */
  private waterSurface: Object3D | null = null;
  private sign: Object3D | null = null;
  private signCount: UIKit.Text | null = null;
  private signNote: UIKit.Text | null = null;
  private groups: { full: Object3D | null; blossoms: (Object3D | null)[] } = { full: null, blossoms: [] };
  private leaf: MeshStandardMaterial | null = null;
  private water: MeshStandardMaterial | null = null;
  private orb!: Mesh;
  private sparkles!: Sparkles;
  private pour = 0;
  private cooldown = 0;
  private flight = -1;
  private glow = 0;
  private sinceSync = SYNC_SECONDS;
  private syncing = false;
  private shown = '';
  private shownKey = -1;
  private thanked = false;
  private calm = 0;
  private basinPos = new Vector3();
  private treeTop = new Vector3();
  private from = new Vector3();
  private head = new Vector3();
  private p = new Vector3();

  init(): void {
    // ?fresh (demos) replays the introduction; the garden id is kept.
    if (new URLSearchParams(window.location.search).has('fresh')) this.local.introShown = false;
    this.bonsai = trackFirst(this.queries.bonsai, this.cleanupFuncs);
    this.orb = new Mesh(
      new IcosahedronGeometry(0.03, 1),
      new MeshBasicMaterial({ color: '#bfe8ff', transparent: true, opacity: 0.95, depthWrite: false }),
    );
    this.orb.name = 'SharedTreeLight';
    this.orb.visible = false;
    this.world.createTransformEntity(this.orb);
    this.sparkles = new Sparkles(40, '#ffd9e6', 0.025);
    this.world.createTransformEntity(this.sparkles.mesh);
    this.cleanupFuncs.push(
      this.world.visibilityState.subscribe((state) => {
        // Entering VR asks for news at once.
        if (state === VisibilityState.Visible) this.sinceSync = SYNC_SECONDS;
      }),
    );
    // News at once on load too, so the sign is live before entering VR.
    this.sync();
  }

  update(delta: number): void {
    if (!this.tree && !this.bind()) return;
    this.watering ??= this.world.getSystem(WateringSystem);
    this.comfort ??= this.world.getSystem(ComfortSystem);
    this.meditation ??= this.world.getSystem(MeditationSystem);
    this.place();
    if (this.world.visibilityState.peek() === VisibilityState.Visible) {
      this.sinceSync += delta;
      if (this.sinceSync >= SYNC_SECONDS) this.sync();
      this.detectPour(delta);
      this.introduce(delta);
    }
    this.animate(delta);
    this.sparkles.update(delta);
    this.updateSign();
  }

  /** The guide registers itself (it is created after this system). */
  attachGuide(guide: Guide): void {
    this.guide = guide;
  }

  /** True when `at` (a spout) is over the basin: for hands-free pouring (DwellSystem). */
  overBasin(at: Vector3, reach = BASIN_REACH): boolean {
    if (!this.basin) return false;
    const dx = at.x - this.basinPos.x;
    const dz = at.z - this.basinPos.z;
    return dx * dx + dz * dz < reach * reach && at.y > this.basinPos.y;
  }

  /** Today's counts as shown: the last heard, plus cares still on their way. */
  get today(): number {
    return (this.fresh ? (this.local.cache?.today ?? 0) : 0) + this.local.pending;
  }

  /** The cached counts are today's: just heard from the service (its day wins over this device's clock), or dated today. */
  private get fresh(): boolean {
    const c = this.local.cache;
    return !!c && (this.online === true || c.day === utcDay());
  }

  private bind(): boolean {
    const tree = this.world.getSceneObject<Object3D>('shared-tree');
    const basin = this.world.getSceneObject<Object3D>('stone-basin');
    if (!tree || !basin) return false;
    this.tree = tree;
    this.basin = basin;
    this.groups.full = tree.getObjectByName('CanopyFull') ?? null;
    this.groups.blossoms = BLOSSOM_AT.map((_, i) => tree.getObjectByName(`Blossom_${i}`) ?? null);
    tree.traverse((o) => {
      const m = (o as Mesh).material as MeshStandardMaterial | undefined;
      if (m?.name === 'SharedLeaf') this.leaf = m;
    });
    this.waterSurface = basin.getObjectByName('Water') ?? null;
    basin.traverse((o) => {
      const m = (o as Mesh).material as MeshStandardMaterial | undefined;
      if (m?.name === 'BasinWater') this.water = m;
    });
    const sign = this.world.getSceneObject<UIKitMLAsset>('shared-sign');
    this.sign = sign ?? null;
    this.signCount = sign?.getElementById<UIKit.Text>('shared-count') ?? null;
    this.signNote = sign?.getElementById<UIKit.Text>('shared-note') ?? null;
    return true;
  }

  /** The basin and its sign stand on the side of the hand that holds the can. */
  private place(): void {
    const left = this.comfort?.settings.hands === 'left';
    const x = left ? -BASIN_X : BASIN_X;
    if (this.basin) {
      this.basin.position.x = x;
      // Mirrored, so the bamboo post stays outside the table on either side.
      this.basin.rotation.y = left ? BASIN_YAW : -BASIN_YAW;
      this.basin.updateWorldMatrix(true, false);
      this.basin.getWorldPosition(this.basinPos);
      this.basinPos.y += 0.785; // the water surface (scene-asset)
    }
    if (this.sign) {
      this.sign.position.x = x;
      this.player.head.getWorldPosition(this.head);
      this.sign.lookAt(this.head);
    }
  }

  private detectPour(delta: number): void {
    this.cooldown = Math.max(0, this.cooldown - delta);
    const w = this.watering;
    // A hands-free can tips by itself wherever its spout points: its body over the basin is enough.
    this.fillingBasin =
      !!w?.pouring && (this.overBasin(w.pourTip) || (w.pourAssisted && this.overBasin(w.pourCan, ASSISTED_REACH)));
    if (!this.fillingBasin) {
      this.pour = Math.max(0, this.pour - delta);
      return;
    }
    this.glow = Math.max(this.glow, 0.5);
    if (this.cooldown > 0) return;
    this.pour += delta;
    if (this.pour >= CARE_POUR_SECONDS) {
      this.pour = 0;
      this.cooldown = CARE_COOLDOWN;
      this.care();
    }
  }

  /** One care: the light leaves the basin; the count goes out (or waits, offline). */
  private care(): void {
    this.caresGiven++;
    this.local.pending = Math.min(this.local.pending + 1, MAX_PER_REQUEST * 4);
    storeShared(this.local);
    this.flight = 0;
    this.from.copy(this.basinPos);
    if (!this.thanked && !this.guide?.busy) {
      this.thanked = true;
      this.guide?.showEvent(this.online === false || !SHARED_TREE_URL ? 'sharedOffline' : 'sharedThanks', 5);
    }
    this.flush();
  }

  /**
   * The firefly introduces the basin once, after the first five minutes are
   * safely over (a mature tree) and after a quiet moment, so it never cuts
   * into another line.
   */
  private introduce(delta: number): void {
    if (this.local.introShown || !this.guide) return;
    const stage = this.bonsai.entity?.getValue(Bonsai, 'stage') ?? 0;
    const quiet = stage >= BonsaiStage.Mature && !this.guide.busy && !this.meditation?.active && !this.watering?.pouring;
    this.calm = quiet ? this.calm + delta : 0;
    if (this.calm < INTRO_CALM_SECONDS) return;
    this.local.introShown = true;
    storeShared(this.local);
    // The firefly flies to the basin while it speaks.
    this.guide.showEvent('sharedIntro', 7, this.waterSurface);
  }

  private sync(): void {
    this.sinceSync = 0;
    if (this.local.pending > 0) this.flush();
    else this.fetch();
  }

  private fetch(): void {
    if (this.syncing || !SHARED_TREE_URL) return;
    this.syncing = true;
    fetchTree()
      .then((state) => this.heard(state))
      .finally(() => {
        this.syncing = false;
        // A care made while this was on its way goes out now, not at the next sync.
        if (this.online && this.local.pending > 0) this.flush();
      });
  }

  /** Sends the waiting cares (a few at a time); on failure they wait for the next sync. */
  private flush(): void {
    if (this.syncing || !SHARED_TREE_URL || this.local.pending <= 0) return;
    this.syncing = true;
    const count = Math.min(MAX_PER_REQUEST, this.local.pending);
    sendCare(this.local.garden, count)
      .then((res) => {
        if (!res) return this.heard(null);
        // Sent: accepted ones are counted; refused ones (daily limit) are let go.
        this.local.pending = Math.max(0, this.local.pending - count);
        this.heard(res.state);
      })
      .finally(() => {
        this.syncing = false;
        if (this.online && this.local.pending > 0) this.flush();
      });
  }

  private heard(state: TreeState | null): void {
    this.online = !!state;
    if (state) this.local.cache = state;
    storeShared(this.local);
  }

  private animate(delta: number): void {
    const today = this.today;
    if (this.groups.full) this.groups.full.visible = today >= FULL_AT;
    this.groups.blossoms.forEach((g, i) => {
      if (g) g.visible = today >= BLOSSOM_AT[i];
    });
    // The light flies in an arc from the basin to the canopy.
    if (this.flight >= 0 && this.tree) {
      this.flight += delta / FLIGHT_SECONDS;
      this.tree.getWorldPosition(this.treeTop);
      this.treeTop.y += CANOPY_HEIGHT;
      const t = Math.min(1, this.flight);
      const e = t * t * (3 - 2 * t);
      this.p.lerpVectors(this.from, this.treeTop, e);
      this.p.y += Math.sin(Math.PI * e) * 0.8;
      this.orb.position.copy(this.p);
      this.orb.scale.setScalar(1 + 1.5 * e);
      this.orb.visible = true;
      if (this.flight >= 1) {
        this.flight = -1;
        this.orb.visible = false;
        this.arrivals++;
        this.sparkles.burst(this.treeTop, 30, 1.6);
        if (this.leaf) this.leaf.emissiveIntensity = 0.45;
      }
    }
    if (this.leaf && this.leaf.emissiveIntensity > 0) {
      this.leaf.emissiveIntensity = Math.max(0, this.leaf.emissiveIntensity - delta * 0.25);
    }
    this.glow = Math.max(0, this.glow - delta * 0.6);
    if (this.water) this.water.emissiveIntensity = 0.15 + this.glow;
  }

  /** Rebuilds the sign's text only when what it says changes (no strings built otherwise). */
  private updateSign(): void {
    const c = this.local.cache;
    const fresh = this.fresh;
    const today = this.today;
    const mode = !SHARED_TREE_URL || this.online === false ? 0 : this.online === null ? 1 : 2;
    const gardens = fresh ? (c?.gardens ?? 0) : 0;
    const total = c?.total ?? 0;
    const pending = this.local.pending > 0 ? 1 : 0;
    const key = (((today * 3 + mode) * 2 + pending) * 1e4 + Math.min(gardens, 9999)) * 1e7 + Math.min(total, 9999999);
    if (key === this.shownKey) return;
    this.shownKey = key;
    const count = today === 0 ? 'No cares yet today' : today === 1 ? '1 care today' : `${today} cares today`;
    let note: string;
    if (!SHARED_TREE_URL || this.online === false) {
      note = this.local.pending > 0 ? 'Offline - your care will be sent later' : 'Offline for now';
    } else if (this.online === null) {
      note = 'Listening for other gardens...';
    } else {
      note = gardens <= 1 ? `${total} cares in all` : `from ${gardens} gardens - ${total} in all`;
    }
    this.shown = count + '|' + note;
    this.signCount?.setProperties({ text: count });
    this.signNote?.setProperties({ text: note });
  }
}
