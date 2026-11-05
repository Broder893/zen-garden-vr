import {
  Color,
  createSystem,
  Entity,
  MeshStandardMaterial,
  Object3D,
  UIKit,
  UIKitMLAsset,
  Vector3,
} from '@iwsdk/core';
import {
  MeditationStone,
  PruningShears,
  ReturnHome,
  Seed,
  WateringCan,
} from './garden-components.js';
import { MeditationSystem } from './meditation.js';
import {
  BREATH_PACES,
  BreathPace,
  ComfortSettings,
  Hands,
  loadSettings,
  storeSettings,
} from './save/comfort-settings.js';

type Choice = { id: string; key: keyof ComfortSettings; value: ComfortSettings[keyof ComfortSettings] };

/** Every option button in public/ui/comfort.uikitml and the setting it picks. */
const CHOICES: Choice[] = [
  ...(['slow', 'medium', 'fast'] as BreathPace[]).map((v) => ({ id: `pace-${v}`, key: 'breathPace' as const, value: v })),
  { id: 'contrast-off', key: 'highContrast', value: false },
  { id: 'contrast-on', key: 'highContrast', value: true },
  { id: 'text-normal', key: 'largeText', value: false },
  { id: 'text-large', key: 'largeText', value: true },
  ...(['both', 'left', 'right'] as Hands[]).map((v) => ({ id: `hands-${v}`, key: 'hands' as const, value: v })),
  { id: 'dwell-off', key: 'dwell', value: false },
  { id: 'dwell-on', key: 'dwell', value: true },
];

/** Panel and subtitle palettes: normal (soft, warm) and high contrast (black, white, yellow). */
const THEME = {
  normal: {
    surface: 'rgba(20, 17, 31, 0.92)', border: '#ffd76a', text: '#fff6dc',
    btn: '#3a3350', btnBorder: '#6d6390', on: '#ffd76a', onText: '#1a1424',
    subtitleBg: 'rgba(20, 17, 31, 0.8)',
  },
  high: {
    surface: '#000000', border: '#ffe600', text: '#ffffff',
    btn: '#000000', btnBorder: '#ffffff', on: '#ffe600', onText: '#000000',
    subtitleBg: '#000000',
  },
} as const;

/** Glow added to the things you can pick up, in high contrast mode. */
const HIGHLIGHT = new Color('#ffd23f');
const HIGHLIGHT_INTENSITY = 0.4;
const SUBTITLE_SCALE = { normal: 0.8, large: 1.2 };
const PANEL_SCALE = { normal: 0.6, large: 0.75 };
/** Where the tools rest for each hands setting: [x, z, yaw degrees] on the table top. */
const TOOL_LAYOUT: Record<Hands, { can: [number, number, number]; shears: [number, number, number] }> = {
  // Matches the authored scene: can on the right, shears on the left.
  both: { can: [0.27, -0.45, 180], shears: [-0.26, -0.42, 25] },
  // One hand: both tools on that hand's side, the shears nearer the player.
  right: { can: [0.27, -0.47, 180], shears: [0.3, -0.27, 155] },
  left: { can: [-0.27, -0.47, 0], shears: [-0.3, -0.29, 25] },
};
const TABLE_TOP_Y = 0.77;

/** A second touch on the same button this soon is the same poke, not a new one. */
const CLICK_GUARD_MS = 450;

interface Highlighted {
  mat: MeshStandardMaterial;
  emissive: Color;
  intensity: number;
}

/**
 * The Comfort panel: accessibility settings a player can change at any time
 * with a poke, a ray or a mouse click. It stores them, shows the active
 * choices, and applies the ones that are pure presentation (breathing pace,
 * high contrast, text size). Other systems read `settings` for the rest.
 */
