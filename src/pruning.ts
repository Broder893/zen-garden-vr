import { createSystem, Entity, Grabbed, Object3D, Vector3 } from '@iwsdk/core';
import { HEALTHY_BY_STAGE, SHOOTS_BY_STAGE } from './bonsai-growth.js';
import { HealthSystem } from './health.js';
import { WRONG_CUT_STRESS } from './save/plant-health.js';
import { AssistHeld, Bonsai, PruningShears } from './garden-components.js';

const SNIP_SECONDS = 0.25;
const OPEN_YAW = 0.12;
/**
 * A healthy branch is cut only when the blade tip comes this close (tighter
 * than for glowing shoots), never while a glowing shoot is within reach, and
 * only after the blades have been away from it (the same "armed" rule).
 */
const HEALTHY_RADIUS = 0.035;
const NO_HEALTHY: string[] = [];
/** New shoots can't be cut until they have grown in (avoids instant cuts next to held shears). */
const GRACE_SECONDS = 1.5;

interface ShearsParts {
  tip: Object3D;
  upper: Object3D | undefined;
  lower: Object3D | undefined;
  snip: number;
}

/**
 * Bring held shears to a glowing shoot and it is cut: the blades snap shut and
 * the shoot disappears. Tolerant radius, no precise pinch needed.
 */
