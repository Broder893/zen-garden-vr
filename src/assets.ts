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

/** Loaded before the garden appears, so the tree never pops from one model to another. */
const glb = (file: string, name: string) => ({
  url: `${import.meta.env.BASE_URL}models/${file}.glb`,
  type: AssetType.GLTF,
  priority: 'critical' as const,
  name,
});

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
  // The bonsai modelled in Blender, one file per stage (see src/blender-bonsai.ts).
  'bonsai-seed-glb': glb('bonsai_0_seed', 'Bonsai (Blender, seed)'),
  'bonsai-sprout-glb': glb('bonsai_1_sprout', 'Bonsai (Blender, sprout)'),
  'bonsai-young-glb': glb('bonsai_2_young', 'Bonsai (Blender, young)'),
  'bonsai-mature-glb': glb('bonsai_3_mature', 'Bonsai (Blender, mature)'),
  'bonsai-blooming-glb': glb('bonsai_4_blooming', 'Bonsai (Blender, blooming)'),
  'subtitle-panel': ui('subtitle.uikitml', 'Subtitle Panel'),
  'comfort-panel': ui('comfort.uikitml', 'Comfort Panel'),
  'breath-panel': ui('breath.uikitml', 'Breath Panel'),
  'level-badge': ui('level.uikitml', 'Level Badge'),
  'shared-sign': ui('shared.uikitml', 'Shared Sign'),
});
