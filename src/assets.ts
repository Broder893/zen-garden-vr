import { defineAssets } from '@iwsdk/core';
import { createZenTable } from './scene-assets/table.scene-asset.js';

export default defineAssets({
  'zen-table': createZenTable(),
});
