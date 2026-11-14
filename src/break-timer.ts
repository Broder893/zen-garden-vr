import {
  createSystem,
  Object3D,
  Quaternion,
  UIKit,
  UIKitMLAsset,
  Vector3,
  VisibilityState,
} from '@iwsdk/core';
import { BreathBreakSystem } from './breath-break.js';
import { BreakStats, summaryLines } from './break-summary.js';
import { ComfortSystem } from './comfort.js';
import { trackFirst, FirstEntity } from './ecs-utils.js';
import { EntranceSystem } from './entrance.js';
import { EyelidSystem } from './eyelids.js';
import { Bonsai } from './garden-components.js';
import type { GuideSystem } from './guide.js';
import { InputModeSystem } from './input-mode.js';
import { MeditationSystem } from './meditation.js';
import { PersistenceSystem } from './persistence.js';
import { PruningSystem } from './pruning.js';
import { BREAK_MINUTES, BreakMinutes } from './save/comfort-settings.js';
import { levelFor, nextLevel } from './save/growth-levels.js';

/** No answer in this long: the last choice is used. */
const ASK_SECONDS = 8;
/** "One more minute" this long before the end. */
const ALMOST_SECONDS = 60;
/** The summary stays this long, then the goodbye lines. */
const SUMMARY_SECONDS = 15;
/** The panel floats this far ahead of the eyes, a little below them. */
const PANEL_DISTANCE = 0.5;
const PANEL_DROP = 0.06;
/** Hold to select: a hand this close to a button for HAND_SECONDS; a look within GAZE_COS for GAZE_SECONDS. */
const HAND_RADIUS = 0.07;
const HAND_SECONDS = 1.2;
const GAZE_COS = Math.cos((5 * Math.PI) / 180);
const GAZE_SECONDS = 2;
const CLICK_GUARD_MS = 450;
const BUTTON = '#3a3350';
const BUTTON_ON = '#ffd76a';

type State = 'start' | 'asking' | 'running' | 'ending' | 'summary' | 'done';
type Choice = { minutes: BreakMinutes; el: UIKit.Text | null; text: UIKit.Text | null };

/**
 * The break's length and its close (Productivity). The first visit has no
 * timer: the tutorial runs as it is. From the next visit on, entering (eyes
 * open) brings a small panel ahead: 3, 5 or 10 minutes, picked with a poke, a
 * ray, a held hand or a look; with no answer in 8 s the last choice (5 at
 * first) is used. The time stops while the headset is off. A minute before the
 * end the firefly says so (never during a breath); at the end, once any
 * breathing session is over: a soft bell, "Your break is over", and a summary
 * for 15 s (minutes, breaths, cares, level, days in a row), then goodbye. The
 * garden stays open: playing on is always fine. Counts this visit only (no save).
 */
