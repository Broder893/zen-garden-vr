import { DoubleSide, ShaderMaterial, Vector4 } from '@iwsdk/core';

/**
 * The eyelids' look, drawn on one head-locked quad (src/eyelids.ts).
 * Coordinates are view tangents (x right, y up from the line of sight), so
 * the lids' shape does not depend on the quad's size or distance.
 *
 * uAmount 0 open .. 1 closed. uMode 0: two lids (upper and lower) whose
 * almond-shaped edges meet a little below the centre, the sides first; 1: a
 * plain slow fade (Comfort "Gentle transitions"). uRing: a world point the
 * player can look at to open the eyes (x, y in view tangents, alpha, dwell
 * progress 0..1), drawn as a small ring of warm light over the closed lids.
 */
export function createEyelidMaterial(extent: number): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uAmount: { value: 0 },
      uMode: { value: 0 },
      uExtent: { value: extent },
      uRing: { value: new Vector4() },
    },
    vertexShader: /* glsl */ `
      varying vec2 vQ;
      uniform float uExtent;
      void main() {
        vQ = (uv * 2.0 - 1.0) * uExtent;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vQ;
      uniform float uAmount;
      uniform float uMode;
      uniform vec4 uRing;
      const vec3 SKIN = vec3(0.045, 0.03, 0.035);
      const vec3 WARM = vec3(0.07, 0.022, 0.016);
      const vec3 GLOW = vec3(1.0, 0.84, 0.42);
      void main() {
        float c = clamp(uAmount, 0.0, 1.0);
        float x2 = vQ.x * vQ.x;
        float cover;
        float lash = 1.0;
        if (uMode < 0.5) {
          // Edges in view tangents: open they sit beyond the field of view,
          // closed they overlap so no slit is left between them.
          float k = c * c * (3.0 - 2.0 * c);
          // Straight just outside the view when open, curving as they close.
          float upper = mix(1.22, -0.3, k) - 0.25 * k * x2;
          float lower = mix(-1.22, 0.15, k) + 0.22 * k * x2;
          float soft = 0.05 + 0.12 * k;
          float top = smoothstep(upper - soft, upper + soft, vQ.y);
          float bottom = 1.0 - smoothstep(lower - soft, lower + soft, vQ.y);
          cover = max(top, bottom);
          // A darker line along each lid's edge, like lashes, fading as they
          // overlap; closed, one thin seam where they meet.
          float edge = min(abs(vQ.y - upper), abs(vQ.y - lower));
          lash = 1.0 - 0.45 * (1.0 - smoothstep(0.0, 0.18, edge)) * (1.0 - k * k);
          float seam = 1.0 - smoothstep(0.0, 0.04, abs(vQ.y + 0.08 + 0.03 * x2));
          lash *= 1.0 - 0.35 * seam * k * k * k;
        } else {
          cover = c;
        }
        // Light through closed eyelids: a faint warm glow in the middle.
        vec3 col = (SKIN + WARM * c * (1.0 - smoothstep(0.0, 1.6, length(vQ)))) * lash;
        float a = cover;
        if (uRing.z > 0.0) {
          vec2 d = vQ - uRing.xy;
          float r = length(d);
          float ring = 1.0 - smoothstep(0.006, 0.016, abs(r - 0.075));
          float dot = 1.0 - smoothstep(0.012, 0.024, r);
          float ang = fract(atan(d.x, d.y) / 6.2831853 + 1.0);
          float filled = step(ang, uRing.w);
          float glow = (ring * (0.35 + 0.65 * filled) + dot * 0.6) * uRing.z * cover;
          col = mix(col, GLOW, glow);
          a = max(a, glow);
        }
        gl_FragColor = vec4(col, a);
      }
    `,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: DoubleSide,
  });
}
