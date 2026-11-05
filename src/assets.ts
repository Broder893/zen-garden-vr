import { AssetType, defineAssets } from '@iwsdk/core';
import { createBonsai } from './scene-assets/bonsai.scene-asset.js';
import { createVisitFlower } from './scene-assets/decor.scene-asset.js';
import { createFirefly, createSeed } from './scene-assets/guide.scene-asset.js';
import { createBreathOrb, createMeditationStone } from './scene-assets/meditation.scene-asset.js';
import { createZenTable } from './scene-assets/table.scene-asset.js';
import { createShears, createWateringCan } from './scene-assets/tools.scene-asset.js';

const ui = (file: string, name: string) => ({
  url: `${import.meta.env.BASE_URL}ui/${file}`,
  type: AssetType.UIKitML,
  name,
});

export default defineAssets({
  'zen-table': createZenTable(),
  bonsai: createBonsai(),
  'watering-can': createWateringCan(),
  shears: createShears(),
  firefly: createFirefly(),
  seed: createSeed(),
  'meditation-stone': createMeditationStone(),
  'breath-orb': createBreathOrb(),
  'visit-flower': createVisitFlower(),
  'subtitle-panel': ui('subtitle.uikitml', 'Subtitle Panel'),
  'comfort-panel': ui('comfort.uikitml', 'Comfort Panel'),
  'breath-panel': ui('breath.uikitml', 'Breath Panel'),
});