export class ComfortSystem extends createSystem({
  stones: { required: [MeditationStone] },
  pickables: { required: [Seed] },
  cans: { required: [WateringCan] },
  shears: { required: [PruningShears] },
}) {
  settings: ComfortSettings = loadSettings();
  /** Increments whenever a setting changes, so readers can react cheaply. */
  version = 0;
  open = false;
  private panel: Object3D | null = null;
  private subtitlePanel: Object3D | null = null;
  private elements = new Map<string, UIKit.Text>();
  private subtitlePill: UIKit.Text | null = null;
  private subtitleText: UIKit.Text | null = null;
  private highlighted: Highlighted[] = [];
  private bound = new WeakSet<Entity>();
  private head = new Vector3();
  private meditation?: MeditationSystem;
  private paceApplied: BreathPace | null = null;

  init(): void {
    this.meditation = this.world.getSystem(MeditationSystem);
    const panel = this.world.getSceneObject<UIKitMLAsset>('comfort-panel');
    this.panel = panel ?? null;
    if (panel) {
      const ids = ['comfort-body', 'comfort-open', 'comfort-open-text', ...CHOICES.flatMap((c) => [c.id, `${c.id}-t`])];
      for (const id of ids) {
        const el = panel.getElementById<UIKit.Text>(id);
        if (!el) continue;
        el.name = id;
        this.elements.set(id, el);
      }
      this.listen('comfort-open', () => this.setOpen(!this.open));
      for (const c of CHOICES) this.listen(c.id, () => this.choose(c));
    }
    const sub = this.world.getSceneObject<UIKitMLAsset>('subtitle-panel');
    this.subtitlePanel = sub ?? null;
    this.subtitlePill = sub?.getElementById<UIKit.Text>('subtitle-pill') ?? null;
    this.subtitleText = sub?.getElementById<UIKit.Text>('subtitle') ?? null;

    const bind = (e: Entity) => this.bindHighlight(e);
    for (const q of [this.queries.pickables, this.queries.cans, this.queries.shears, this.queries.stones]) {
      this.cleanupFuncs.push(q.subscribe('qualify', bind));
      for (const e of q.entities) bind(e);
    }
    this.cleanupFuncs.push(
      this.queries.stones.subscribe('qualify', () => (this.paceApplied = null)),
      this.queries.cans.subscribe('qualify', () => this.applyLayout()),
      this.queries.shears.subscribe('qualify', () => this.applyLayout()),
    );
    this.applyAll();
  }

  update(): void {
    // A new breathing pace waits for the current session to end.
    if (this.paceApplied !== this.settings.breathPace && !this.meditation?.active) this.applyPace();
    const p = this.panel;
    if (!p) return;
    this.player.head.getWorldPosition(this.head);
    p.lookAt(this.head);
  }

  /** Opens or closes the settings list. */
  setOpen(open: boolean): void {
    this.open = open;
    this.elements.get('comfort-body')?.setProperties({ display: open ? 'flex' : 'none' });
    this.elements.get('comfort-open-text')?.setProperties({ text: open ? 'Done' : 'Comfort' });
  }

  /** Changes one setting, saves it and applies it. */
  set<K extends keyof ComfortSettings>(key: K, value: ComfortSettings[K]): void {
    if (this.settings[key] === value) return;
    this.settings[key] = value;
    this.version++;
    storeSettings(this.settings);
    this.applyAll();
  }

  private choose(c: Choice): void {
    this.set(c.key, c.value as never);
  }

  private listen(id: string, fn: () => void): void {
    const el = this.elements.get(id);
    if (!el) return;
    let last = -Infinity;
    const guarded = () => {
      const now = performance.now();
      if (now - last < CLICK_GUARD_MS) return;
      last = now;
      fn();
    };
    // Act on press, not click: a poke drifts between child elements while
    // pressed, which cancels the click; pointerdown works for poke, ray and mouse.
    el.addEventListener('pointerdown', guarded);
    this.cleanupFuncs.push(() => el.removeEventListener('pointerdown', guarded));
  }

  private applyAll(): void {
    const s = this.settings;
    const t = s.highContrast ? THEME.high : THEME.normal;
    // Panel: theme, and the chosen option of each row filled in.
    for (const id of ['comfort-body', 'comfort-open']) {
      this.elements.get(id)?.setProperties({ backgroundColor: t.surface, borderColor: t.border });
    }
    this.elements.get('comfort-open-text')?.setProperties({ color: t.text });
    for (const c of CHOICES) {
      const on = s[c.key] === c.value;
      this.elements.get(c.id)?.setProperties({
        backgroundColor: on ? t.on : t.btn,
        borderColor: on ? t.on : t.btnBorder,
      });
      this.elements.get(`${c.id}-t`)?.setProperties({ color: on ? t.onText : t.text });
    }
    this.panel?.scale.setScalar(s.largeText ? PANEL_SCALE.large : PANEL_SCALE.normal);
    // Subtitles: solid black with white text in high contrast; bigger when asked.
    this.subtitlePill?.setProperties({ backgroundColor: t.subtitleBg, borderColor: t.border, borderWidth: s.highContrast ? 0.35 : 0.15 });
    this.subtitleText?.setProperties({ color: s.highContrast ? '#ffffff' : '#fff6dc' });
    this.subtitlePanel?.scale.setScalar(s.largeText ? SUBTITLE_SCALE.large : SUBTITLE_SCALE.normal);
    this.applyLayout();
    for (const h of this.highlighted) {
      if (s.highContrast) {
        h.mat.emissive.copy(HIGHLIGHT);
        h.mat.emissiveIntensity = HIGHLIGHT_INTENSITY;
      } else {
        h.mat.emissive.copy(h.emissive);
        h.mat.emissiveIntensity = h.intensity;
      }
    }
  }

  /** Moves the tools' resting places for the hands setting; ReturnHome glides them there. */
  private applyLayout(): void {
    const layout = TOOL_LAYOUT[this.settings.hands];
    for (const e of this.queries.cans.entities) this.setHome(e, layout.can);
    for (const e of this.queries.shears.entities) this.setHome(e, layout.shears);
  }

  private setHome(e: Entity, [x, z, yawDeg]: [number, number, number]): void {
    if (!e.hasComponent(ReturnHome)) return;
    const pos = e.getVectorView(ReturnHome, 'homePosition');
    pos[0] = x;
    pos[1] = TABLE_TOP_Y;
    pos[2] = z;
    const half = (yawDeg * Math.PI) / 360;
    const q = e.getVectorView(ReturnHome, 'homeQuaternion');
    q[0] = 0;
    q[1] = Math.sin(half);
    q[2] = 0;
    q[3] = Math.cos(half);
    // Already captured: ReturnHome must not overwrite this with the authored pose.
    e.setValue(ReturnHome, 'captured', true);
  }

  /** True when this hand may be used (both, or the one chosen in one-hand mode). */
  usesHand(side: 'left' | 'right'): boolean {
    return this.settings.hands === 'both' || this.settings.hands === side;
  }

  private applyPace(): void {
    const pace = BREATH_PACES[this.settings.breathPace];
    for (const stone of this.queries.stones.entities) {
      stone.setValue(MeditationStone, 'inhaleSeconds', pace.inhale);
      stone.setValue(MeditationStone, 'holdSeconds', pace.hold);
      stone.setValue(MeditationStone, 'exhaleSeconds', pace.exhale);
      stone.setValue(MeditationStone, 'breaths', pace.breaths);
    }
    this.paceApplied = this.settings.breathPace;
  }

  /** Owns the materials of an object the player can pick up, so it can glow in high contrast. */
  private bindHighlight(e: Entity): void {
    if (this.bound.has(e)) return;
    this.bound.add(e);
    e.object3D?.traverse((o) => {
      // The stone's ring is animated by MeditationSystem: leave it alone.
      if (o.name === 'GlowRing') return;
      const mesh = o as unknown as { isMesh?: boolean; material: MeshStandardMaterial | MeshStandardMaterial[] };
      if (!mesh.isMesh || Array.isArray(mesh.material) || !mesh.material.emissive) return;
      const mat = mesh.material.clone();
      mesh.material = mat;
      this.highlighted.push({ mat, emissive: mat.emissive.clone(), intensity: mat.emissiveIntensity });
    });
    if (this.settings.highContrast) this.applyAll();
  }
}
