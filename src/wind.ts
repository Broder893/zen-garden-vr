import { BufferAttribute, createSystem, Material, Mesh, Object3D, Vector3 } from '@iwsdk/core';
import { ComfortSystem } from './comfort.js';
import { DayNightSystem } from './day-night.js';
import { WeatherSystem } from './weather.js';
import { isTrunk, SWAY_STRIDE, swayData, windStrength } from './wind-sway.js';

/** The forest's materials (public/models/forest.glb) and the bonsai's foliage. */
const FOREST_LEAF = 'foliage_forest';
const FOREST_FIXED = 'forest_fixed';
const BONSAI_LEAF = 'Leaf';
/** How often to look for new materials (the bonsai's foliage is cloned when health binds). */
const SCAN_SECONDS = 2;
/** The strength follows its target over about this long (time of day, breeze, comfort). */
const EASE_SECONDS = 4;

/** Shared by every swaying material: one write per frame moves them all. */
const WIND = {
  uWindTime: { value: 0 },
  uWindStrength: { value: 1 },
};

/**
 * Sway in the vertex shader. Forest: each tree (aSway: centre x, z, base y,
 * weight) bends from the ground, its top moving most; the phase comes from the
 * tree's place, and far trees sway a little wider. Bonsai: a few millimetres,
 * the phase from each pad's place. Slow (periods of 5-10 s), small, horizontal.
 */
const SWAY_GLSL = /* glsl */ `
#ifdef WIND_FOREST
  float wPh = fract(sin(dot(aSway.xy, vec2(12.9898, 78.233))) * 43758.5453) * 6.2832;
  float wY = max(transformed.y, 0.0);
  float wFar = clamp(length(aSway.xy) / 9.0, 0.5, 1.4);
  float wAmp = aSway.w * wFar * (0.004 * wY + 0.0018 * wY * wY + 0.02 * min(transformed.y - aSway.z, 0.5));
#else
  float wPh = dot(transformed.xz * uWindScale, vec2(25.0, 19.0));
  float wAmp = 0.008 * max(transformed.y * uWindScale, 0.0) / uWindScale;
#endif
  wAmp *= uWindStrength;
  transformed.x += wAmp * (sin(uWindTime * 0.8 + wPh) + 0.35 * sin(uWindTime * 1.9 + wPh * 1.7));
  transformed.z += wAmp * 0.6 * sin(uWindTime * 0.6 + wPh * 1.3);
`;

/**
 * Wind in the trees: the forest's canopies, pines and cypresses, the bushes
 * and the bonsai's crown sway gently, all in the vertex shader (no new objects
 * or draw calls). Trunks and the distant hills stay still. Calm by day,
 * softer at sunset, almost still at night, stronger in a breeze, and smaller
 * with Gentle transitions.
 */
export class WindSystem extends createSystem({}) {
  /** The strength now (eased toward the time of day, breeze and comfort). */
  strength = 1;
  private patched = new WeakSet<Material>();
  private sinceScan = SCAN_SECONDS;
  private dayNight?: DayNightSystem;
  private weather?: WeatherSystem;
  private comfort?: ComfortSystem;
  private scale = new Vector3();
  private visit = (o: Object3D) => this.patchMesh(o);

  update(delta: number): void {
    this.sinceScan += delta;
    if (this.sinceScan >= SCAN_SECONDS) {
      this.sinceScan = 0;
      this.world.scene.traverse(this.visit);
    }
    this.dayNight ??= this.world.getSystem(DayNightSystem);
    this.weather ??= this.world.getSystem(WeatherSystem);
    this.comfort ??= this.world.getSystem(ComfortSystem);
    const target = windStrength(
      this.dayNight?.time ?? 'day',
      this.weather?.windLevel ?? 0,
      this.comfort?.settings.softTransitions ?? false,
    );
    this.strength += (target - this.strength) * Math.min(1, delta / EASE_SECONDS);
    WIND.uWindStrength.value = this.strength;
    // Wrapped so the float keeps its precision on long visits.
    WIND.uWindTime.value = (WIND.uWindTime.value + delta) % 3600;
  }

  private patchMesh(o: Object3D): void {
    const mesh = o as Mesh;
    if (!mesh.isMesh || Array.isArray(mesh.material)) return;
    const mat = mesh.material;
    const forest = mat.name === FOREST_LEAF || mat.name === FOREST_FIXED;
    if (!forest && mat.name !== BONSAI_LEAF) return;
    if (forest && !mesh.geometry.getAttribute('aSway')) {
      const g = mesh.geometry;
      const color = g.getAttribute('color');
      const data = swayData(
        g.getAttribute('position').array,
        g.index?.array ?? null,
        color?.array ?? null,
        color?.itemSize ?? 3,
        mat.name === FOREST_FIXED ? isTrunk : undefined,
      );
      g.setAttribute('aSway', new BufferAttribute(data, SWAY_STRIDE));
    }
    if (this.patched.has(mat)) return;
    this.patched.add(mat);
    mesh.getWorldScale(this.scale);
    const scale = { value: forest ? 1 : this.scale.y || 1 };
    const before = mat.onBeforeCompile;
    mat.onBeforeCompile = (shader, renderer) => {
      before.call(mat, shader, renderer);
      shader.uniforms.uWindTime = WIND.uWindTime;
      shader.uniforms.uWindStrength = WIND.uWindStrength;
      shader.uniforms.uWindScale = scale;
      shader.vertexShader = shader.vertexShader
        .replace(
          'void main() {',
          `${forest ? '#define WIND_FOREST\nattribute vec4 aSway;\n' : ''}uniform float uWindTime;\nuniform float uWindStrength;\nuniform float uWindScale;\nvoid main() {`,
        )
        .replace('#include <begin_vertex>', `#include <begin_vertex>\n${SWAY_GLSL}`);
    };
    const key = mat.customProgramCacheKey.bind(mat);
    mat.customProgramCacheKey = () => `${key()}|wind-${forest ? 'forest' : 'leaf'}`;
    mat.needsUpdate = true;
  }
}
