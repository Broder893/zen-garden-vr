import {
  createSystem,
  Entity,
  Grabbed,
  Object3D,
  Quaternion,
  UIKit,
  UIKitMLAsset,
  Vector3,
  VisibilityState,
} from '@iwsdk/core';
import { BonsaiGrowthSystem } from './bonsai-growth.js';
import { breakPatternFor, withPace } from './breath-patterns.js';
import { ComfortSystem } from './comfort.js';
import { trackFirst, FirstEntity } from './ecs-utils.js';
import { EntranceSystem } from './entrance.js';
import { AssistHeld, Bonsai, BreathOrb, PruningShears, WateringCan } from './garden-components.js';
import type { LineId } from './guide.js';
import { MeditationSystem } from './meditation.js';
import { OpenHandDetector } from './open-hand.js';
import { HealthSystem } from './health.js';
import { Health } from './save/plant-health.js';
import { isUnlocked } from './save/growth-levels.js';
import { PruningSystem } from './pruning.js';

/** Seconds of care between breaks: a random wait in this range, so they never feel scheduled. */
const WAIT_MIN = 120;
const WAIT_MAX = 240;
/** After "not now": ask again after this long. */
const LATER_MIN = 60;
const LATER_MAX = 120;
/** If a tool is picked up during the invitation, try again soon. */
const RETRY_SECONDS = 25;
/** The invitation: two short lines, then the break begins unless the player declines. */
const INVITE_LINE_SECONDS = 3.5;
const INVITE_SECONDS = INVITE_LINE_SECONDS * 2;
/** How long an open hand must be shown to mean "not now". */
const OPEN_HAND_SECONDS = 0.4;
/** A tense tree: after this long, the firefly offers a break even outside the usual rhythm. */
const TENSE_INVITE_SECONDS = 10;
/** ...but not sooner than this after the last invitation. */
const TENSE_COOLDOWN = 45;
/** Light level during a break (fraction of normal). */
const DIM_LEVEL = 0.25;
/** Water given to the tree when a break is finished: breathing helps it grow. */
const WATER_BONUS = 0.5;
/**
 * The breathing light floats this far in front of the eyes, at eye level, with
 * its card below: nearer than the tree (about 0.6 m away), so nothing hides them.
 */
const FRONT_DISTANCE = 0.5;
const FRONT_DROP = 0;
const PANEL_DROP = 0.19;

type State = 'waiting' | 'inviting' | 'session';

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/**
 * Short breathing breaks during care. Every two to four minutes of tending the
 * tree, the firefly comes close and invites the player to breathe. Never while
 * a tool is in hand, never twice without some care in between, and an open
 * hand held up says "not now" with no penalty. The garden dims, a light in
 * front of the eyes breathes with the player, a card names each step and
 * counts the breaths; afterwards the tree gets a little water as a reward.
 * The rhythm follows the tree's stage (simple, box, long).
 */
