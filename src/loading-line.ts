import { AssetManager } from '@iwsdk/core';

/** How often to look for the engine's loader until it exists (ms). */
const LOOK_EVERY_MS = 50;

/**
 * The "Loading your garden…" line on the page's card (index.html, #loading):
 * the page shows it from the start; once the code runs it adds the share of
 * the garden's files loaded so far, from the engine's shared LoadingManager
 * (models, textures, sounds). It never goes back, even when files are queued
 * later. Call stop() when the garden runs, or when it could not start.
 */
export function startLoadingLine(): { stop: () => void } {
  const line = document.getElementById('loading');
  let shown = 0;
  let stopped = false;
  const show = (percent: number) => {
    if (!line || stopped) return;
    shown = Math.max(shown, Math.min(99, percent));
    line.textContent = `Loading your garden… ${shown}%`;
  };
  show(0);
  // The loader is created inside World.create: hook it as soon as it is there.
  const timer = setInterval(() => {
    const manager = AssetManager.loadingManager;
    if (!manager) return;
    clearInterval(timer);
    const before = manager.onProgress;
    manager.onProgress = (url, loaded, total) => {
      before?.(url, loaded, total);
      if (total > 0) show(Math.round((loaded / total) * 100));
    };
  }, LOOK_EVERY_MS);
  return {
    stop: () => {
      stopped = true;
      clearInterval(timer);
      line?.setAttribute('hidden', '');
    },
  };
}