export class BreakTimerSystem extends createSystem({
  bonsai: { required: [Bonsai] },
}) {
  state: State = 'start';
  /** Seconds left in the break (while running). */
  left = 0;
  minutes: BreakMinutes = 5;
  /** This break's counts (read by tests and tooling). */
  breaths = 0;
  waterings = 0;
  trims = 0;
  private askLeft = 0;
  private summaryLeft = 0;
  private almostSaid = false;
  private asked = false;
  private endQueued = false;
  private chosen: BreakMinutes | null = null;
  private startXp = 0;
  private lastPhase = 'idle';
  private lastWater = 0;
  private lastCuts = 0;
  private panel: Object3D | null = null;
  private card: UIKit.Text | null = null;
  private title: UIKit.Text | null = null;
  private choicesRow: UIKit.Text | null = null;
  private summary: UIKit.Text | null = null;
  private stats = new Map<string, UIKit.Text>();
  private choices: Choice[] = [];
  /** Hold / look progress per source (0 left hand, 1 right hand, 2 gaze): which button and how long. */
  private dwellOn = [-1, -1, -1];
  private dwellTime = [0, 0, 0];
  private shownProgress = [-1, -1, -1];
  private bonsai!: FirstEntity;
  private guide?: GuideSystem;
  private persistence?: PersistenceSystem;
  private comfort?: ComfortSystem;
  private meditation?: MeditationSystem;
  private breaks?: BreathBreakSystem;
  private lids?: EyelidSystem;
  private entrance?: EntranceSystem;
  private pruning?: PruningSystem;
  private inputMode?: InputModeSystem;
  private head = new Vector3();
  private headQuat = new Quaternion();
  private forward = new Vector3();
  private p = new Vector3();
  private toward = new Vector3();

  init(): void {
    this.bonsai = trackFirst(this.queries.bonsai, this.cleanupFuncs);
    const panel = this.world.getSceneObject<UIKitMLAsset>('break-panel');
    this.panel = panel ?? null;
    if (panel) panel.visible = false;
    this.card = panel?.getElementById<UIKit.Text>('break-card') ?? null;
    this.card?.setProperties({ display: 'none' });
    this.title = panel?.getElementById<UIKit.Text>('break-title') ?? null;
    this.choicesRow = panel?.getElementById<UIKit.Text>('break-choices') ?? null;
    this.summary = panel?.getElementById<UIKit.Text>('break-summary') ?? null;
    for (const id of ['break-minutes', 'break-breaths', 'break-cares', 'break-level', 'break-streak']) {
      const el = panel?.getElementById<UIKit.Text>(id);
      if (el) this.stats.set(id, el);
    }
    for (const minutes of BREAK_MINUTES) {
      const el = panel?.getElementById<UIKit.Text>(`break-${minutes}`) ?? null;
      if (el) el.name = `break-${minutes}`;
      this.choices.push({ minutes, el, text: panel?.getElementById<UIKit.Text>(`break-${minutes}-t`) ?? null });
      if (!el) continue;
      let last = -Infinity;
      // On press (poke, ray or mouse), as the Comfort panel does.
      const pick = () => {
        const now = performance.now();
        if (now - last < CLICK_GUARD_MS) return;
        last = now;
        if (this.state === 'asking') this.chosen = minutes;
      };
      el.addEventListener('pointerdown', pick);
      this.cleanupFuncs.push(() => el.removeEventListener('pointerdown', pick));
    }
  }

  /** The guide registers itself (it is created after this system). */
  attachGuide(guide: GuideSystem): void {
    this.guide = guide;
  }

  update(delta: number): void {
    // Paused with the app: the headset off, the system menu.
    if (this.world.visibilityState.peek() !== VisibilityState.Visible) return;
    this.persistence ??= this.world.getSystem(PersistenceSystem);
    this.comfort ??= this.world.getSystem(ComfortSystem);
    this.meditation ??= this.world.getSystem(MeditationSystem);
    this.breaks ??= this.world.getSystem(BreathBreakSystem);
    this.lids ??= this.world.getSystem(EyelidSystem);
    this.entrance ??= this.world.getSystem(EntranceSystem);
    this.pruning ??= this.world.getSystem(PruningSystem);
    switch (this.state) {
      case 'start':
        return this.start();
      case 'asking':
        return this.ask(delta);
      case 'running':
        return this.run(delta);
      case 'ending':
        return this.end();
      case 'summary':
        this.summaryLeft -= delta;
        if (this.summaryLeft > 0) return;
        this.hide();
        this.guide?.queueEvent('seeYouTomorrow', 4);
        this.guide?.queueEvent('keepGoing', 4);
        this.state = 'done';
        return;
    }
  }

  /** First visit: nothing. Later visits: ask, once the eyes are open and the welcome is said. */
  private start(): void {
    const g = this.guide;
    if (!g || !this.persistence || !(this.entrance?.lit ?? true)) return;
    if (!this.persistence.returning) {
      this.state = 'done';
      return;
    }
    if (!(this.lids?.open ?? true)) return;
    if (g.shownLine !== 'breakLengthAsk') {
      if (!this.asked) {
        this.asked = true;
        g.queueEvent('breakLengthAsk', ASK_SECONDS);
      }
      return;
    }
    // The question is on screen: the panel with it.
    this.title?.setProperties({ text: 'How long is your break?' });
    this.choicesRow?.setProperties({ display: 'flex' });
    this.summary?.setProperties({ display: 'none' });
    this.show();
    this.askLeft = ASK_SECONDS;
    this.chosen = null;
    this.state = 'asking';
  }

  private ask(delta: number): void {
    this.askLeft -= delta;
    this.dwellOnButtons(delta);
    if (this.chosen === null && this.askLeft > 0) return;
    if (this.chosen !== null) this.comfort?.set('breakMinutes', this.chosen);
    this.minutes = this.chosen ?? this.comfort?.settings.breakMinutes ?? 5;
    this.hide();
    this.left = this.minutes * 60;
    const b = this.bonsai.entity;
    this.startXp = b?.getValue(Bonsai, 'xp') ?? 0;
    this.lastWater = b?.getValue(Bonsai, 'water') ?? 0;
    this.lastCuts = this.pruning?.cuts ?? 0;
    this.lastPhase = this.meditation?.phase ?? 'idle';
    this.state = 'running';
  }

  private run(delta: number): void {
    this.left -= delta;
    this.count();
    if (!this.almostSaid && this.left <= ALMOST_SECONDS && !this.breathing()) {
      this.almostSaid = true;
      // Not worth saying with only seconds left (a long breath ran over).
      if (this.left > 20) this.guide?.queueEvent('breakAlmostOver', 4);
    }
    if (this.left <= 0) this.state = 'ending';
  }

  /** The end waits for any breathing session (and its eyes) to finish. */
  private end(): void {
    this.count();
    if (this.breathing() || !(this.lids?.open ?? true)) return;
    const g = this.guide;
    if (!g) return;
    if (g.shownLine !== 'breakEnd') {
      if (!this.endQueued) {
        this.endQueued = true;
        g.queueEvent('breakEnd', 4);
      }
      return;
    }
    this.fillSummary();
    this.title?.setProperties({ text: 'Your break' });
    this.choicesRow?.setProperties({ display: 'none' });
    this.summary?.setProperties({ display: 'flex' });
    this.show();
    this.summaryLeft = SUMMARY_SECONDS;
    this.state = 'summary';
  }

  /** Breaths (each inhale of a session), full waterings and trims during the break. */
  private count(): void {
    const phase = this.meditation?.phase ?? 'idle';
    if (phase === 'in' && this.lastPhase !== 'in') this.breaths++;
    this.lastPhase = phase;
    const water = this.bonsai.entity?.getValue(Bonsai, 'water') ?? 0;
    if (water >= 1 && this.lastWater < 1) this.waterings++;
    this.lastWater = water;
    const cuts = this.pruning?.cuts ?? 0;
    if (cuts > this.lastCuts) this.trims += cuts - this.lastCuts;
    this.lastCuts = cuts;
  }

  private breathing(): boolean {
    return (this.meditation?.active ?? false) || !!this.breaks?.inviteLine;
  }

  private fillSummary(): void {
    const xp = this.bonsai.entity?.getValue(Bonsai, 'xp') ?? 0;
    const level = levelFor(xp);
    const next = nextLevel(xp);
    const stats: BreakStats = {
      minutes: this.minutes,
      breaths: this.breaths,
      waterings: this.waterings,
      trims: this.trims,
      level: level.level,
      levelName: level.name,
      xpGained: Math.max(0, xp - this.startXp),
      xp,
      nextXp: next ? next.xp : null,
      streak: 0,
    };
    const lines = summaryLines(stats);
    this.stats.get('break-minutes')?.setProperties({ text: lines.minutes });
    this.stats.get('break-breaths')?.setProperties({ text: lines.breaths });
    this.stats.get('break-cares')?.setProperties({ text: lines.cares });
    this.stats.get('break-level')?.setProperties({ text: lines.level });
    this.stats.get('break-streak')?.setProperties(lines.streak ? { text: lines.streak, display: 'flex' } : { display: 'none' });
  }

  /** In the middle of the view, at a comfortable distance, facing the eyes. */
  private show(): void {
    const panel = this.panel;
    if (!panel) return;
    this.player.head.getWorldPosition(this.head);
    this.player.head.getWorldQuaternion(this.headQuat);
    this.forward.set(0, 0, -1).applyQuaternion(this.headQuat);
    this.forward.y = 0;
    if (this.forward.lengthSq() < 1e-6) this.forward.set(0, 0, -1);
    this.forward.normalize();
    this.p.copy(this.head).addScaledVector(this.forward, PANEL_DISTANCE);
    this.p.y -= PANEL_DROP;
    if (panel.parent) panel.parent.worldToLocal(this.p);
    panel.position.copy(this.p);
    panel.lookAt(this.head);
    for (const c of this.choices) c.el?.setProperties({ backgroundColor: BUTTON });
    this.card?.setProperties({ display: 'flex' });
    panel.visible = true;
  }

  private hide(): void {
    this.card?.setProperties({ display: 'none' });
    if (this.panel) this.panel.visible = false;
    this.dwellOn.fill(-1);
    this.dwellTime.fill(0);
  }

  /** Hold to select (hands, with the Comfort option) and a steady look (always): fills the button, then picks it. */
  private dwellOnButtons(delta: number): void {
    this.inputMode ??= this.world.getSystem(InputModeSystem);
    this.player.head.getWorldPosition(this.head);
    this.player.head.getWorldQuaternion(this.headQuat);
    this.forward.set(0, 0, -1).applyQuaternion(this.headQuat);
    const hands = this.comfort?.settings.dwell ?? false;
    for (let source = 0; source < 3; source++) {
      let target = -1;
      if (source < 2) {
        const space = source === 0 ? this.player.gripSpaces.left : this.player.gripSpaces.right;
        const allowed = hands && (this.comfort?.usesHand(source === 0 ? 'left' : 'right') ?? true);
        if (allowed && space) {
          space.getWorldPosition(this.toward);
          target = this.nearestButton(this.toward, HAND_RADIUS);
        }
      } else target = this.lookedAtButton();
      if (target !== this.dwellOn[source]) {
        this.dwellOn[source] = target;
        this.dwellTime[source] = 0;
      }
      if (target < 0) continue;
      this.dwellTime[source] += delta;
      if (this.dwellTime[source] >= (source < 2 ? HAND_SECONDS : GAZE_SECONDS)) this.chosen = this.choices[target].minutes;
    }
    // The button being held or looked at fills with light (only on changes, in tenths).
    for (let i = 0; i < this.choices.length; i++) {
      let k = 0;
      for (let source = 0; source < 3; source++) {
        if (this.dwellOn[source] === i) k = Math.max(k, this.dwellTime[source] / (source < 2 ? HAND_SECONDS : GAZE_SECONDS));
      }
      const step = Math.min(10, Math.floor(k * 10));
      if (step === this.shownProgress[i]) continue;
      this.shownProgress[i] = step;
      this.choices[i].el?.setProperties({ backgroundColor: step > 0 ? BUTTON_ON : BUTTON, opacity: step > 0 ? 0.35 + 0.065 * step : 1 });
    }
  }

  private nearestButton(at: Vector3, radius: number): number {
    let best = -1;
    let bestD = radius;
    for (let i = 0; i < this.choices.length; i++) {
      const el = this.choices[i].el as unknown as Object3D | null;
      if (!el) continue;
      el.getWorldPosition(this.p);
      const d = this.p.distanceTo(at);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  private lookedAtButton(): number {
    let best = -1;
    let bestCos = GAZE_COS;
    for (let i = 0; i < this.choices.length; i++) {
      const el = this.choices[i].el as unknown as Object3D | null;
      if (!el) continue;
      el.getWorldPosition(this.p);
      this.toward.subVectors(this.p, this.head).normalize();
      const cos = this.toward.dot(this.forward);
      if (cos > bestCos) {
        bestCos = cos;
        best = i;
      }
    }
    return best;
  }
}
