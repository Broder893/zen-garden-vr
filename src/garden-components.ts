import { createComponent, Types } from '@iwsdk/core';

/** Growth stages of the bonsai, in order. */
export const BonsaiStage = { Sprout: 0, Young: 1, Mature: 2, Blooming: 3 } as const;

/** The bonsai the player cares for. Water and prunedMask reset at each new stage. */
export const Bonsai = createComponent('Bonsai', {
  planted: { type: Types.Boolean, default: false, label: 'Seed planted' },
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

/** Tag: the glowing seed. Pinching it plants the bonsai and starts the session. */
export const Seed = createComponent('Seed', {});

/** Tag: the firefly guide that floats to the next task and speaks the subtitles. */
export const FireflyGuide = createComponent('FireflyGuide', {
  hoverHeight: { type: Types.Float32, default: 0.1, min: 0, max: 0.4, help: 'Metres above the current task target' },
});

/** The stone that starts and pauses a guided breathing session when pinched. */
export const MeditationStone = createComponent('MeditationStone', {
  // Limits keep the longest session within the 3 minutes the brief allows.
  breaths: { type: Types.Int8, default: 6, min: 1, max: 10, label: 'Breaths per session' },
  inhaleSeconds: { type: Types.Float32, default: 4, min: 2, max: 6 },
  holdSeconds: { type: Types.Float32, default: 2, min: 0, max: 4 },
  exhaleSeconds: { type: Types.Float32, default: 6, min: 2, max: 8 },
});

/** Tag: the orb that grows on each inhale and shrinks on each exhale. */
export const BreathOrb = createComponent('BreathOrb', {});
