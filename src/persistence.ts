import { createSystem, Entity, VisibilityState } from '@iwsdk/core';
import { Bonsai, Seed } from './garden-components.js';
import { MeditationSystem } from './meditation.js';
import { clearSave, emptySave, GardenSave, loadSave, storeSave } from './save/garden-save.js';

/** How often the garden checks for changes to save. */
const SAVE_EVERY_SECONDS = 2;

/**
 * Keeps the garden between visits. On load it restores the bonsai (and hides
 * the seed if it was already planted); while playing it saves whenever the
 * state changes, and again when the page or headset goes away.
 * Open the app with `?fresh` to start over (handy for demos); the parameter
 * is then removed from the address so a reload keeps the new garden.
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
  private bonsai: Entity | null = null;
  private baseMeditations = 0;
  private sinceCheck = 0;
  private lastKey = '';
  private visitCounted = false;
  /** Storage refused a write: stop trying, the garden just runs unsaved. */
  private blocked = false;
  private meditation?: MeditationSystem;

  init(): void {
    this.consumeFreshParam();
    const loaded = loadSave();
    this.save = loaded ?? emptySave();
    this.returning = loaded?.planted ?? false;
    this.baseMeditations = this.save.meditations;
    this.meditation = this.world.getSystem(MeditationSystem);

    const restoreBonsai = (e: Entity) => {
      this.bonsai = e;
      if (this.restored.has(e)) return;
      this.restored.add(e);
      e.setValue(Bonsai, 'planted', this.save.planted);
      e.setValue(Bonsai, 'stage', this.save.stage);
      e.setValue(Bonsai, 'water', this.save.water);
      e.setValue(Bonsai, 'prunedMask', this.save.prunedMask);
    };
    const hideSeed = (e: Entity) => {
      // Already planted: the guide disposes hidden seeds.
      if (this.save.planted && e.object3D) e.object3D.visible = false;
    };
    const flush = () => this.saveIfChanged();
    window.addEventListener('pagehide', flush);
    this.cleanupFuncs.push(
      this.queries.bonsai.subscribe('qualify', restoreBonsai),
      this.queries.bonsai.subscribe('disqualify', (e) => {
        if (this.bonsai === e) this.bonsai = null;
      }),
      this.queries.seeds.subscribe('qualify', hideSeed),
      () => window.removeEventListener('pagehide', flush),
      this.world.visibilityState.subscribe((state) => {
        if (state === VisibilityState.Visible && !this.visitCounted) {
          // A visit is an entry into VR, not a page load or reload.
          this.visitCounted = true;
          this.save.visits += 1;
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

  /** True once the player has finished a breathing session on any visit. */
  get hasMeditated(): boolean {
    return this.baseMeditations + (this.meditation?.completed ?? 0) > 0;
  }

  /** Copies live state into the save and writes it if anything changed. */
  private saveIfChanged(): void {
    if (this.blocked) return;
    const s = this.save;
    const b = this.bonsai;
    // Only read the bonsai once it holds the restored values, never the scene defaults.
    if (b && this.restored.has(b)) {
      s.planted = b.getValue(Bonsai, 'planted') ?? false;
      s.stage = b.getValue(Bonsai, 'stage') ?? 0;
      // Floor, never round: a reload must not top the water up to "full".
      s.water = Math.floor((b.getValue(Bonsai, 'water') ?? 0) * 100) / 100;
      s.prunedMask = b.getValue(Bonsai, 'prunedMask') ?? 0;
    }
    s.meditations = this.baseMeditations + (this.meditation?.completed ?? 0);
    const key = `${s.planted}|${s.stage}|${s.water}|${s.prunedMask}|${s.visits}|${s.meditations}`;
    if (key === this.lastKey) return;
    s.savedAt = Date.now();
    this.lastKey = key;
    if (!storeSave(s)) this.blocked = true;
  }

  private consumeFreshParam(): void {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('fresh')) return;
    clearSave();
    url.searchParams.delete('fresh');
    try {
      window.history.replaceState(window.history.state, '', url);
    } catch {
      /* some embedded browsers forbid it; the reset already happened */
    }
  }
}
