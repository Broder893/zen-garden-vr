import {
  CatmullRomCurve3,
  createSystem,
  Object3D,
  UIKit,
  UIKitMLAsset,
  Vector3,
  VisibilityState,
} from '@iwsdk/core';
import { trackFirst, FirstEntity } from './ecs-utils.js';
import { EyelidSystem } from './eyelids.js';
import { FirstMomentsSystem } from './first-moments.js';
import { Bonsai, FireflyGuide, Seed } from './garden-components.js';

/** The flight from the forest to the seed (seconds); the whole arrival stays under 6 s. */
const FLIGHT_SECONDS = 5.8;
/** It starts as the lids begin to open (1 = closed): the jump to the forest is never seen. */
const LIDS_OPENING = 0.95;
/** The title: fades in, stays a moment, fades out over 3 s. */
const TITLE_IN = 0.6;
const TITLE_HOLD = 1.2;
const TITLE_OUT = 3;
/**
 * The way in: out of the trees on the left, down to the table's far side, a
 * slow loop around it (never between the eyes and the table, never closer than
 * about 60 cm to them), and down onto the seed. The last point is the seed's.
 */
const PATH: [number, number, number][] = [
  [-1.6, 1.75, -2.5],
  [-0.95, 1.3, -1.45],
  [-0.55, 1.1, -1.05],
  [0.05, 1.08, -1.2],
  [0.55, 1.04, -0.85],
  [0, 1, -0.6],
];

/**
 * The first visit's arrival: as the eyes open, the firefly flies in from the
 * forest, circles the table slowly and settles on the seed, while "Bloom
 * Break" appears in light above the garden and fades in 3 s. At most 6 s;
 * the seed can be pinched all along (nothing waits for the flight). Runs
 * after the GuideSystem, which steers the firefly again once it lands.
 */
export class ArrivalSystem extends createSystem({
  guide: { required: [FireflyGuide] },
  seeds: { required: [Seed] },
  bonsai: { required: [Bonsai] },
}) {
  /** Seconds into the arrival (-1 before, Infinity once done or skipped). */
  t = -1;
  private curve: CatmullRomCurve3 | null = null;
  private points = PATH.map(([x, y, z]) => new Vector3(x, y, z));
  private seedAt = new Vector3();
  private p = new Vector3();
  private title: Object3D | null = null;
  private titleCard: UIKit.Text | null = null;
  private shownOpacity = -1;
  private guideRef!: FirstEntity;
  private seedRef!: FirstEntity;
  private bonsaiRef!: FirstEntity;
  private lids?: EyelidSystem;
  private moments?: FirstMomentsSystem;

  init(): void {
    this.guideRef = trackFirst(this.queries.guide, this.cleanupFuncs);
    this.seedRef = trackFirst(this.queries.seeds, this.cleanupFuncs);
    this.bonsaiRef = trackFirst(this.queries.bonsai, this.cleanupFuncs);
    const title = this.world.getSceneObject<UIKitMLAsset>('title-panel');
    this.title = title ?? null;
    this.titleCard = title?.getElementById<UIKit.Text>('title-card') ?? null;
    if (title) title.visible = false;
  }

  update(delta: number): void {
    if (this.t === Infinity) return;
    if (this.world.visibilityState.peek() !== VisibilityState.Visible) return;
    if (this.t < 0) {
      const b = this.bonsaiRef.entity;
      if (!b) return;
      // Only on a first visit: an empty pot and a seed waiting.
      if ((b.getValue(Bonsai, 'planted') ?? false) || !this.seedRef.entity) return this.finish();
      this.lids ??= this.world.getSystem(EyelidSystem);
      if ((this.lids?.amount ?? 0) > LIDS_OPENING) return;
      this.begin();
    }
    this.t += delta;
    this.fly();
    this.showTitle();
    if (this.t >= Math.max(FLIGHT_SECONDS, TITLE_IN + TITLE_HOLD + TITLE_OUT)) this.finish();
  }

  private begin(): void {
    this.t = 0;
    const seed = this.seedRef.entity?.object3D;
    const hover = this.guideRef.entity?.getValue(FireflyGuide, 'hoverHeight') ?? 0.1;
    if (seed) {
      seed.getWorldPosition(this.seedAt);
      this.points[this.points.length - 1].set(this.seedAt.x, this.seedAt.y + hover, this.seedAt.z);
    }
    this.curve = new CatmullRomCurve3(this.points, false, 'centripetal');
    if (this.title) this.title.visible = true;
    this.moments ??= this.world.getSystem(FirstMomentsSystem);
    if (this.moments) this.moments.wonderShown = true;
  }

  /** Along the path with a gentle start and landing (smoothstep over its length). */
  private fly(): void {
    const obj = this.guideRef.entity?.object3D;
    if (!obj || !this.curve || this.t > FLIGHT_SECONDS) return;
    const k = this.t / FLIGHT_SECONDS;
    this.curve.getPointAt(k * k * (3 - 2 * k), this.p);
    if (obj.parent) obj.parent.worldToLocal(this.p);
    obj.position.copy(this.p);
  }

  private showTitle(): void {
    const t = this.t;
    const a =
      t < TITLE_IN ? t / TITLE_IN : t < TITLE_IN + TITLE_HOLD ? 1 : Math.max(0, 1 - (t - TITLE_IN - TITLE_HOLD) / TITLE_OUT);
    const shown = Math.round(a * 20) / 20;
    if (shown === this.shownOpacity) return;
    this.shownOpacity = shown;
    this.titleCard?.setProperties({ opacity: shown });
    if (this.title) this.title.visible = shown > 0;
  }

  private finish(): void {
    this.t = Infinity;
    if (this.title) this.title.visible = false;
  }
}
