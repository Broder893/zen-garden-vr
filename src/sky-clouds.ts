import { createSystem, Mesh, Object3D, ShaderMaterial } from '@iwsdk/core';

/** How often to look for the sky dome until it is there (and in case it is replaced). */
const SCAN_SECONDS = 2;

/** Shared with the dome's shader. */
const CLOUDS = {
  uCloudTime: { value: 0 },
};

/**
 * Soft clouds on the dome (IWSDK's DomeGradient shader): a flat cloud layer
 * seen from below (two octaves of value noise, a hash without sin: cheap
 * enough for a full-screen pass), drifting very slowly,
 * fading out toward the horizon. Their colour is made from the dome's own sky
 * and horizon colours, so they follow every time of day and its fades: near
 * white by day, rose at sunset, a faint blue at night.
 */
const CLOUD_GLSL = /* glsl */ `
float cloudHash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
float cloudNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(cloudHash(i), cloudHash(i + vec2(1.0, 0.0)), f.x),
             mix(cloudHash(i + vec2(0.0, 1.0)), cloudHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
vec3 withClouds(vec3 color, vec3 dir) {
  float up = dot(dir, gradientAxis);
  if (up <= 0.02) return color;
  vec2 uv = dir.xz / (up + 0.12) * 1.7 + vec2(uCloudTime * 0.02, uCloudTime * 0.007);
  float n = cloudNoise(uv) * 0.65 + cloudNoise(uv * 2.37 + 7.1) * 0.35;
  float cover = smoothstep(0.46, 0.7, n) * smoothstep(0.03, 0.3, up);
  vec3 cloud = min(vec3(1.0), (skyColor + equatorColor) * 0.62 + 0.04);
  cloud *= mix(0.86, 1.0, smoothstep(0.55, 0.85, n));
  return mix(color, cloud, cover * 0.75);
}
`;

/** Drifting clouds in the sky shader: no new objects or draw calls. */
export class SkyCloudsSystem extends createSystem({}) {
  private dome: ShaderMaterial | null = null;
  private sinceScan = SCAN_SECONDS;
  private find = (o: Object3D) => {
    const mesh = o as Mesh;
    const mat = mesh.isMesh ? (mesh.material as ShaderMaterial) : null;
    if (mat?.isShaderMaterial && mat.uniforms?.skyColor && mat.uniforms.equatorColor) this.dome = mat;
  };

  update(delta: number): void {
    // Wrapped so the float keeps its precision on long visits (a jump every 2 h, unseen).
    CLOUDS.uCloudTime.value = (CLOUDS.uCloudTime.value + delta) % 7200;
    this.sinceScan += delta;
    if (this.sinceScan < SCAN_SECONDS || this.dome?.userData.clouds) return;
    this.sinceScan = 0;
    this.dome = null;
    this.world.scene.traverse(this.find);
    const mat = this.dome as ShaderMaterial | null;
    if (!mat || !mat.fragmentShader.includes('gl_FragColor = vec4(color, 1.0);')) return;
    mat.userData.clouds = true;
    mat.uniforms.uCloudTime = CLOUDS.uCloudTime;
    mat.fragmentShader = mat.fragmentShader
      .replace('varying vec3 vWorldDirection;', `varying vec3 vWorldDirection;\nuniform float uCloudTime;\n${CLOUD_GLSL}`)
      .replace('gl_FragColor = vec4(color, 1.0);', 'color = withClouds(color, normalize(vWorldDirection));\n      gl_FragColor = vec4(color, 1.0);');
    mat.needsUpdate = true;
  }
}
