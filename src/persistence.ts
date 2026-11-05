import { createSystem, Entity, VisibilityState } from '@iwsdk/core';
import { trackFirst, FirstEntity } from './ecs-utils.js';
import { Bonsai, Seed } from './garden-components.js';
import { MeditationSystem } from './meditation.js';
import {
  clearSave,
  emptySave,
  GardenSave,
  loadSave,
  storeSave,
  VISIT_GAP_MS,
  visitGrowsFlower,
} from './save/garden-save.js';
import { dayKey, XP } from './save/growth-levels.js';

/** How often the garden checks for changes to save. */
const SAVE_EVERY_SECONDS = 2;

/**
 * Keeps the garden between visits. On load it restores the bonsai (and hides
 * the seed if it was already planted); while playing it saves whenever the
 * state changes, and again when the page or headset goes away.
 * Open the app with `?fresh` to start over, or `?nextvisit` to count this
 * entry as a new visit without waiting (both handy for demos); the parameter
 * is then removed from the address so a reload behaves normally.
 */
export class PersistenceSystem extends createSystem({
  bonsai: { required: [Bonsai] },
  seeds: { required: [Seed] },
}) {
  /** True when this visit continues a garden planted on an earlier visit. */
  returning = false;
  /** The state as last loaded or saved. */
  save: GardenSave = emptySave();
  private restored = new WeakSet<Entity>();
  private bonsai!: FirstEntity;
  private baseMeditations = 0;
  private baseBreaks = 0;
  private sinceCheck = 0;
  private lastKey = '';
  private visitCounted = false;
  private forceVisit = false;
  /** True when entering VR this time counted as a new visit. */
  newVisit = false;
  /** True when this visit brought the daily gift (first visit of the day, tree planted). */
  dailyGift = false;
  /** Storage refused a write: stop trying, the garden just runs unsaved. */
  private blocked = false;
  private meditation?: MeditationSystem;

  init(): void {
    this.consumeDemoParams();
    const loaded = loadSave();
    this.save = loaded ?? emptySave();
    this.returning = loaded?.planted ?? false;
    this.baseMeditations = this.save.meditations;
    this.baseBreaks = this.save.breaks;
    this.meditation = this.world.getSystem(MeditationSystem);

    this.bonsai = trackFirst(this.queries.bonsai, this.cleanupFuncs);
    const restoreBonsai = (e: Entity) => {
      if (this.restored.has(e)) return;
      this.restored.add(e);
      e.setValue(Bonsai, 'planted', this.save.planted);
      e.setValue(Bonsai, 'stage', this.save.stage);
      e.setValue(Bonsai, 'water', this.save.water);
      e.setValue(Bonsai, 'prunedMask', this.save.prunedMask);
      e.setValue(Bonsai, 'xp', this.save.xp);
    };
    const hideSeed = (e: Entity) => {
      // Already planted: the guide disposes hidden seeds.
      if (this.save.planted && e.object3D) e.object3D.visible = false;
    };
    const flush = () => this.saveIfChanged();
    window.addEventListener('pagehide', flush);
    this.cleanupFuncs.push(
      this.queries.bonsai.subscribe('qualify', restoreBonsai),
      this.queries.seeds.subscribe('qualify', hideSeed),
      () => window.removeEventListener('pagehide', flush),
      this.world.visibilityState.subscribe((state) => {
        if (state === VisibilityState.Visible && !this.visitCounted) {
          // A visit is an entry into VR after some time away, not a reload.
          this.visitCounted = true;
          const now = Date.now();
          if (this.forceVisit || now - this.save.lastVisitAt >= VISIT_GAP_MS) {
            this.newVisit = true;
            this.save.visits += 1;
            this.save.lastVisitAt = now;
            this.regrow();
            this.lastKey = ''; // lastVisitAt is not in the change key: force a write
          }
          this.giveDailyGift(now);
          flush();
        }
        if (state === VisibilityState.Hidden || state === VisibilityState.VisibleBlurred) flush();
      }),
    );
    for (const e of this.queries.bonsai.entities) restoreBonsai(e);
    for (const e of this.queries.seeds.entities) hideSeed(e);
  }

  update(delta: number): void {
    this.sinceCheck += delta;
    if (this.sinceCheck < SAVE_EVERY_SECONDS) return;
    this.sinceCheck = 0;
    this.saveIfChanged();
  }

  /**
   * Time away has passed: the soil has dried and the shoots have grown back,
   * so a returning player always has something to tend (and XP to earn).
   */
  private regrow(): void {
    const b = this.bonsai.entity;
    if (!b || !(b.getValue(Bonsai, 'planted') ?? false)) return;
    b.setValue(Bonsai, 'water', 0);
    b.setValue(Bonsai, 'prunedMask', 0);
  }

  /** First entry of the day with a planted tree: a small XP gift. The day of planting starts the count. */
  private giveDailyGift(now: number): void {
    const today = dayKey(now);
    // ?nextvisit (demos) also brings the gift, without waiting for tomorrow.
    if (this.save.lastGiftDay === today && !this.forceVisit) return;
    const b = this.bonsai.entity;
    if (!b) return; // not loaded yet: keep today's gift for when it is
    const planted = b.getValue(Bonsai, 'planted') ?? false;
    this.save.lastGiftDay = today;
    this.lastKey = '';
    if (!planted || !this.returning) return;
    b.setValue(Bonsai, 'xp', (b.getValue(Bonsai, 'xp') ?? 0) + XP.dailyGift);
    // A new day always brings something to tend, even soon after the last visit.
    this.regrow();
    this.dailyGift = true;
  }

  /** True when this visit is the one that grows a new flower. */
  get newFlowerThisVisit(): boolean {
    return this.newVisit && visitGrowsFlower(this.save.visits);
  }

  /** True once the player has finished a breathing session on any visit. */
  get hasMeditated(): boolean {
    return this.baseMeditations + (this.meditation?.completed ?? 0) > 0;
  }

  /** Copies live state into the save and writes it if anything changed. */
  private saveIfChanged(): void {
    if (this.blocked) return;
    const s = this.save;
    const b = this.bonsai.entity;
    // Only read the bonsai once it holds the restored values, never the scene defaults.
    if (b && this.restored.has(b)) {
      s.planted = b.getValue(Bonsai, 'planted') ?? false;
      s.stage = b.getValue(Bonsai, 'stage') ?? 0;
      // Floor, never round: a reload must not top the water up to "full".
      s.water = Math.floor((b.getValue(Bonsai, 'water') ?? 0) * 100) / 100;
      s.prunedMask = b.getValue(Bonsai, 'prunedMask') ?? 0;
      s.xp = b.getValue(Bonsai, 'xp') ?? 0;
    }
    s.meditations = this.baseMeditations + (this.meditation?.completed ?? 0);
    s.breaks = this.baseBreaks + (this.meditation?.breaksCompleted ?? 0);
    const key = `${s.planted}|${s.stage}|${s.water}|${s.prunedMask}|${s.visits}|${s.meditations}|${s.breaks}|${s.xp}`;
    if (key === this.lastKey) return;
    s.savedAt = Date.now();
    this.lastKey = key;
    if (!storeSave(s)) this.blocked = true;
  }

  private consumeDemoParams(): void {
    const url = new URL(window.location.href);
    const fresh = url.searchParams.has('fresh');
    this.forceVisit = url.searchParams.has('nextvisit');
    if (!fresh && !this.forceVisit) return;
    if (fresh) clearSave();
    url.searchParams.delete('fresh');
    url.searchParams.delete('nextvisit');
    try {
      window.history.replaceState(window.history.state, '', url);
    } catch {
      /* some embedded browsers forbid it; the reset already happened */
    }
  }
}
