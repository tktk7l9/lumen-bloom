// Keeps the screen awake while the wallpaper is visible. Browsers may deny
// the request outside a user gesture, so we retry once on the first pointer
// interaction, and re-acquire whenever the tab becomes visible again (the
// lock is auto-released on hide).

interface WakeLockSentinelLike {
  release(): Promise<void>;
}

interface WakeLockLike {
  request(type: "screen"): Promise<WakeLockSentinelLike>;
}

export function setupWakeLock(): void {
  const wakeLock = (navigator as Navigator & { wakeLock?: WakeLockLike }).wakeLock;
  if (!wakeLock) return;

  let sentinel: WakeLockSentinelLike | null = null;

  async function acquire(): Promise<void> {
    try {
      sentinel = await wakeLock!.request("screen");
    } catch {
      sentinel = null; // denied (power save, battery, no gesture) — stay silent
    }
  }

  void acquire();
  window.addEventListener("pointerdown", () => void (sentinel ?? acquire()), { once: true });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) void acquire();
  });
}
