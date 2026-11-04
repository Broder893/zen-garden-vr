import {
  createSystem,
  Entity,
  GrabSystem,
  Grabbed,
  MeshBasicMaterial,
  MeshStandardMaterial,
  VisibilityState,
} from '@iwsdk/core';
import { trackFirst, FirstEntity } from './ecs-utils.js';
import { BreathOrb, MeditationStone } from './garden-components.js';

/** Where a session is. `idle` = no session. Pausing is a separate flag that keeps the phase. */
export type MeditationPhase = 'idle' | 'intro' | 'in' | 'hold' | 'out' | 'outro';

/** What the guide should say right now about meditation (null = nothing). */
export type MeditationCue =
  | 'intro'
  | 'in'
  | 'hold'
  | 'out'
  | 'soften'
  | 'notice'
  | 'paused'
  | 'done'
  | null;

const INTRO_SECONDS = 5;
/** A session left paused this long ends quietly so the garden guide comes back. */
const PAUSE_TIMEOUT = 60;
const OUTRO_SECONDS = 5;
/** Ignore a second pinch this soon after the last one (a held pinch can re-grab). */
const PINCH_COOLDOWN = 0.8;
/** Breaths (0-based) that get a gentler variant line instead of the plain cue. */
const SOFTEN_BREATH = 1;
const NOTICE_BREATH = 3;
const ORB_SMALL = 0.6;
const ORB_LARGE = 1.45;

const smooth = (x: number) => x * x * (3 - 2 * x);

/**
 * Guided breathing. Pinching the stone starts a session, pinches again pause
 * and resume it. Each breath is inhale / hold / exhale; the orb grows and
 * shrinks with it and the stone ring glows along. Leaving the headset or
 * opening the system menu pauses the session.
 */
