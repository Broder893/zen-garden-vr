import {
  AssetManager,
  createSystem,
  Entity,
  Group,
  Material,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  Vector3,
} from '@iwsdk/core';
import { Bonsai, BonsaiStage } from './garden-components.js';
import type { Season } from './save/atmosphere.js';
import { SeasonSystem } from './season.js';

type V3 = [number, number, number];

/** One model per stage (public/models, made in Blender); the seed file gives the pot. */
const POT_MODEL = 'bonsai-seed-glb';
const STAGE_MODELS: Record<number, { group: string; asset: string }> = {
  [BonsaiStage.Sprout]: { group: 'Sprout', asset: 'bonsai-sprout-glb' },
  [BonsaiStage.Young]: { group: 'Young', asset: 'bonsai-young-glb' },
  [BonsaiStage.Mature]: { group: 'Mature', asset: 'bonsai-mature-glb' },
  [BonsaiStage.Blooming]: { group: 'Blooming', asset: 'bonsai-blooming-glb' },
};

/**
 * Where the code-made parts go on each model. Glowing shoots start at the
 * model's cut points (cut_NN, the last one is the top). Healthy branches (a
 * wrong cut leaves their stump) grow up and out of the trunk from `from`
 * toward `to`, chosen by sampling each model's trunk so their cut point is at
 * least 9 cm from every glowing shoot's: a wrong cut is never an accident.
 */
const PLACES: Record<number, { shoots: [string, string][]; healthy: [string, V3, V3][] }> = {
  [BonsaiStage.Young]: {
    shoots: [
      ['Overgrowth_Young_0', 'cut_01'],
      ['Overgrowth_Young_1', 'cut_02'],
    ],
    healthy: [
      ['Healthy_Young_0', [-0.006, 0.085, -0.015], [-0.006, 0.108, -0.045]],
      ['Healthy_Young_1', [0.005, 0.085, 0.002], [0.032, 0.108, 0.013]],
    ],
  },
  [BonsaiStage.Mature]: {
    shoots: [
      ['Overgrowth_Mature_0', 'cut_01'],
      ['Overgrowth_Mature_1', 'cut_02'],
      ['Overgrowth_Mature_2', 'cut_04'],
    ],
    healthy: [
      ['Healthy_Mature_0', [0.024, 0.165, -0.011], [0.013, 0.188, -0.039]],
      ['Healthy_Mature_1', [0.006, 0.105, 0.002], [0.034, 0.128, 0.014]],
    ],
  },
  [BonsaiStage.Blooming]: {
    shoots: [
      ['Overgrowth_Mature_0', 'cut_01'],
      ['Overgrowth_Mature_1', 'cut_02'],
      ['Overgrowth_Mature_2', 'cut_06'],
    ],
    healthy: [
      ['Healthy_Mature_0', [0.012, 0.195, -0.046], [0.024, 0.217, -0.073]],
      ['Healthy_Mature_1', [0.023, 0.105, -0.001], [0.051, 0.128, 0.011]],
    ],
  },
};

/** Parts every stage model repeats; only the pot model's copy is used. */
const SHARED_POT_PARTS = new Set(['pot', 'soil', 'moss', 'glow', 'seed']);

/** Fallen leaves: raised clear of the soil and moss, and spread a little wider over the soil. */
const FALLEN_LIFT = 0.005;
const FALLEN_SPREAD = 1.35;
/** ...but never past the soil (radius 8 cm) onto the pot's rim. */
const FALLEN_MAX_RADIUS = 0.074;

/** Farthest a mesh's vertices reach from its vertical axis (local). */
function horizontalRadius(mesh: Mesh): number {
  const pos = mesh.geometry.attributes.position;
  let r = 0;
  for (let i = 0; i < pos.count; i++) r = Math.max(r, Math.hypot(pos.getX(i), pos.getZ(i)));
  return r || 1;
}

/** Excess water at which the model's puddle starts to show, and where it is full size. */
const PUDDLE_FROM = 0.1;
const PUDDLE_FULL = 0.5;
/** Its size from first sign to full (the model's puddle reaches 6.4 cm of the soil's 8). */
const PUDDLE_MIN = 0.35;
const PUDDLE_MAX = 0.78;
/** Healthy branches were made for the larger procedural tree. */
const BRANCH_SCALE = 0.75;
/** The models' own shoots to trim: shoot_NN_<season> sits on cut_NN, one look per season. */
const SHOOT_MESH = /^shoot_(\d+)_(spring|summer|autumn|winter)$/;
/**
 * The shoots' glow breathes so they read as "cut me" in every season. It
 * glows in the shoot's own vertex colour (green in spring and summer, orange
 * in autumn, brown twig and snow in winter), never white: a white glow washed
 * the colours out. A narrow pulse, so the colour always reads.
 */
