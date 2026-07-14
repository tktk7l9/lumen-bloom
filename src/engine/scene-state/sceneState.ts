import type { SunPosition } from "../astro/solar";
import { conditionToMood, neutralMood } from "../weather/mapping";
import type { WeatherMood, WeatherSnapshot } from "../weather/types";
import { lerpHex } from "./colorMix";
import { deriveSunLighting, type SunLightingState } from "./sunLighting";

export interface SceneState {
  sun: SunLightingState;
  mood: WeatherMood;
  /**
   * Backdrop/fog color: the mood's daylight sky tint faded toward near-black
   * as the sun sets — so the whole frame's brightness tracks the real
   * lighting at the viewer's location instead of floating in a fixed void.
   */
  backdropHex: number;
}

const NIGHT_BACKDROP = 0x03040a;

/**
 * Combines the sun's sky position with the current weather into one scene
 * recipe. Weather-driven dimming is applied exactly once, via the mood's
 * `sunIntensityMultiplier` — `deriveSunLighting` is called without a cloud
 * percentage here (its own cloud-attenuation parameter is a standalone,
 * independently useful capability, but applying both it and the mood
 * multiplier would double-count the same cloud cover).
 */
export function deriveSceneState(
  sun: Pick<SunPosition, "azimuth" | "apparentAltitude">,
  weather: WeatherSnapshot | null,
): SceneState {
  const mood = weather ? conditionToMood(weather) : neutralMood();
  const baseSun = deriveSunLighting(sun);
  // Overcast skies flatten the IBL too, but less than the direct sun — an
  // overcast day is dimmer, not dark.
  const environmentLevel = baseSun.environmentLevel * (0.55 + 0.45 * mood.sunIntensityMultiplier);
  return {
    sun: {
      ...baseSun,
      intensity: baseSun.intensity * mood.sunIntensityMultiplier,
      environmentLevel,
    },
    mood,
    // dayFactor, not environmentLevel: the sky tint already encodes the
    // weather (storm's tint is dark), so dimming the mix by cloud cover too
    // would darken overcast skies twice.
    backdropHex: lerpHex(NIGHT_BACKDROP, mood.skyTintHex, baseSun.dayFactor),
  };
}
