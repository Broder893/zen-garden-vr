import { World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';

World.create(
  document.getElementById('scene-container') as HTMLDivElement,
  projectOptions,
).then(() => {
  // Systems for bonsai, firefly guide, meditation and save are added in later steps.
});