const SHOOT_GLOW_MIN = 0.12;
const SHOOT_GLOW_MAX = 0.4;
const SHOOT_GLOW_RATE = 2.2;

/** Makes a shoot material glow in its vertex colour: emissive (white) times the vertex colour. */
function glowInOwnColour(mat: MeshStandardMaterial): void {
  if (mat.userData.ownColourGlow) return;
  mat.userData.ownColourGlow = true;
  mat.emissive.setRGB(1, 1, 1);
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\n#ifdef USE_COLOR\n\ttotalEmissiveRadiance *= vColor.rgb;\n#endif',
    );
  };
  mat.customProgramCacheKey = () => 'shoot-own-colour-glow';
  mat.needsUpdate = true;
}

/** One seasonal look of a model's shoot, worn by a glowing shoot group (Overgrowth_*). */
interface ShootSkin {
  group: Object3D;
  stage: number;
  season: Season;
  mesh: Mesh;
}

interface StageParts {
  cuts: Map<string, Vector3>;
  snow: Object3D | null;
  /** On the soil, outside the stage group: it must not sink when the canopy droops. */
  ground: Group;
  fallen: Object3D | null;
  puddle: Object3D | null;
  /** The model's shoots by number (cut_NN), one mesh per season. */
  shoots: Map<string, Map<Season, Mesh>>;
  /** The blooming model's blossoms: shown in spring and autumn only, so summer reads green. */
  flowers: Object3D | null;
}

/**
 * The bonsai modelled in Blender: one model per stage (seed pot, sprout,
 * young, mature, blooming) replaces the procedural tree when the garden
 * loads. The procedural tree stays as the fallback (?bonsai=classic, or a
 * model missing). Registered before the other bonsai systems, so they bind to
 * the new parts by the same names: the stage groups grow, droop and sway, the
 * foliage ('Leaf') and blossom ('Flower') take the season and health tints,
 * 'Soil' darkens when watered, 'PotShell' glazes. Glowing shoots and healthy
 * branches stay code-made and move onto each model (PLACES). The models'
 * snow shows in winter, fallen leaves in autumn, the puddle with excess water;
 * the blossoms show in spring and autumn only.
 */
export class BlenderBonsaiSystem extends createSystem({ bonsai: { required: [Bonsai] } }) {
  /** 'classic' (procedural tree), 'blender', or 'failed' (a model missing: procedural). */
  status: 'classic' | 'blender' | 'failed' = 'classic';
  private wanted = true;
  private root: Object3D | null = null;
  private entity: Entity | null = null;
  private stages = new Map<number, StageParts>();
  /** The same, as a list for the per-frame loop. */
  private stageList: { stage: number; parts: StageParts }[] = [];
  private glow: Object3D | null = null;
  /** The models' shoots on the glowing shoot groups, and the code-made look each group keeps as a fallback. */
  private skins: ShootSkin[] = [];
  private codeShoots = new Map<Object3D, Object3D[]>();
  private shootMats = new Set<MeshStandardMaterial>();
  private skinned = '';
  private time = 0;
  private placedStage = -2;
  private season?: SeasonSystem;
  private turn = new Quaternion();
  private tmp = new Vector3();
  private dirWas = new Vector3();
  private dirNow = new Vector3();

  init(): void {
    this.wanted = new URLSearchParams(window.location.search).get('bonsai') !== 'classic';
    if (!this.wanted) return;
    this.cleanupFuncs.push(this.queries.bonsai.subscribe('qualify', (e) => this.build(e)));
    for (const e of this.queries.bonsai.entities) this.build(e);
  }

  update(delta: number): void {
    const e = this.entity;
    if (!e || !this.root || this.status !== 'blender') return;
    this.time += delta;
    const planted = e.getValue(Bonsai, 'planted') ?? false;
    const stage = planted ? (e.getValue(Bonsai, 'stage') ?? 0) : -1;
    if (this.glow) this.glow.visible = !planted;
    if (stage !== this.placedStage) {
      this.placedStage = stage;
      this.place(stage);
    }
    this.season ??= this.world.getSystem(SeasonSystem);
    const season = this.season?.season;
    this.wearShoots(stage, season ?? 'summer');
    const over = e.getValue(Bonsai, 'overwater') ?? 0;
    const k = Math.min(1, Math.max(0, (over - PUDDLE_FROM) / (PUDDLE_FULL - PUDDLE_FROM)));
    for (let i = 0; i < this.stageList.length; i++) {
      const { stage: s, parts } = this.stageList[i];
      const shown = s === stage;
      parts.ground.visible = shown;
      if (!shown) continue;
      if (parts.snow) parts.snow.visible = season === 'winter';
      if (parts.fallen) parts.fallen.visible = season === 'autumn';
      // Blossoms in spring and autumn; a green summer and a snowy winter tell the seasons apart.
      if (parts.flowers) parts.flowers.visible = season !== 'summer' && season !== 'winter';
      if (parts.puddle) {
        parts.puddle.visible = k > 0;
        // It spreads over the soil as the water pools (scaled flat: its height stays on the soil),
        // never to the pot's edge: a margin of soil keeps it a puddle, not a plate.
        const r = PUDDLE_MIN + (PUDDLE_MAX - PUDDLE_MIN) * k;
        parts.puddle.scale.set(r, 1, r);
      }
    }
  }

