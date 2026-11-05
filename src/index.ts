import { World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { GardenAudioSystem } from './audio-system.js';
import { BonsaiGrowthSystem } from './bonsai-growth.js';
import { BreathBreakSystem } from './breath-break.js';
import { ComfortSystem } from './comfort.js';
import { DwellSystem } from './dwell.js';
import { EntranceSystem } from './entrance.js';
import { FirstMomentsSystem } from './first-moments.js';
import { GuideSystem } from './guide.js';
import { LevelBadgeSystem } from './level-badge.js';
import { MeditationSystem } from './meditation.js';
import { PersistenceSystem } from './persistence.js';
import { PruningSystem } from './pruning.js';
import { VisitFlowerSystem } from './visit-flowers.js';
import { ReturnHomeSystem } from './return-home.js';
import { WateringSystem } from './watering.js';

World.create(
  document.getElementById('scene-container') as HTMLDivElement,
  projectOptions,
).then((world) => {
  world
    .registerSystem(WateringSystem)
    .registerSystem(PruningSystem)
    .registerSystem(BonsaiGrowthSystem)
    .registerSystem(ReturnHomeSystem)
    .registerSystem(MeditationSystem)
    .registerSystem(EntranceSystem)
    .registerSystem(PersistenceSystem)
    .registerSystem(ComfortSystem)
    .registerSystem(BreathBreakSystem)
    .registerSystem(GuideSystem)
    .registerSystem(DwellSystem)
    .registerSystem(GardenAudioSystem)
    .registerSystem(VisitFlowerSystem)
    .registerSystem(LevelBadgeSystem)
    .registerSystem(FirstMomentsSystem);
  if (import.meta.env.DEV) {
    // Dev only: lets .iwsdk-scripts/eval.mjs read live system state in tests.
    (window as unknown as { __zen?: unknown }).__zen = {
      guide: world.getSystem(GuideSystem),
      moments: world.getSystem(FirstMomentsSystem),
      meditation: world.getSystem(MeditationSystem),
      comfort: world.getSystem(ComfortSystem),
      dwell: world.getSystem(DwellSystem),
      breaks: world.getSystem(BreathBreakSystem),
      growth: world.getSystem(BonsaiGrowthSystem),
      persistence: world.getSystem(PersistenceSystem),
    };
  }
});
