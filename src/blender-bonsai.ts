import { AssetManager, createSystem, Material, Mesh, Object3D } from '@iwsdk/core';
import { Bonsai } from './garden-components.js';

/** The model's cut points (empties cut_NN) that the glowing mature shoots move onto. */
const SHOOT_AT: Record<string, string> = {
  Overgrowth_Mature_0: 'cut_01',
  Overgrowth_Mature_1: 'cut_02',
  Overgrowth_Mature_2: 'cut_04',
};
/** Parts that go with the tree (they droop and grow with the Mature stage group). */
const TREE = ['trunk', 'foliage'];
/** Parts that go with the pot (always shown once planted). */
const POT = ['pot', 'soil', 'moss'];
/** Seasonal and health extras: always in the model, hidden until the game shows them. */
const EXTRAS = ['snow', 'fallen', 'puddle'];

/**
 * Trial, only with ?bonsai=blender: the mature bonsai modelled in Blender
 * (public/models/bonsai_3_mature.glb) replaces the procedural mature tree and
 * pot. The foliage and soil take the materials Health and Growth already own,
 * so season, wilt and wet soil still tint them from code; the glowing mature
 * shoots move onto the model's cut points. Everything else is unchanged.
 */
export class BlenderBonsaiSystem extends createSystem({ bonsai: { required: [Bonsai] } }) {
  /** 'off', 'loading', 'on' or 'failed' (read by tests). */
  status: 'off' | 'loading' | 'on' | 'failed' = 'off';
  private wanted = false;

  init(): void {
    this.wanted = new URLSearchParams(window.location.search).get('bonsai') === 'blender';
  }

  update(): void {
    if (!this.wanted || this.status !== 'off') return;
    const root = this.queries.bonsai.entities.values().next().value?.object3D;
    if (!root) return;
    this.status = 'loading';
    AssetManager.loadGLTFById('bonsai-mature-glb')
      .then((gltf) => {
        this.swap(root, gltf.scene.clone());
        this.status = 'on';
        console.info('[zen] bonsai: Blender mature model in use (trial)');
      })
      .catch((err: unknown) => {
        this.status = 'failed';
        console.warn('[zen] bonsai: Blender model not loaded, keeping the procedural tree', err);
      });
  }

  private swap(root: Object3D, model: Object3D): void {
    const mature = root.getObjectByName('Mature');
    const pot = root.getObjectByName('Pot');
    if (!mature || !pot) return;
    const owned = (group: Object3D, test: (m: Material) => boolean) =>
      (group.children.find((c) => (c as Mesh).isMesh && test((c as Mesh).material as Material)) as Mesh | undefined)
        ?.material as Material | undefined;
    const leaf = owned(mature, (m) => m.name === 'Leaf');
    const soil = (pot.getObjectByName('Soil') as Mesh | undefined)?.material as Material | undefined;
    const part = (name: string) => model.getObjectByName(name) as Mesh | undefined;

    // The procedural tree leaves; its group stays, so growth, droop and sway still apply.
    mature.clear();
    for (const name of TREE) {
      const m = part(name);
      if (!m) continue;
      if (name === 'foliage' && leaf) m.material = leaf;
      m.name = `Blender_${name}`;
      mature.add(m);
    }
    for (const c of pot.children) c.visible = false;
    for (const name of POT) {
      const m = part(name);
      if (!m) continue;
      if (name === 'soil' && soil) m.material = soil;
      m.name = `Blender_${name}`;
      pot.add(m);
    }
    for (const name of EXTRAS) {
      const m = part(name);
      if (!m) continue;
      m.name = `Blender_${name}`;
      m.visible = false;
      root.add(m);
    }
    for (const [shoot, cutName] of Object.entries(SHOOT_AT)) {
      const g = root.getObjectByName(shoot);
      const cut = model.getObjectByName(cutName);
      const base = g?.userData.shootBase as [number, number, number] | undefined;
      if (!g || !cut || !base) continue;
      g.position.set(cut.position.x - base[0], cut.position.y - base[1], cut.position.z - base[2]);
    }
  }
}
