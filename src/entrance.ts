import {
  createSystem,
  Entity,
  HemisphereLightComponent,
  IBLGradient,
  PointLightComponent,
  VisibilityState,
} from '@iwsdk/core';
import { FireflyGuide } from './garden-components.js';

const WARM_UP_SECONDS = 4.5;
/** Light level the scene starts from on entering VR (fraction of authored). */
const START_LEVEL = 0.08;
/** Where the firefly comes from: high and far, so it is seen arriving. */
const FIREFLY_FROM = { x: 0.45, y: 1.55, z: -1.5 };

/**
 * The first moment in VR: the garden starts almost dark, the lantern warms
 * up and the firefly flies in from the distance to greet the player.
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

  init(): void {
    this.cleanupFuncs.push(
      this.world.visibilityState.subscribe((state) => {
        if (state === VisibilityState.Visible && this.t < 0) this.begin();
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
    this.apply(START_LEVEL);
  }

  update(delta: number): void {
    if (this.t < 0 || this.t >= WARM_UP_SECONDS) return;
    this.t = Math.min(WARM_UP_SECONDS, this.t + delta);
    const k = this.t / WARM_UP_SECONDS;
    // Ease in-out so the light blooms rather than switches on.
    this.apply(START_LEVEL + (1 - START_LEVEL) * k * k * (3 - 2 * k));
  }

  private apply(level: number): void {
    this.lantern?.setValue(PointLightComponent, 'intensity', this.lanternFull * level);
    this.fill?.setValue(HemisphereLightComponent, 'intensity', this.fillFull * level);
    if (this.iblFull > 0) this.level?.setValue(IBLGradient, 'intensity', this.iblFull * (0.3 + 0.7 * level));
  }
}
