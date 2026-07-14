import type { SunPosition } from "../astro/solar";
import { conditionToMood, neutralMood } from "../weather/mapping";
import type { WeatherMood, WeatherSnapshot } from "../weather/types";
import { deriveSunLighting, type SunLightingState } from "./sunLighting";

export interface SceneState {
  sun: SunLightingState;
  mood: WeatherMood;
}

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
  return {
    sun: { ...baseSun, intensity: baseSun.intensity * mood.sunIntensityMultiplier },
    mood,
  };
}
