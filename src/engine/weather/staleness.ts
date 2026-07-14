import type { WeatherSnapshot } from "./types";

/**
 * Whether a stale (previously-successful) weather snapshot should still be
 * used after a subsequent fetch failure. `null` (never once succeeded)
 * always returns false — the caller should fall back to a neutral mood
 * rather than pretend a stale snapshot exists.
 */
export function shouldKeepStale(lastGood: WeatherSnapshot | null, nowMs: number, maxAgeMs: number): boolean {
  if (lastGood === null) return false;
  return nowMs - lastGood.fetchedAt <= maxAgeMs;
}
