import {
  createSystem,
  Entity,
  HemisphereLightComponent,
  IBLGradient,
  PointLightComponent,
  VisibilityState,
} from '@iwsdk/core';
import { EyelidSystem } from './eyelids.js';
import { FireflyGuide } from './garden-components.js';

const WARM_UP_SECONDS = 4.5;
/** Light level the scene starts from on entering VR (fraction of authored). */
const START_LEVEL = 0.08;
/** The visit starts with closed eyes, open after this long (changes since last time land unseen). */
const ENTRANCE_CLOSED_SECONDS = 1.2;
/** Coming back (headset back on, system menu closed): a shorter moment with closed eyes. */
const RETURN_CLOSED_SECONDS = 0.8;
/** Where the firefly comes from: high and far, so it is seen arriving. */
const FIREFLY_FROM = { x: 0.45, y: 1.55, z: -1.5 };

/**
 * The first moment in VR: the eyes open (src/eyelids.ts) onto a garden
 * almost dark, the lantern warms up and the firefly flies in from the
 * distance to greet the player. Coming back after a pause opens them again.
 * The flat browser preview stays fully lit.
 */
export class EntranceSystem extends createSystem({
  guide: { required: [FireflyGuide] },
}) {
  private lantern: Entity | null = null;
  private fill: Entity | null = null;
  private lanternFull = 0;
  private fillFull = 0;
  private level: Entity | null = null;
  private iblFull = 0;
  private t = -1;
  /** Warm-up level, 0..1 of the authored light. */
  private warm = 1;
  /** Extra dimming for calm moments (1 = none); eases toward dimTarget. */
  private dim = 1;
  private dimTarget = 1;

  /** True once the warm-up is far enough along for moments to be seen. */
  get lit(): boolean {
    return this.t >= WARM_UP_SECONDS * 0.7;
  }

  init(): void {
    this.cleanupFuncs.push(
      this.world.visibilityState.subscribe((state) => {
        if (state !== VisibilityState.Visible) return;
        if (this.t < 0) this.begin();
        // Back in the garden: open the eyes again onto whatever changed meanwhile.
        else this.world.getSystem(EyelidSystem)?.holdFor('return', RETURN_CLOSED_SECONDS);
      }),
    );
  }

  private begin(): void {
    this.lantern = this.world.getSceneEntity('lantern-light') ?? null;
    this.fill = this.world.getSceneEntity('soft-fill') ?? null;
    this.lanternFull = this.lantern?.getValue(PointLightComponent, 'intensity') ?? 0;
    this.fillFull = this.fill?.getValue(HemisphereLightComponent, 'intensity') ?? 0;
    // Environment light lives on the level root and carries most of the ambience.
    this.level = this.world.activeLevel.peek() ?? null;
    this.iblFull = this.level?.hasComponent(IBLGradient)
      ? (this.level.getValue(IBLGradient, 'intensity') ?? 0)
      : 0;
    this.t = 0;
    for (const e of this.queries.guide.entities) {
      const obj = e.object3D;
      if (!obj) continue;
      obj.position.set(FIREFLY_FROM.x, FIREFLY_FROM.y, FIREFLY_FROM.z);
      obj.parent?.worldToLocal(obj.position);
    }
    this.warm = START_LEVEL;
    this.apply(START_LEVEL * this.dim);
    // Eyes closed while the garden settles (EyelidSystem), opening as the lantern warms.
    this.world.getSystem(EyelidSystem)?.holdFor('entrance', ENTRANCE_CLOSED_SECONDS);
  }

  /** Dims the garden toward `level` (1 = normal), e.g. during a breathing break. */
  dimTo(level: number): void {
    this.dimTarget = level;
  }

  update(delta: number): void {
    if (this.t < 0) return;
    const warming = this.t < WARM_UP_SECONDS;
    const dimming = Math.abs(this.dim - this.dimTarget) > 1e-3;
    if (!warming && !dimming) return;
    if (warming) {
      this.t = Math.min(WARM_UP_SECONDS, this.t + delta);
      const k = this.t / WARM_UP_SECONDS;
      // Ease in-out so the light blooms rather than switches on.
      this.warm = START_LEVEL + (1 - START_LEVEL) * k * k * (3 - 2 * k);
    }
    if (dimming) {
      this.dim += (this.dimTarget - this.dim) * (1 - Math.exp(-1.5 * delta));
      if (Math.abs(this.dim - this.dimTarget) <= 1e-3) this.dim = this.dimTarget;
    }
    this.apply(this.warm * this.dim);
  }

  private apply(level: number): void {
    this.lantern?.setValue(PointLightComponent, 'intensity', this.lanternFull * level);
    this.fill?.setValue(HemisphereLightComponent, 'intensity', this.fillFull * level);
    if (this.iblFull > 0) this.level?.setValue(IBLGradient, 'intensity', this.iblFull * (0.3 + 0.7 * level));
  }
}
