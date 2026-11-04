import { defineAssets } from '@iwsdk/core';
import { createBonsai } from './scene-assets/bonsai.scene-asset.js';
import { createZenTable } from './scene-assets/table.scene-asset.js';
import { createShears, createWateringCan } from './scene-assets/tools.scene-asset.js';

export default defineAssets({
  'zen-table': createZenTable(),
  bonsai: createBonsai(),
  'watering-can': createWateringCan(),
  shears: createShears(),
});
