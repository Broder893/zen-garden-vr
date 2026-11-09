import { World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { GardenAudioSystem } from './audio-system.js';
import { BlenderBonsaiSystem } from './blender-bonsai.js';
import { BonsaiGrowthSystem } from './bonsai-growth.js';
import { BreathBreakSystem } from './breath-break.js';
import { ComfortSystem } from './comfort.js';
import { DwellSystem } from './dwell.js';
import { DayNightSystem } from './day-night.js';
import { EntranceSystem } from './entrance.js';
import { EyelidSystem } from './eyelids.js';
import { FirstMomentsSystem } from './first-moments.js';
import { GuideSystem } from './guide.js';
import { GazeCareSystem } from './gaze-care.js';
import { HealthSystem } from './health.js';
import { InputModeSystem } from './input-mode.js';
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

/** When this tab last retried a start that failed (sessionStorage: this tab only). */
const RETRY_KEY = 'zen-garden-vr/start-retry';
/** A failed start is retried once, unless one was retried this recently (no reload loop). */
const RETRY_GAP_MS = 10 * 60 * 1000;

World.create(
  document.getElementById('scene-container') as HTMLDivElement,
  projectOptions,
).then((world) => {
  try {
    sessionStorage.removeItem(RETRY_KEY);
  } catch {
    /* storage blocked: nothing to clear */
  }
  world
    // First: it swaps the Blender models in before the other bonsai systems find the parts by name.
    .registerSystem(BlenderBonsaiSystem)
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
    .registerSystem(InputModeSystem)
    .registerSystem(BreathBreakSystem)
    .registerSystem(GuideSystem)
    .registerSystem(DwellSystem)
    .registerSystem(GazeCareSystem)
    .registerSystem(GardenAudioSystem)
    .registerSystem(VisitFlowerSystem)
    .registerSystem(LevelBadgeSystem)
    .registerSystem(UnlocksSystem)
    .registerSystem(FirstMomentsSystem)
    .registerSystem(PerfSystem)
    // Last: the eyelids follow everything that may close or open them.
    .registerSystem(EyelidSystem);
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
      input: world.getSystem(InputModeSystem),
      gazeCare: world.getSystem(GazeCareSystem),
      shared: world.getSystem(SharedTreeSystem),
      watering: world.getSystem(WateringSystem),
      blender: world.getSystem(BlenderBonsaiSystem),
      lids: world.getSystem(EyelidSystem),
    };
  }
}).catch((err: unknown) => {
  // A file that failed to load (one dropped request on a weak connection) stops the
  // start: try the whole start once more, a moment later. A second failure shows a
  // line on the page's card (index.html).
  console.error('[zen] the garden could not start', err);
  let retried = true;
  try {
    retried = Date.now() - Number(sessionStorage.getItem(RETRY_KEY) ?? 0) < RETRY_GAP_MS;
    if (!retried) sessionStorage.setItem(RETRY_KEY, String(Date.now()));
  } catch {
    /* storage blocked: no way to know it was tried, so do not loop */
  }
  if (!retried) setTimeout(() => window.location.reload(), 1500);
  // Already retried (or no way to tell): say so on the card instead of leaving it silent.
  else document.getElementById('load-error')?.removeAttribute('hidden');
});
