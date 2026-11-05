import { World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { GardenAudioSystem } from './audio-system.js';
import { BonsaiGrowthSystem } from './bonsai-growth.js';
import { BreathBreakSystem } from './breath-break.js';
import { ComfortSystem } from './comfort.js';
import { DwellSystem } from './dwell.js';
import { DayNightSystem } from './day-night.js';
import { EntranceSystem } from './entrance.js';
import { FirstMomentsSystem } from './first-moments.js';
import { GuideSystem } from './guide.js';
import { HealthSystem } from './health.js';
import { LevelBadgeSystem } from './level-badge.js';
import { UnlocksSystem } from './unlocks.js';
import { MeditationSystem } from './meditation.js';
import { PerfSystem } from './perf.js';
import { PersistenceSystem } from './persistence.js';
import { PruningSystem } from './pruning.js';
import { RakeSystem } from './rake.js';
import { SeasonSystem } from './season.js';
import { SharedTreeSystem } from './shared-tree.js';
import { WeatherSystem } from './weather.js';
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
    .registerSystem(HealthSystem)
    .registerSystem(SeasonSystem)
    .registerSystem(DayNightSystem)
    .registerSystem(WeatherSystem)
    .registerSystem(ReturnHomeSystem)
    .registerSystem(MeditationSystem)
    .registerSystem(EntranceSystem)
    // Before PersistenceSystem, which removes ?fresh from the address.
    .registerSystem(SharedTreeSystem)
    .registerSystem(PersistenceSystem)
    // After PersistenceSystem: ?fresh clears the kept sand before it is loaded.
    .registerSystem(RakeSystem)
    .registerSystem(ComfortSystem)
    .registerSystem(BreathBreakSystem)
    .registerSystem(GuideSystem)
    .registerSystem(DwellSystem)
    .registerSystem(GardenAudioSystem)
    .registerSystem(VisitFlowerSystem)
    .registerSystem(LevelBadgeSystem)
    .registerSystem(UnlocksSystem)
    .registerSystem(FirstMomentsSystem)
    .registerSystem(PerfSystem);
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
      rake: world.getSystem(RakeSystem),
      health: world.getSystem(HealthSystem),
      season: world.getSystem(SeasonSystem),
      dayNight: world.getSystem(DayNightSystem),
      weather: world.getSystem(WeatherSystem),
      perf: world.getSystem(PerfSystem),
      shared: world.getSystem(SharedTreeSystem),
      watering: world.getSystem(WateringSystem),
    };
  }
});
