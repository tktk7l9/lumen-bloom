// Main-thread yielding for the staged 3D boot. The Three.js startup
// (renderer, PMREM environment, geometry, first frame) used to run as one
// long task; splitting it at these points lets the browser paint the text
// overlays first and keeps every individual task short.
// The host APIs are injected so this stays a pure, testable module.

export interface YieldHost {
  setTimeout(callback: () => void, ms: number): unknown;
  /** `scheduler.yield()` where supported (Chromium 129+). */
  scheduler?: { yield?: () => Promise<void> };
  requestAnimationFrame?(callback: () => void): unknown;
}

/**
 * End the current task and continue in a fresh one. Prefers
 * `scheduler.yield()` (the continuation keeps its priority) and falls back
 * to a zero-delay timer.
 */
export function yieldToMain(host: YieldHost): Promise<void> {
  const schedulerYield = host.scheduler?.yield;
  if (typeof schedulerYield === "function") return schedulerYield.call(host.scheduler);
  return new Promise((resolve) => {
    host.setTimeout(resolve, 0);
  });
}

// requestAnimationFrame never fires in a background tab; without this cap a
// wallpaper opened in a background tab would not start until it is focused.
export const AFTER_PAINT_FALLBACK_MS = 100;

/**
 * Resolve right after the next frame has been presented: one animation
 * frame to reach the rendering step, then a timer so the continuation runs
 * after the paint instead of before it. A fallback timer covers hosts where
 * animation frames are paused.
 */
export function afterNextPaint(
  host: YieldHost,
  fallbackMs: number = AFTER_PAINT_FALLBACK_MS,
): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (): void => {
      if (done) return;
      done = true;
      resolve();
    };
    host.setTimeout(finish, fallbackMs);
    if (typeof host.requestAnimationFrame === "function") {
      host.requestAnimationFrame(() => {
        host.setTimeout(finish, 0);
      });
    }
  });
}