  /** Swaps the models in, once, before the other bonsai systems look for parts. */
  private build(e: Entity): void {
    const root = e.object3D;
    if (!root || this.root) return;
    const pot = root.getObjectByName('Pot');
    const potModel = AssetManager.getGLTF(POT_MODEL)?.scene;
    const models = new Map<number, Object3D>();
    for (const [stage, { asset }] of Object.entries(STAGE_MODELS)) {
      const scene = AssetManager.getGLTF(asset)?.scene;
      if (scene) models.set(Number(stage), scene);
    }
    if (!pot || !potModel || models.size < Object.keys(STAGE_MODELS).length) {
      this.status = 'failed';
      console.warn('[zen] bonsai: a Blender model is missing, keeping the procedural tree');
      return;
    }

    pot.clear();
    const take = (from: Object3D, name: string, as: string, to: Object3D) => {
      const m = from.getObjectByName(name);
      if (!m) return null;
      m.name = as;
      to.add(m);
      return m;
    };
    take(potModel, 'pot', 'PotShell', pot);
    take(potModel, 'soil', 'Soil', pot);
    take(potModel, 'moss', 'Moss', pot);
    // A warm glow in the empty pot says where the seed goes.
    this.glow = take(potModel, 'glow', 'PlantGlow', pot);

    let bark: Material | null = null;
    let leaf: Material | null = null;
    for (const [stage, scene] of models) {
      const name = STAGE_MODELS[stage].group;
      let group = root.getObjectByName(name);
      if (!group) {
        group = new Group();
        group.name = name;
        group.visible = false;
        root.add(group);
      }
      group.clear();
      const ground = new Group();
      ground.name = `Ground_${name}`;
      ground.visible = false;
      root.add(ground);
      const parts: StageParts = { cuts: new Map(), snow: null, ground, fallen: null, puddle: null, shoots: new Map(), flowers: null };
      for (const child of [...scene.children]) {
        if (/^cut_\d+$/.test(child.name)) {
          parts.cuts.set(child.name, child.position.clone());
          continue;
        }
        const mesh = child as Mesh;
        // Every model repeats the pot, soil and moss: the shared ones from the seed model are enough.
        if (!mesh.isMesh || SHARED_POT_PARTS.has(child.name)) continue;
        const shoot = SHOOT_MESH.exec(child.name);
        if (shoot) {
          // Worn by the glowing shoot groups below (moved there after this loop).
          const bySeason = parts.shoots.get(shoot[1]) ?? new Map<Season, Mesh>();
          bySeason.set(shoot[2] as Season, mesh);
          parts.shoots.set(shoot[1], bySeason);
          mesh.name = `${name}_${child.name}`;
          mesh.visible = false;
          continue;
        }
        const mat = mesh.material as Material;
        // Health and season tint materials by these names (a copy: the cached model stays as loaded).
        if (/^foliage/.test(mat.name)) mesh.material = Object.assign(mat.clone(), { name: 'Leaf' });
        else if (/^flower/.test(mat.name)) mesh.material = Object.assign(mat.clone(), { name: 'Flower' });
        if (stage === BonsaiStage.Mature && child.name === 'trunk') bark = mat;
        if (stage === BonsaiStage.Mature && child.name === 'foliage') leaf = mesh.material as Material;
        const kind = child.name;
        mesh.name = `${name}_${kind}`;
        if (kind === 'fallen' || kind === 'puddle') {
          mesh.visible = false;
          if (kind === 'fallen') {
            // Modelled 1-2 mm above the soil, they hid under it and the moss: lift and spread them.
            mesh.position.y += FALLEN_LIFT;
            const spread = Math.min(FALLEN_SPREAD, FALLEN_MAX_RADIUS / horizontalRadius(mesh));
            mesh.scale.set(spread, 1, spread);
          }
          ground.add(mesh);
          parts[kind] = mesh;
        } else {
          group.add(mesh);
          if (kind === 'flowers') parts.flowers = mesh;
          if (kind === 'snow') {
            mesh.visible = false;
            parts.snow = mesh;
          }
        }
      }
      this.stages.set(stage, parts);
      this.stageList.push({ stage, parts });
    }
    this.dressShoots(root);
    // The procedural blossoms belong to the procedural tree; the blooming model has its own.
    root.getObjectByName('Flowers')?.removeFromParent();
    // Healthy branches take the model's bark and foliage, so they read as part of the same tree.
    for (const name of ['Healthy_Young_0', 'Healthy_Young_1', 'Healthy_Mature_0', 'Healthy_Mature_1']) {
      root.getObjectByName(name)?.traverse((o) => {
        const m = o as Mesh;
        if (!m.isMesh) return;
        const isLeaf = (m.material as Material).name === 'Leaf';
        if (isLeaf && leaf) m.material = leaf;
        else if (!isLeaf && bark) m.material = bark;
      });
    }
    this.root = root;
    this.entity = e;
    this.status = 'blender';
    this.placedStage = -2;
  }

