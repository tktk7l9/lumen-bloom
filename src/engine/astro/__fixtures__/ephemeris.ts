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

/**
 * USNO principal-phase instants (UTC), for illumination anchors.
 * First quarter 2026-06-22 06:55 JST; last quarter 2026-07-08 04:29 JST;
 * full moon 2026-12-24 10:28 JST.
 */
export const USNO_MOON_PHASES = {
  firstQuarter: "2026-06-21T21:55:00Z",
  lastQuarter: "2026-07-07T19:29:00Z",
  full: "2026-12-24T01:28:00Z",
} as const;

/** USNO oneday API fracillum for the local day (quoted at local noon). */
export const USNO_MOON_ILLUMINATION = [
  { name: "Tokyo 2026-06-21", dayStartUtc: "2026-06-20T15:00:00Z", illumination: 0.42 },
  { name: "Tokyo 2026-12-22", dayStartUtc: "2026-12-21T15:00:00Z", illumination: 0.94 },
  { name: "Sydney 2026-12-22", dayStartUtc: "2026-12-21T13:00:00Z", illumination: 0.94 },
  { name: "Tromsø 2026-12-22", dayStartUtc: "2026-12-21T23:00:00Z", illumination: 0.96 },
] as const;
