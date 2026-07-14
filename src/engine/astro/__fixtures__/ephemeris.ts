// Reference ephemeris values for fixture tests, ported from skydial
// (fetched 2026-07-07; see skydial/src/astro/__fixtures__/ephemeris.ts for
// the full set including moon/rise-set data not needed here).
//
// Primary source for TOKYO's solar-noon anchor — USNO Astronomical
// Applications API (aa.usno.navy.mil/api/rstt/oneday), minute precision.
//
// JPL Horizons airless apparent az/el of the sun's center for Tokyo
// (139.6503E, 35.6762N, 0 m), fetched 2026-07-07. Anchors raw position
// accuracy at the ~0.01° level.

import type { GeoLocation } from "../types";

export const TOKYO: GeoLocation = { lat: 35.6762, lng: 139.6503 };

export const HORIZONS_SUN_TOKYO = [
  { utc: "2026-06-20T19:24:00Z", azimuth: 59.724851, altitude: -1.153381 },
  { utc: "2026-06-20T19:25:00Z", azimuth: 59.872523, altitude: -0.977891 },
  { utc: "2026-06-20T19:26:00Z", azimuth: 60.019876, altitude: -0.802138 },
] as const;
