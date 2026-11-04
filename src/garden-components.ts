import { createComponent, Types } from '@iwsdk/core';

/** Growth stages of the bonsai, in order. */
export const BonsaiStage = { Sprout: 0, Young: 1, Mature: 2, Blooming: 3 } as const;

/** The bonsai the player cares for. Water and prunedMask reset at each new stage. */
export const Bonsai = createComponent('Bonsai', {
  stage: { type: Types.Int8, default: 0, min: 0, max: 3, label: 'Stage (0 sprout .. 3 blooming)' },
  water: { type: Types.Float32, default: 0, min: 0, max: 1, label: 'Water for this stage (0..1)' },
  prunedMask: { type: Types.Int32, default: 0, label: 'Bitmask of shoots cut this stage' },
});

/** Tag: a grabbable watering can. Pours when tilted spout-down. */
export const WateringCan = createComponent('WateringCan', {
  pourThreshold: { type: Types.Float32, default: 0.35, min: 0, max: 1, help: 'How far the spout must point down (0 = level, 1 = straight down)' },
});

/** Tag: grabbable pruning shears. Touching a glowing shoot with the blades cuts it. */
export const PruningShears = createComponent('PruningShears', {
  cutRadius: { type: Types.Float32, default: 0.07, min: 0.01, max: 0.2, help: 'Metres between blade tip and shoot that count as a cut' },
});

/** Glides the object back to where it was authored once nobody holds it. */
export const ReturnHome = createComponent('ReturnHome', {
  captured: { type: Types.Boolean, default: false },
  homePosition: { type: Types.Vec3, default: [0, 0, 0] },
  homeQuaternion: { type: Types.Vec4, default: [0, 0, 0, 1] },
});