export class BreathBreakSystem extends createSystem({
  bonsai: { required: [Bonsai] },
  heldCans: { required: [WateringCan, Grabbed] },
  heldShears: { required: [PruningShears, Grabbed] },
  assisted: { required: [AssistHeld] },
  orbs: { required: [BreathOrb] },
}) {
  state: State = 'waiting';
  /** Seconds of care left before the next invitation. */
  wait = rand(WAIT_MIN, WAIT_MAX);
  /** The invitation line to show now (null when not inviting); read by the guide. */
  inviteLine: LineId | null = null;
  /** Where the firefly waits while inviting: close, in front of the player. */
  readonly invitePoint = new Vector3();
  /** Breaks declined with an open hand (this session). */
  postponed = 0;
  private inviteTime = 0;
  private tenseInvite = false;
  private tenseTime = 0;
  private sinceInvite = 999;
  private health?: HealthSystem;
  private rewarded = false;
  private orbMoved = false;
  private panelSaved = false;
  private openHandTime = 0;
  private cared = false;
  private lastCuts = 0;
  private lastWater = 0;
  private lastStage = -1;
  private bonsaiRef!: FirstEntity;
  private orbRef!: FirstEntity;
  private meditation?: MeditationSystem;
  private entrance?: EntranceSystem;
  private pruning?: PruningSystem;
  private growth?: BonsaiGrowthSystem;
  private comfort?: ComfortSystem;
  private guide?: { showEvent(id: LineId, seconds: number): void; readonly busy: boolean };
  private panel: Object3D | null = null;
  private subtitles: Object3D | null = null;
  private word: UIKit.Text | null = null;
  private count: UIKit.Text | null = null;
  private orbHome = new Vector3();
  private panelHome = new Vector3();
  private panelHomeQuat = new Quaternion();
  private shownWord = '';
  private shownBreath = -1;
  private head = new Vector3();
  private headQuat = new Quaternion();
  private forward = new Vector3();
  private v = new Vector3();
  private openHand!: OpenHandDetector;

  init(): void {
    this.bonsaiRef = trackFirst(this.queries.bonsai, this.cleanupFuncs);
    this.orbRef = trackFirst(this.queries.orbs, this.cleanupFuncs);
    this.meditation = this.world.getSystem(MeditationSystem);
    this.entrance = this.world.getSystem(EntranceSystem);
    this.pruning = this.world.getSystem(PruningSystem);
    this.growth = this.world.getSystem(BonsaiGrowthSystem);
    this.comfort = this.world.getSystem(ComfortSystem);
    const panel = this.world.getSceneObject<UIKitMLAsset>('breath-panel');
    this.panel = panel ?? null;
    this.word = panel?.getElementById<UIKit.Text>('breath-word') ?? null;
    this.count = panel?.getElementById<UIKit.Text>('breath-count') ?? null;
    if (this.panel) this.panel.visible = false;
    this.subtitles = this.world.getSceneObject('subtitle-panel') ?? null;
    this.openHand = new OpenHandDetector(this.renderer.xr, this.player, this.player.head, (side) => this.comfort?.usesHand(side) ?? true);
  }

  /** The guide registers itself here (it is created after this system). */
  attachGuide(guide: { showEvent(id: LineId, seconds: number): void; readonly busy: boolean }): void {
    this.guide = guide;
  }

  /** Starts the invitation now, skipping the wait (demos and tests). */
  inviteNow(): void {
    this.wait = 0;
    this.cared = true;
  }

  update(delta: number): void {
    if (this.world.visibilityState.peek() !== VisibilityState.Visible) return;
    const bonsai = this.bonsaiRef.entity;
    if (!bonsai) return;
    this.player.head.getWorldPosition(this.head);
    this.watchCare(bonsai.getValue(Bonsai, 'water') ?? 0, bonsai.getValue(Bonsai, 'stage') ?? 0);

    switch (this.state) {
      case 'waiting': {
        if (!(bonsai.getValue(Bonsai, 'planted') ?? false)) return;
        // The clock only runs while the player is tending the tree, not resting.
        if (!this.meditation?.active) this.wait -= delta;
        this.sinceInvite += delta;
        this.health ??= this.world.getSystem(HealthSystem);
        const tense = (this.health?.state ?? Health.Healthy) >= Health.Stressed;
        this.tenseTime = tense ? this.tenseTime + delta : 0;
        if (this.wait <= 0 && this.canInvite()) this.beginInvite(false);
        else if (this.tenseTime >= TENSE_INVITE_SECONDS && this.sinceInvite >= TENSE_COOLDOWN && this.canInviteNow()) {
          // A tense tree: breathing is its best care, so the firefly offers it now.
          this.beginInvite(true);
        }
        break;
      }
      case 'inviting':
        this.invite(delta, bonsai.getValue(Bonsai, 'stage') ?? 0);
        break;
      case 'session':
        this.followSession(bonsai);
        break;
    }
  }

  /** Any care (water, a cut, growth) since the last break allows the next one. */
  private watchCare(water: number, stage: number): void {
    const cuts = this.pruning?.cuts ?? 0;
    if (cuts !== this.lastCuts || water > this.lastWater + 0.05 || (this.lastStage >= 0 && stage !== this.lastStage)) {
      this.cared = true;
    }
    this.lastCuts = cuts;
    if (water > this.lastWater + 0.05 || water < this.lastWater) this.lastWater = water;
    this.lastStage = stage;
  }

  private toolInHand(): boolean {
    return (
      this.queries.heldCans.entities.size > 0 ||
      this.queries.heldShears.entities.size > 0 ||
      this.queries.assisted.entities.size > 0
    );
  }

  private canInvite(): boolean {
    return this.cared && this.canInviteNow();
  }

  /** Nothing in the way of an invitation right now. */
  private canInviteNow(): boolean {
    return (
      !this.toolInHand() &&
      !(this.meditation?.active ?? false) &&
      (this.entrance?.lit ?? true) &&
      !(this.guide?.busy ?? false)
    );
  }

  private beginInvite(tense: boolean): void {
    this.tenseInvite = tense;
    this.sinceInvite = 0;
    this.state = 'inviting';
    this.inviteTime = 0;
    this.openHandTime = 0;
    // The firefly comes close: in front, a little below the eyes.
    this.player.head.getWorldQuaternion(this.headQuat);
    this.horizontalForward();
    this.invitePoint.copy(this.head).addScaledVector(this.forward, 0.42);
    this.invitePoint.y -= 0.12;
  }

  private invite(delta: number, stage: number): void {
    this.inviteTime += delta;
    const first = this.tenseInvite ? 'breakInviteTense' : 'breakInvite';
    this.inviteLine = this.inviteTime < INVITE_LINE_SECONDS ? first : 'breakSkip';
    if (this.toolInHand() || this.meditation?.active) {
      // A tool picked up, or the player started their own session at the stone:
      // never interrupt either; quietly try again a little later.
      this.endInvite(RETRY_SECONDS);
      return;
    }
    this.openHandTime = this.openHand.shown() ? this.openHandTime + delta : 0;
    if (this.openHandTime >= OPEN_HAND_SECONDS) {
      this.postponed++;
      this.endInvite(rand(LATER_MIN, LATER_MAX));
      this.guide?.showEvent('breakLater', 3);
      return;
    }
    if (this.inviteTime >= INVITE_SECONDS) this.beginSession(stage);
  }

  private endInvite(wait: number): void {
    this.state = 'waiting';
    this.inviteLine = null;
    this.wait = wait;
  }

  private beginSession(stage: number): void {
    this.inviteLine = null;
    this.state = 'session';
    const pace = this.comfort?.settings.breathPace ?? 'medium';
    const xp = this.bonsaiRef.entity?.getValue(Bonsai, 'xp') ?? 0;
    const pattern = breakPatternFor(stage, isUnlocked(xp, 'deepBreath'), this.meditation?.breaksCompleted ?? 0);
    this.meditation?.start('break', withPace(pattern, pace));
    this.entrance?.dimTo(DIM_LEVEL);
    this.placeInFront();
    this.shownWord = '';
    this.shownBreath = -1;
    this.rewarded = false;
  }

  private followSession(bonsai: Entity): void {
    const med = this.meditation;
    if (!med || med.kind !== 'break' || med.phase === 'idle') {
      // Ended (or replaced by a stone session, or left paused too long).
      this.endSession();
      return;
    }
    if (med.phase === 'outro') {
      // Finished: reward once, bring the light and the subtitles back while the orb fades.
      if (!this.rewarded) {
        this.rewarded = true;
        this.reward(bonsai);
        this.entrance?.dimTo(1);
        if (this.panel) this.panel.visible = false;
        if (this.subtitles) this.subtitles.visible = true;
      }
      return;
    }
    this.updateCard(med);
  }

  private reward(bonsai: Entity): void {
    // Water helps at every stage: a full tree earns its watering XP.
    const water = bonsai.getValue(Bonsai, 'water') ?? 0;
    bonsai.setValue(Bonsai, 'water', Math.min(1, water + WATER_BONUS));
    this.growth?.sparkle();
  }

  private endSession(): void {
    this.state = 'waiting';
    this.cared = false;
    this.wait = rand(WAIT_MIN, WAIT_MAX);
    this.entrance?.dimTo(1);
    this.restore();
  }

  /** Moves the breathing light and its card to the centre of view; restore() undoes it. */
  private placeInFront(): void {
    this.player.head.getWorldQuaternion(this.headQuat);
    this.horizontalForward();
    const orb = this.orbRef.entity?.object3D;
    if (orb) {
      this.orbHome.copy(orb.position);
      this.orbMoved = true;
      this.v.copy(this.head).addScaledVector(this.forward, FRONT_DISTANCE);
      this.v.y -= FRONT_DROP;
      this.setWorldPosition(orb, this.v);
    }
    const panel = this.panel;
    if (panel) {
      this.panelHome.copy(panel.position);
      this.panelHomeQuat.copy(panel.quaternion);
      this.panelSaved = true;
      this.v.copy(this.head).addScaledVector(this.forward, FRONT_DISTANCE);
      this.v.y -= FRONT_DROP + PANEL_DROP;
      this.setWorldPosition(panel, this.v);
      panel.lookAt(this.head);
      panel.visible = true;
    }
    if (this.subtitles) this.subtitles.visible = false;
  }

  private restore(): void {
    const orb = this.orbRef.entity?.object3D;
    // Only put back what placeInFront() actually moved.
    if (orb && this.orbMoved) orb.position.copy(this.orbHome);
    this.orbMoved = false;
    if (this.panel && this.panelSaved) {
      this.panel.position.copy(this.panelHome);
      this.panel.quaternion.copy(this.panelHomeQuat);
      this.panel.visible = false;
    }
    this.panelSaved = false;
    if (this.subtitles) this.subtitles.visible = true;
  }

  /** The card names the step and counts the breaths ("Breath 2 of 3"). */
  private updateCard(med: MeditationSystem): void {
    let word: string;
    if (med.paused) word = 'Paused';
    else if (med.phase === 'in') word = 'Breathe in';
    else if (med.phase === 'out') word = 'Breathe out';
    else if (med.phase === 'hold' || med.phase === 'rest') word = 'Hold';
    else word = 'Follow the light';
    if (word !== this.shownWord) {
      this.shownWord = word;
      this.word?.setProperties({ text: word });
    }
    const breath = Math.min(med.breath, med.pattern.breaths - 1);
    if (breath !== this.shownBreath) {
      this.shownBreath = breath;
      this.count?.setProperties({ text: `Breath ${breath + 1} of ${med.pattern.breaths}` });
    }
  }

  /** this.forward = the head's forward direction, flattened to the horizontal. */
  private horizontalForward(): void {
    this.forward.set(0, 0, -1).applyQuaternion(this.headQuat);
    this.forward.y = 0;
    if (this.forward.lengthSq() < 1e-6) this.forward.set(0, 0, -1);
    this.forward.normalize();
  }

  private setWorldPosition(obj: Object3D, world: Vector3): void {
    obj.position.copy(world);
    obj.parent?.worldToLocal(obj.position);
  }
}