export class PruningSystem extends createSystem({
  shears: { required: [PruningShears] },
  held: { required: [PruningShears, Grabbed] },
  assisted: { required: [PruningShears, AssistHeld] },
  bonsai: { required: [Bonsai] },
}) {
  private parts = new Map<number, ShearsParts>();
  private cutPoints = new Map<string, Object3D>();
  private tipPos = new Vector3();
  private cutPos = new Vector3();
  private lastStage = -1;
  private stageAge = 0;
  /** Bit i set once the blades have been away from shoot i; a cut needs the blades to arrive. */
  private armed = 0;
  /** Increments on every cut (read by audio/guide later). */
  cuts = 0;
  /** Increments on every healthy branch cut by mistake (read by guide and audio). */
  wrongCuts = 0;
  /** Bit i set once the blades have been away from healthy branch i. */
  private armedHealthy = 0;
  private health?: HealthSystem;

  init(): void {
    const bindShears = (e: Entity) => {
      const root = e.object3D;
      const tip = root?.getObjectByName('BladeTip');
      if (!root || !tip) return;
      this.parts.set(e.index, {
        tip,
        upper: root.getObjectByName('BladeUpperArm'),
        lower: root.getObjectByName('BladeLowerArm'),
        snip: SNIP_SECONDS,
      });
    };
    const bindBonsai = (e: Entity) => {
      for (const names of [...Object.values(SHOOTS_BY_STAGE), ...Object.values(HEALTHY_BY_STAGE)]) {
        for (const n of names) {
          const cp = e.object3D?.getObjectByName(n)?.getObjectByName('CutPoint');
          if (cp) this.cutPoints.set(n, cp);
        }
      }
    };
    this.cleanupFuncs.push(
      this.queries.shears.subscribe('qualify', bindShears),
      this.queries.bonsai.subscribe('qualify', bindBonsai),
    );
    for (const e of this.queries.shears.entities) bindShears(e);
    for (const e of this.queries.bonsai.entities) bindBonsai(e);
  }

  update(delta: number): void {
    for (const p of this.parts.values()) this.animate(p, delta);

    for (const bonsai of this.queries.bonsai.entities) {
      const stage = bonsai.getValue(Bonsai, 'stage') ?? 0;
      if (stage !== this.lastStage) {
        this.lastStage = stage;
        this.stageAge = 0;
        this.armed = 0;
        this.armedHealthy = 0;
      }
      this.stageAge += delta;
      if (this.stageAge < GRACE_SECONDS) continue;
      const shoots = SHOOTS_BY_STAGE[stage];
      if (!shoots) continue;
      let mask = bonsai.getValue(Bonsai, 'prunedMask') ?? 0;
      // Pinch-held and hands-free ("hold to select") shears cut the same way.
      for (const shears of this.queries.held.entities) mask = this.cutWith(shears, shoots, mask);
      for (const shears of this.queries.assisted.entities) mask = this.cutWith(shears, shoots, mask);
      bonsai.setValue(Bonsai, 'prunedMask', mask);
      const healthy = HEALTHY_BY_STAGE[stage] ?? NO_HEALTHY;
      if (healthy.length > 0) {
        let stumps = bonsai.getValue(Bonsai, 'stumpMask') ?? 0;
        const before = stumps;
        for (const shears of this.queries.held.entities) stumps = this.wrongCut(shears, healthy, stumps, shoots, mask);
        for (const shears of this.queries.assisted.entities) stumps = this.wrongCut(shears, healthy, stumps, shoots, mask);
        if (stumps !== before) {
          bonsai.setValue(Bonsai, 'stumpMask', stumps);
          // Never a game over: some stress, which time or a breath takes away.
          this.health ??= this.world.getSystem(HealthSystem);
          if (this.health?.mistakesShow ?? true) {
            const stress = bonsai.getValue(Bonsai, 'stress') ?? 0;
            bonsai.setValue(Bonsai, 'stress', Math.min(1, stress + WRONG_CUT_STRESS * this.bitsAdded(before, stumps)));
          }
        }
      }
    }
  }

  /** Cuts every armed shoot within reach of these shears' blade tip; returns the new mask. */
  private cutWith(shears: Entity, shoots: string[], mask: number): number {
    const p = this.parts.get(shears.index);
    if (!p) return mask;
    const radius = shears.getValue(PruningShears, 'cutRadius') ?? 0.07;
    p.tip.getWorldPosition(this.tipPos);
    for (let i = 0; i < shoots.length; i++) {
      if (mask & (1 << i)) continue;
      const cp = this.cutPoints.get(shoots[i]);
      if (!cp) continue;
      cp.getWorldPosition(this.cutPos);
      if (this.cutPos.distanceTo(this.tipPos) > radius) {
        this.armed |= 1 << i;
        continue;
      }
      if (!(this.armed & (1 << i))) continue;
      mask |= 1 << i;
      p.snip = 0;
      this.cuts++;
    }
    return mask;
  }

  /** Cuts a healthy branch the blade tip deliberately reaches (see HEALTHY_RADIUS). */
  private wrongCut(shears: Entity, healthy: string[], stumps: number, shoots: string[], mask: number): number {
    const p = this.parts.get(shears.index);
    if (!p) return stumps;
    p.tip.getWorldPosition(this.tipPos);
    // A glowing shoot within reach always wins: the blades are there for it.
    const radius = shears.getValue(PruningShears, 'cutRadius') ?? 0.07;
    for (let i = 0; i < shoots.length; i++) {
      if (mask & (1 << i)) continue;
      const cp = this.cutPoints.get(shoots[i]);
      if (cp && cp.getWorldPosition(this.cutPos).distanceTo(this.tipPos) <= radius) return stumps;
    }
    for (let i = 0; i < healthy.length; i++) {
      if (stumps & (1 << i)) continue;
      const cp = this.cutPoints.get(healthy[i]);
      if (!cp) continue;
      cp.getWorldPosition(this.cutPos);
      if (this.cutPos.distanceTo(this.tipPos) > HEALTHY_RADIUS) {
        this.armedHealthy |= 1 << i;
        continue;
      }
      if (!(this.armedHealthy & (1 << i))) continue;
      stumps |= 1 << i;
      p.snip = 0;
      this.wrongCuts++;
    }
    return stumps;
  }

  private bitsAdded(before: number, after: number): number {
    let n = 0;
    for (let m = after & ~before; m; m &= m - 1) n++;
    return n;
  }

  private animate(p: ShearsParts, delta: number): void {
    if (p.snip >= SNIP_SECONDS) return;
    p.snip = Math.min(SNIP_SECONDS, p.snip + delta);
    const k = p.snip / SNIP_SECONDS;
    const yaw = OPEN_YAW * Math.abs(1 - 2 * k); // open -> shut -> open
    if (p.upper) p.upper.rotation.y = yaw;
    if (p.lower) p.lower.rotation.y = -yaw;
  }
}