  /**
   * Hangs each model's shoots (shoot_NN_<season>) on the glowing shoot group
   * placed at the same cut point (cut_NN), so pruning, cut points and showing
   * or hiding stay the group's. The group's code-made shoot stays as the
   * fallback where a model has none.
   */
  private dressShoots(root: Object3D): void {
    for (const [stage, where] of Object.entries(PLACES)) {
      const parts = this.stages.get(Number(stage));
      if (!parts) continue;
      for (const [groupName, cutName] of where.shoots) {
        const group = root.getObjectByName(groupName);
        const looks = parts.shoots.get(cutName.slice(4));
        if (!group || !looks) continue;
        if (!this.codeShoots.has(group)) {
          this.codeShoots.set(group, group.children.filter((c) => (c as Mesh).isMesh));
        }
        for (const [season, mesh] of looks) {
          group.add(mesh);
          this.skins.push({ group, stage: Number(stage), season, mesh });
          const mat = mesh.material as MeshStandardMaterial;
          if (mat.emissive && mat.vertexColors) {
            glowInOwnColour(mat);
            this.shootMats.add(mat);
          }
        }
      }
    }
  }

  /** Shows the model's shoot for this stage and season (or the code-made one), and breathes their glow. */
  private wearShoots(stage: number, season: Season): void {
    const key = `${stage}:${season}`;
    if (key !== this.skinned) {
      this.skinned = key;
      const dressed = new Set<Object3D>();
      for (const s of this.skins) {
        s.mesh.visible = s.stage === stage && s.season === season;
        if (s.mesh.visible) dressed.add(s.group);
      }
      for (const [group, code] of this.codeShoots) for (const m of code) m.visible = !dressed.has(group);
    }
    const k = 0.5 - 0.5 * Math.cos(this.time * SHOOT_GLOW_RATE);
    for (const mat of this.shootMats) mat.emissiveIntensity = SHOOT_GLOW_MIN + (SHOOT_GLOW_MAX - SHOOT_GLOW_MIN) * k;
  }

  /** Moves the glowing shoots and healthy branches onto this stage's model. */
  private place(stage: number): void {
    const where = PLACES[stage];
    const parts = this.stages.get(stage);
    const root = this.root;
    if (!where || !parts || !root) return;
    for (const [name, cutName] of where.shoots) {
      const g = root.getObjectByName(name);
      const base = g?.userData.shootBase as V3 | undefined;
      const cut = parts.cuts.get(cutName);
      if (!g || !base || !cut) continue;
      g.position.set(cut.x - base[0], cut.y - base[1], cut.z - base[2]);
      // The model's shoots are modelled in the tree's space: undo the group's offset.
      for (const s of this.skins) if (s.group === g && s.stage === stage) s.mesh.position.set(-g.position.x, -g.position.y, -g.position.z);
    }
    for (const [name, from, to] of where.healthy) {
      const g = root.getObjectByName(name);
      const was = g?.userData.branchFrom as V3 | undefined;
      const dir = g?.userData.branchDir as V3 | undefined;
      if (!g || !was || !dir) continue;
      // Turn it to point the new way and shrink it, then put its base on the trunk.
      this.dirWas.set(dir[0], dir[1], dir[2]).normalize();
      this.dirNow.set(to[0] - from[0], to[1] - from[1], to[2] - from[2]).normalize();
      this.turn.setFromUnitVectors(this.dirWas, this.dirNow);
      g.quaternion.copy(this.turn);
      g.scale.setScalar(BRANCH_SCALE);
      this.tmp.set(was[0], was[1], was[2]).multiplyScalar(BRANCH_SCALE).applyQuaternion(this.turn);
      g.position.set(from[0] - this.tmp.x, from[1] - this.tmp.y, from[2] - this.tmp.z);
      // The leaf cloud stays level, like the crowns, whichever way the branch now points.
      g.getObjectByName('LeafCloud')?.quaternion.copy(this.turn).invert();
    }
  }
}
