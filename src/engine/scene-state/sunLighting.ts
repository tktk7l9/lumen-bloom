// Maps the sun's sky position (+ optional cloud cover) to a continuous
// lighting recipe for the scene layer. Unlike a rise/set solver, this app
// wants a smooth day/twilight/night transition rather than a visible/hidden
// toggle — house3d.ts's `sun.visible = apparentAltitude > 0` would cause a
// visible pop at the horizon, which reads badly on an always-on wallpaper.

import type { SunPosition } from "../astro/solar";
import { sunDirection } from "../geometry/sunVector";

export interface SunLightingState {
  /** ENU unit vector — feeds directly into a Three.js DirectionalLight position. */
  directionEnu: readonly [number, number, number];
  /** Direct light intensity, 0 (no sun / heavy cloud) upward. */
  intensity: number;
  /** Correlated color temperature in kelvin (warm sunrise/sunset → neutral daylight). */
  colorTempK: number;
  /** Ambient fill level; never fully zero so the wallpaper doesn't go pitch black at night. */
  ambientLevel: number;
  /**
   * Image-based-environment (scene.environment) intensity. Without this the
   * IBL lights the scene at full constant strength around the clock and
   * midnight renders like noon — the DirectionalLight is only part of what
   * "daylight" means to a PBR material. Capped well below 1 even at noon:
   * the RoomEnvironment map is a bright white interior, and at full
   * strength it washes every material out toward pastel.
   */
  environmentLevel: number;
  /**
   * Pure day/twilight/night progress, 0 (deep night) .. 1 (full day) — for
   * quantities like the backdrop color whose daylight value already encodes
   * the weather and must not be dimmed a second time.
   */
  dayFactor: number;
}

// Night floors sit well above zero: a moonless night should read as a dim
// blue room you can still see into, not a black screen.
const NIGHT_AMBIENT = 0.2;
const TWILIGHT_AMBIENT = 0.3;
const DAY_AMBIENT = 0.38;
const NIGHT_ENVIRONMENT = 0.14;
const TWILIGHT_ENVIRONMENT = 0.22;
const DAY_ENVIRONMENT = 0.55;
const TWILIGHT_DAY_FACTOR = 0.3;
const PEAK_INTENSITY = 2.6;
const CLOUD_ATTENUATION = 0.85;
const WARM_K = 1900;
const GOLDEN_K = 4500;
const NEUTRAL_K = 5800;

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

/** Hermite smoothstep, 0 below edge0, 1 above edge1. */
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/**
 * Derive the sun rig's lighting recipe. `cloudCoverPct` (0-100) defaults to
 * clear sky until the weather client is wired in (Task 7/8).
 */
export function deriveSunLighting(
  sun: Pick<SunPosition, "azimuth" | "apparentAltitude">,
  cloudCoverPct = 0,
): SunLightingState {
  const alt = sun.apparentAltitude;
  const cloud = clamp01(cloudCoverPct / 100);

  // Ambient rises from a night floor, through civil twilight, to a daytime
  // plateau — always > 0 so night never renders pure black.
  const twilightMix = smoothstep(-6, 0, alt);
  const ambientBeforeDay = NIGHT_AMBIENT + (TWILIGHT_AMBIENT - NIGHT_AMBIENT) * twilightMix;
  const dayMix = smoothstep(0, 15, alt);
  const ambientLevel = ambientBeforeDay + (DAY_AMBIENT - ambientBeforeDay) * dayMix;

  // The IBL environment follows the same curve shape with a deeper night floor.
  const envBeforeDay = NIGHT_ENVIRONMENT + (TWILIGHT_ENVIRONMENT - NIGHT_ENVIRONMENT) * twilightMix;
  const environmentLevel = envBeforeDay + (DAY_ENVIRONMENT - envBeforeDay) * dayMix;

  const dayBase = TWILIGHT_DAY_FACTOR * twilightMix;
  const dayFactor = dayBase + (1 - dayBase) * dayMix;

  // Direct light only exists once the sun clears the horizon, clouds cut it
  // but never fully to zero (diffuse light still gets through an overcast sky).
  const directRamp = smoothstep(0, 20, alt);
  const intensity = PEAK_INTENSITY * directRamp * (1 - CLOUD_ATTENUATION * cloud);

  // Warm at the horizon, golden through the low sky, neutral daylight once high.
  const warmToGolden = smoothstep(-6, 8, alt);
  const goldenToNeutral = smoothstep(8, 40, alt);
  const colorTempK =
    WARM_K + (GOLDEN_K - WARM_K) * warmToGolden + (NEUTRAL_K - GOLDEN_K) * goldenToNeutral;

  return {
    directionEnu: sunDirection(sun.azimuth, alt),
    intensity,
    colorTempK,
    ambientLevel,
    environmentLevel,
    dayFactor,
  };
}
