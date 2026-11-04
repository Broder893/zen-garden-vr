import { World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { BonsaiGrowthSystem } from './bonsai-growth.js';
import { GuideSystem } from './guide.js';
import { MeditationSystem } from './meditation.js';
import { PruningSystem } from './pruning.js';
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
    .registerSystem(GuideSystem);
});
