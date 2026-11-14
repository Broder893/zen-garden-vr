import { createSystem, Object3D, UIKit, UIKitMLAsset, Vector3 } from '@iwsdk/core';
import { BonsaiGrowthSystem } from './bonsai-growth.js';
import { ComfortSystem } from './comfort.js';
import { trackFirst, FirstEntity } from './ecs-utils.js';
import { Bonsai } from './garden-components.js';
import { levelFor, nextLevel } from './save/growth-levels.js';
import { PersistenceSystem } from './persistence.js';

/** Width of the progress track in the badge (UIKit cm, public/ui/level.uikitml). */
const TRACK_WIDTH = 20.8;
/** "+10 XP" stays this long after care before the totals return. */
const GAIN_SECONDS = 1.6;
/** The badge sits by the front corner opposite the Comfort panel. */
const BADGE_X = 0.44;
/** The days in a row are checked this often (they change on entering and at midnight). */
const STREAK_CHECK_SECONDS = 5;
const DOT_ON = '#ffd76a';
const DOT_OFF = '#3a3350';

/**
 * A small badge by the table's front corner: the garden level, its name, and
 * a bar filling toward the next level. Each bit of care flashes "+N XP".
 * Text is rebuilt only when something changes.
 */
export class LevelBadgeSystem extends createSystem({
  bonsai: { required: [Bonsai] },
}) {
  private panel: Object3D | null = null;
  private title: UIKit.Text | null = null;
  private fill: UIKit.Text | null = null;
  private xpText: UIKit.Text | null = null;
  private bonsai!: FirstEntity;
  private growth?: BonsaiGrowthSystem;
  private comfort?: ComfortSystem;
  private shownXp = -1;
  private shownGains = -1;
  private gainLeft = 0;
  private head = new Vector3();
  private persistence?: PersistenceSystem;
  private streakRow: UIKit.Text | null = null;
  private streakText: UIKit.Text | null = null;
  private dots: (UIKit.Text | null)[] = [];
  private shownStreak = '';
  private sinceStreak = STREAK_CHECK_SECONDS;

  init(): void {
    this.bonsai = trackFirst(this.queries.bonsai, this.cleanupFuncs);
    this.growth = this.world.getSystem(BonsaiGrowthSystem);
    this.comfort = this.world.getSystem(ComfortSystem);
    const panel = this.world.getSceneObject<UIKitMLAsset>('level-badge');
    this.panel = panel ?? null;
    this.title = panel?.getElementById<UIKit.Text>('level-title') ?? null;
    this.fill = panel?.getElementById<UIKit.Text>('level-fill') ?? null;
    this.xpText = panel?.getElementById<UIKit.Text>('level-xp') ?? null;
    this.streakRow = panel?.getElementById<UIKit.Text>('streak-row') ?? null;
    this.streakText = panel?.getElementById<UIKit.Text>('streak-text') ?? null;
    for (let i = 0; i < 7; i++) this.dots.push(panel?.getElementById<UIKit.Text>(`streak-dot-${i}`) ?? null);
  }

  /** "3 days in a row" and the last 7 days as dots (today on the right); hidden until a day is counted. */
  private showStreak(delta: number): void {
    this.sinceStreak += delta;
    if (this.sinceStreak < STREAK_CHECK_SECONDS) return;
    this.sinceStreak = 0;
    this.persistence ??= this.world.getSystem(PersistenceSystem);
    const p = this.persistence;
    if (!p) return;
    const n = p.streak;
    const week = p.week;
    const key = `${n}|${week.join()}`;
    if (key === this.shownStreak) return;
    this.shownStreak = key;
    // A missed day: no count shown (and nothing negative said) until the next visit.
    this.streakRow?.setProperties({ display: week.some(Boolean) ? 'flex' : 'none' });
    this.streakText?.setProperties({ text: n > 0 ? `${n} ${n === 1 ? 'day' : 'days'} in a row` : 'This week' });
    for (let i = 0; i < 7; i++) this.dots[i]?.setProperties({ backgroundColor: week[i] ? DOT_ON : DOT_OFF });
  }

  update(delta: number): void {
    const panel = this.panel;
    const b = this.bonsai.entity;
    if (!panel || !b) return;
    // Opposite the Comfort panel, which follows the hand in use.
    panel.position.x = this.comfort?.settings.hands === 'right' ? -BADGE_X : BADGE_X;
    this.player.head.getWorldPosition(this.head);
    panel.lookAt(this.head);
    this.showStreak(delta);

    const xp = b.getValue(Bonsai, 'xp') ?? 0;
    const gains = this.growth?.gains ?? 0;
    if (this.shownGains >= 0 && gains !== this.shownGains) {
      this.gainLeft = GAIN_SECONDS;
      this.xpText?.setProperties({ text: `+${this.growth?.lastGain ?? 0} XP` });
    }
    this.shownGains = gains;
    if (this.gainLeft > 0) {
      this.gainLeft -= delta;
      if (this.gainLeft <= 0) this.shownXp = -1; // show the totals again
    }
    if (xp === this.shownXp) return;
    this.shownXp = xp;
    const level = levelFor(xp);
    const next = nextLevel(xp);
    this.title?.setProperties({ text: `Level ${level.level} - ${level.name}` });
    const k = next ? (xp - level.xp) / (next.xp - level.xp) : 1;
    this.fill?.setProperties({ width: Math.max(0.01, Math.min(1, k)) * TRACK_WIDTH });
    if (this.gainLeft <= 0) this.xpText?.setProperties({ text: next ? `${xp} / ${next.xp} XP` : `${xp} XP - top level` });
  }
}
