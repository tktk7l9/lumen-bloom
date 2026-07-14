// Moonlight recipe: a cool secondary key light that only matters at night,
// scaled by the moon's altitude and its illuminated fraction so a low
// crescent barely registers while a high full moon casts real shadows.

import type { MoonPosition } from "../astro/lunar";
import { sunDirection } from "../geometry/sunVector";

export interface MoonLightingState {
  /** ENU unit vector — same convention as the sun's. */
  directionEnu: readonly [number, number, number];
  intensity: number;
}

const PEAK_INTENSITY = 0.5;

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/**
 * `sunAltDeg` gates moonlight to actual night: during the day the sun
 * overwhelms it, so it fades in only once the sun drops below the horizon.
 */
export function deriveMoonLighting(
  moon: Pick<MoonPosition, "azimuth" | "apparentAltitude">,
  illumination: number,
  sunAltDeg: number,
): MoonLightingState {
  const nightMix = 1 - smoothstep(-10, 0, sunAltDeg);
  const altitudeMix = smoothstep(0, 20, moon.apparentAltitude);
  return {
    directionEnu: sunDirection(moon.azimuth, moon.apparentAltitude),
    intensity: PEAK_INTENSITY * nightMix * altitudeMix * clamp01(illumination),
  };
}
