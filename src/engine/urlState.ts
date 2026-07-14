// URL query overrides — lets a link pin the wallpaper to a place, moment,
// or centerpiece (e.g. ?lat=-33.87&lng=151.21&t=2026-01-01T20:00:00Z).
// Pure string parsing so it's fully testable in node.

import type { GeoLocation } from "./astro/types";

export interface UrlOverrides {
  /** Both lat & lng present and in range, else null. */
  location: GeoLocation | null;
  /** `t=` ISO datetime, expressed as an offset from real now (time keeps flowing). */
  timeOffsetMs: number | null;
  /** `obj=` centerpiece id from the scene-object registry. */
  objectId: string | null;
  /** `hud=1` forces the HUD on, `hud=0` off; null = user preference. */
  hud: boolean | null;
  /** `info=1` forces the flower info card on, `info=0` off; null = user preference. */
  info: boolean | null;
}

export function parseUrlOverrides(search: string, nowMs: number): UrlOverrides {
  const params = new URLSearchParams(search);

  let location: GeoLocation | null = null;
  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));
  if (
    params.has("lat") &&
    params.has("lng") &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  ) {
    location = { lat, lng };
  }

  let timeOffsetMs: number | null = null;
  const t = params.get("t");
  if (t !== null) {
    const parsed = Date.parse(t);
    if (Number.isFinite(parsed)) timeOffsetMs = parsed - nowMs;
  }

  const obj = params.get("obj");
  const objectId = obj !== null && /^[a-z0-9-]+$/.test(obj) ? obj : null;

  const hud = params.get("hud");
  const hudFlag = hud === "1" ? true : hud === "0" ? false : null;

  const info = params.get("info");
  const infoFlag = info === "1" ? true : info === "0" ? false : null;

  return { location, timeOffsetMs, objectId, hud: hudFlag, info: infoFlag };
}
