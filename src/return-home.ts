import { createSystem, Entity, Grabbed, Quaternion, Vector3 } from '@iwsdk/core';
import { AssistHeld, ReturnHome } from './garden-components.js';

/** Released tools glide back to their authored spot on the table. */
export class ReturnHomeSystem extends createSystem({
  homes: { required: [ReturnHome] },
  resting: { required: [ReturnHome], excluded: [Grabbed, AssistHeld] },
}) {
  private homePos = new Vector3();
  private homeQuat = new Quaternion();

  init(): void {
    const capture = (entity: Entity) => {
      const obj = entity.object3D;
      if (!obj || entity.getValue(ReturnHome, 'captured')) return;
      obj.position.toArray(entity.getVectorView(ReturnHome, 'homePosition'));
      obj.quaternion.toArray(entity.getVectorView(ReturnHome, 'homeQuaternion'));
      entity.setValue(ReturnHome, 'captured', true);
    };
    this.cleanupFuncs.push(this.queries.homes.subscribe('qualify', capture));
    for (const e of this.queries.homes.entities) capture(e);
  }

  update(delta: number): void {
    const t = 1 - Math.exp(-6 * delta);
    for (const entity of this.queries.resting.entities) {
      const obj = entity.object3D;
      if (!obj || !entity.getValue(ReturnHome, 'captured')) continue;
      this.homePos.fromArray(entity.getVectorView(ReturnHome, 'homePosition'));
      this.homeQuat.fromArray(entity.getVectorView(ReturnHome, 'homeQuaternion'));
      if (obj.position.distanceToSquared(this.homePos) < 1e-8) continue;
      obj.position.lerp(this.homePos, t);
      obj.quaternion.slerp(this.homeQuat, t);
    }
  }
}