export class MeditationSystem extends createSystem({
  stones: { required: [MeditationStone] },
  stonePinched: { required: [MeditationStone, Grabbed] },
  orbs: { required: [BreathOrb] },
}) {
  phase: MeditationPhase = 'idle';
  paused = false;
  /** 0-based index of the current breath. */
  breath = 0;
  /** Sessions finished since load (PersistenceSystem adds earlier visits). */
  completed = 0;
  /** Current breath size, 0 (empty) .. 1 (full); drives orb and ring. */
  fullness = 0;
  private phaseTime = 0;
  private pausedTime = 0;
  private cooldown = 0;
  private time = 0;
  private orbFade = 0;
  private ringMats: MeshStandardMaterial[] = [];
  private orbMats: MeshBasicMaterial[] = [];
  private orbBaseOpacity: number[] = [];
  private grab?: GrabSystem;
  private stone!: FirstEntity;
  private orb!: FirstEntity;

  get active(): boolean {
    return this.phase !== 'idle';
  }

  /** The line the guide should show, or null when meditation has nothing to say. */
  get cue(): MeditationCue {
    if (this.paused) return 'paused';
    switch (this.phase) {
      case 'idle':
        return null;
      case 'intro':
        return 'intro';
      case 'outro':
        return 'done';
      case 'in':
        return this.breath === NOTICE_BREATH ? 'notice' : 'in';
      case 'out':
        return this.breath === SOFTEN_BREATH ? 'soften' : 'out';
      default:
        return this.phase;
    }
  }

  init(): void {
    this.grab = this.world.getSystem(GrabSystem);
    this.stone = trackFirst(this.queries.stones, this.cleanupFuncs);
    this.orb = trackFirst(this.queries.orbs, this.cleanupFuncs);
    // Subscribe and the initial loop can both see an entity: bind each once.
    const bound = new WeakSet<Entity>();
    const bindStone = (e: Entity) => {
      if (bound.has(e)) return;
      bound.add(e);
      const ring = e.object3D?.getObjectByName('GlowRing') as
        | { material: MeshStandardMaterial }
        | undefined;
      if (!ring) return;
      ring.material = ring.material.clone();
      this.ringMats.push(ring.material);
    };
    const bindOrb = (e: Entity) => {
      if (bound.has(e)) return;
      bound.add(e);
      e.object3D?.traverse((o) => {
        const mesh = o as unknown as { isMesh?: boolean; material: MeshBasicMaterial };
        if (!mesh.isMesh) return;
        mesh.material = mesh.material.clone();
        this.orbMats.push(mesh.material);
        this.orbBaseOpacity.push(mesh.material.opacity);
      });
      if (e.object3D) e.object3D.visible = false;
    };
    this.cleanupFuncs.push(
      this.queries.stones.subscribe('qualify', bindStone),
      this.queries.orbs.subscribe('qualify', bindOrb),
      this.queries.stonePinched.subscribe('qualify', (e) => this.onPinch(e)),
      this.world.visibilityState.subscribe((state) => {
        const away = state === VisibilityState.Hidden || state === VisibilityState.VisibleBlurred;
        if (away && this.active) this.paused = true;
      }),
    );
    for (const e of this.queries.stones.entities) bindStone(e);
    for (const e of this.queries.orbs.entities) bindOrb(e);
  }

  private onPinch(stone: Entity): void {
    this.grab?.forceRelease(stone);
    if (this.cooldown > 0) return;
    this.cooldown = PINCH_COOLDOWN;
    if (this.phase === 'idle' || this.phase === 'outro') this.start();
    else this.paused = !this.paused;
  }

  private start(): void {
    this.phase = 'intro';
    this.phaseTime = 0;
    this.breath = 0;
    this.paused = false;
  }

  update(delta: number): void {
    this.time += delta;
    this.cooldown = Math.max(0, this.cooldown - delta);
    if (this.active && !this.paused) this.advance(delta);
    if (this.paused) {
      this.pausedTime += delta;
      if (this.pausedTime >= PAUSE_TIMEOUT) {
        this.paused = false;
        this.next('idle');
      }
    } else this.pausedTime = 0;
    this.render(delta);
  }

  private advance(delta: number): void {
    const stone = this.stone.entity;
    if (!stone) return;
    this.phaseTime += delta;
    const inhale = stone.getValue(MeditationStone, 'inhaleSeconds') ?? 4;
    const hold = stone.getValue(MeditationStone, 'holdSeconds') ?? 2;
    const exhale = stone.getValue(MeditationStone, 'exhaleSeconds') ?? 6;
    const breaths = stone.getValue(MeditationStone, 'breaths') ?? 6;

    switch (this.phase) {
      case 'intro':
        this.fullness = 0;
        if (this.phaseTime >= INTRO_SECONDS) this.next('in');
        break;
      case 'in':
        this.fullness = smooth(Math.min(1, this.phaseTime / inhale));
        if (this.phaseTime >= inhale) this.next(hold > 0 ? 'hold' : 'out');
        break;
      case 'hold':
        this.fullness = 1;
        if (this.phaseTime >= hold) this.next('out');
        break;
      case 'out':
        this.fullness = 1 - smooth(Math.min(1, this.phaseTime / exhale));
        if (this.phaseTime >= exhale) {
          this.breath++;
          if (this.breath >= breaths) {
            this.completed++;
            this.next('outro');
          } else this.next('in');
        }
        break;
      case 'outro':
        this.fullness = 0;
        if (this.phaseTime >= OUTRO_SECONDS) this.next('idle');
        break;
    }
  }

  private next(phase: MeditationPhase): void {
    this.phase = phase;
    this.phaseTime = 0;
  }

  private render(delta: number): void {
    // Orb: fades in for a session, out when idle or finishing.
    const showOrb = this.phase !== 'idle' && this.phase !== 'outro';
    this.orbFade += ((showOrb ? 1 : 0) - this.orbFade) * (1 - Math.exp(-2.5 * delta));
    const orb = this.orb.entity?.object3D;
    if (orb) {
      orb.visible = this.orbFade > 0.01;
      const pausedDim = this.paused ? 0.5 : 1;
      orb.scale.setScalar(ORB_SMALL + (ORB_LARGE - ORB_SMALL) * this.fullness);
      for (let i = 0; i < this.orbMats.length; i++) {
        this.orbMats[i].opacity = this.orbBaseOpacity[i] * this.orbFade * pausedDim;
      }
    }
    // Ring: a slow inviting pulse when idle, follows the breath in a session.
    const glow = this.active
      ? 0.4 + 1.6 * this.fullness
      : 0.5 + 0.4 * Math.sin(this.time * 1.6);
    for (const m of this.ringMats) m.emissiveIntensity = glow;
  }
}
