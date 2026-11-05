import {
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
} from '@iwsdk/core';

/**
 * Firefly guide: a bright core inside two soft tinted halos.
 * Origin at the core centre. Envelope ~0.08 m. The GuideSystem recolours the
 * "Core" and "Halo*" materials per phase, so each placement owns clones.
 */
export function createFirefly(): Group {
  const root = new Group();
  root.name = 'Firefly';
  const core = new Mesh(
    new SphereGeometry(0.009, 12, 8),
    new MeshBasicMaterial({ color: '#fff3b0' }),
  );
  core.name = 'Core';
  root.add(core);
  const haloGeo = new SphereGeometry(1, 16, 10);
  for (const [name, r, opacity] of [
    ['HaloInner', 0.017, 0.55],
    ['HaloOuter', 0.032, 0.2],
  ] as const) {
    const halo = new Mesh(
      haloGeo,
      new MeshBasicMaterial({
        color: '#ffd76a',
        transparent: true,
        opacity,
        depthWrite: false,
      }),
    );
    halo.name = name;
    halo.scale.setScalar(r);
    halo.userData.iwsdkPreviewBounds = 'exclude';
    root.add(halo);
  }
  return root;
}

/**
 * Glowing seed resting on the soil, with a generous invisible grab volume so
 * a loose pinch anywhere near it counts. Origin at soil contact (y = 0).
 */
export function createSeed(): Group {
  const root = new Group();
  root.name = 'Seed';
  const seed = new Mesh(
    new IcosahedronGeometry(1, 1),
    new MeshStandardMaterial({
      color: '#c58a3e',
      emissive: '#ffb347',
      emissiveIntensity: 0.6,
      roughness: 0.5,
      flatShading: true,
    }),
  );
  seed.name = 'SeedBody';
  seed.scale.set(0.011, 0.008, 0.016);
  seed.position.y = 0.007;
  root.add(seed);
  const volume = new Mesh(
    new SphereGeometry(0.06, 12, 8),
    new MeshBasicMaterial({ visible: false }),
  );
  volume.name = 'GrabVolume';
  volume.position.y = 0.02;
  volume.userData.iwsdkPreviewBounds = 'exclude';
  root.add(volume);
  return root;
}
