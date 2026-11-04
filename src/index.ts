import { World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { GardenAudioSystem } from './audio-system.js';
import { BonsaiGrowthSystem } from './bonsai-growth.js';
import { EntranceSystem } from './entrance.js';
import { GuideSystem } from './guide.js';
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
    .registerSystem(GuideSystem)
    .registerSystem(GardenAudioSystem)
    .registerSystem(VisitFlowerSystem);
});
