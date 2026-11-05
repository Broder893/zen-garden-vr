import { AssetType, defineAssets } from '@iwsdk/core';
import { createGardenBackdrop } from './scene-assets/backdrop.scene-asset.js';
import { createBonsai } from './scene-assets/bonsai.scene-asset.js';
import { createVisitFlower } from './scene-assets/decor.scene-asset.js';
import { createFirefly, createSeed } from './scene-assets/guide.scene-asset.js';
import { createBreathOrb, createMeditationStone } from './scene-assets/meditation.scene-asset.js';
import { createSharedTree, createStoneBasin } from './scene-assets/shared-tree.scene-asset.js';
import { createZenTable } from './scene-assets/table.scene-asset.js';
import { createStoneLantern, createStream } from './scene-assets/unlocks.scene-asset.js';
import { createShears, createWateringCan } from './scene-assets/tools.scene-asset.js';

const ui = (file: string, name: string) => ({
  url: `${import.meta.env.BASE_URL}ui/${file}`,
  type: AssetType.UIKitML,
  name,
});

export default defineAssets({
  'zen-table': createZenTable(),
  'garden-backdrop': createGardenBackdrop(),
  bonsai: createBonsai(),
  'watering-can': createWateringCan(),
  shears: createShears(),
  firefly: createFirefly(),
  seed: createSeed(),
  'meditation-stone': createMeditationStone(),
  'breath-orb': createBreathOrb(),
  'visit-flower': createVisitFlower(),
  'stone-lantern': createStoneLantern(),
  'zen-stream': createStream(),
  'shared-tree': createSharedTree(),
  'stone-basin': createStoneBasin(),
  'subtitle-panel': ui('subtitle.uikitml', 'Subtitle Panel'),
  'comfort-panel': ui('comfort.uikitml', 'Comfort Panel'),
  'breath-panel': ui('breath.uikitml', 'Breath Panel'),
  'level-badge': ui('level.uikitml', 'Level Badge'),
  'shared-sign': ui('shared.uikitml', 'Shared Sign'),
});
