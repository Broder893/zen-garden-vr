import {
  CylinderGeometry,
  DodecahedronGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
} from '@iwsdk/core';

/**
 * Meditation stone: a smooth river stone on a low moss cushion, with a glowing
 * ring inlaid on top that the MeditationSystem pulses. Origin at the table
 * contact (y = 0). Envelope ~0.13 x 0.06 x 0.11 m. Generous grab volume.
 */
export function createMeditationStone(): Group {
  const root = new Group();
  root.name = 'MeditationStone';

  const cushion = new Mesh(
    new CylinderGeometry(0.068, 0.072, 0.014, 24),
    new MeshStandardMaterial({ color: '#4d6b45', roughness: 0.95 }),
  );
  cushion.name = 'Cushion';
  cushion.position.y = 0.007;
  root.add(cushion);

  const stone = new Mesh(
    new DodecahedronGeometry(1, 2),
    new MeshStandardMaterial({ color: '#7d7f86', roughness: 0.6, metalness: 0.05 }),
  );
  stone.name = 'Stone';
  stone.scale.set(0.05, 0.022, 0.042);
  stone.position.y = 0.014 + 0.017;
  root.add(stone);

  const ring = new Mesh(
    new TorusGeometry(0.022, 0.0028, 8, 40),
    new MeshStandardMaterial({
      color: '#d8e8ff',
      emissive: '#9fc6ff',
      emissiveIntensity: 0.8,
      roughness: 0.4,
    }),
  );
  ring.name = 'GlowRing';
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.014 + 0.034;
  root.add(ring);

  const volume = new Mesh(
    new SphereGeometry(0.08, 12, 8),
    new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
  );
  volume.name = 'GrabVolume';
  volume.position.y = 0.03;
  volume.userData.iwsdkPreviewBounds = 'exclude';
  root.add(volume);
  return root;
}

/**
 * Breathing orb: a soft core with two halos. The MeditationSystem scales the
 * whole group (inhale grows, exhale shrinks) and fades it in and out.
 * Origin at the centre. Rest radius ~0.05 m.
 */
export function createBreathOrb(): Group {
  const root = new Group();
  root.name = 'BreathOrb';
  const geo = new SphereGeometry(1, 24, 16);
  for (const [name, r, opacity] of [
    ['OrbCore', 0.03, 0.85],
    ['OrbHaloInner', 0.042, 0.3],
    ['OrbHaloOuter', 0.06, 0.12],
  ] as const) {
    const mesh = new Mesh(
      geo,
      new MeshBasicMaterial({
        color: name === 'OrbCore' ? '#e6f1ff' : '#9fc6ff',
        transparent: true,
        opacity,
        depthWrite: false,
      }),
    );
    mesh.name = name;
    mesh.scale.setScalar(r);
    if (name !== 'OrbCore') mesh.userData.iwsdkPreviewBounds = 'exclude';
    root.add(mesh);
  }
  return root;
}
