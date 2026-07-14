import type { MoonPosition } from "../astro/lunar";
import type { SunPosition } from "../astro/solar";
import { conditionToMood, neutralMood } from "../weather/mapping";
import type { WeatherMood, WeatherSnapshot } from "../weather/types";
import { lerpHex } from "./colorMix";
import { deriveMoonLighting, type MoonLightingState } from "./moonLighting";
import { deriveSunLighting, type SunLightingState } from "./sunLighting";

export interface MoonInput {
  position: Pick<MoonPosition, "azimuth" | "apparentAltitude">;
  /** Illuminated fraction of the disk, 0–1. */
  illumination: number;
}

export interface SceneState {
  sun: SunLightingState;
  moon: MoonLightingState;
  mood: WeatherMood;
  /**
   * Backdrop/fog color: the mood's daylight sky tint faded toward near-black
   * as the sun sets — so the whole frame's brightness tracks the real
   * lighting at the viewer's location instead of floating in a fixed void.
   */
  backdropHex: number;
  /** Current temperature, for frost styling; null until weather arrives. */
  temperatureC: number | null;
}

const NIGHT_BACKDROP = 0x0b101c;
const MOON_ABSENT: MoonLightingState = { directionEnu: [0, 1, 0], intensity: 0 };

/**
 * Combines the sun's sky position with the current weather (and optionally
 * the moon) into one scene recipe. Weather-driven dimming is applied exactly
 * once, via the mood's `sunIntensityMultiplier` — `deriveSunLighting` is
 * called without a cloud percentage here (its own cloud-attenuation
 * parameter is a standalone, independently useful capability, but applying
 * both it and the mood multiplier would double-count the same cloud cover).
 */
export function deriveSceneState(
  sun: Pick<SunPosition, "azimuth" | "apparentAltitude">,
  weather: WeatherSnapshot | null,
  moon: MoonInput | null = null,
): SceneState {
  const mood = weather ? conditionToMood(weather) : neutralMood();
  const baseSun = deriveSunLighting(sun);
  // Overcast skies flatten the IBL too, but less than the direct sun — an
  // overcast day is dimmer, not dark.
  const environmentLevel = baseSun.environmentLevel * (0.55 + 0.45 * mood.sunIntensityMultiplier);

  const baseMoon = moon
    ? deriveMoonLighting(moon.position, moon.illumination, sun.apparentAltitude)
    : MOON_ABSENT;

  return {
    sun: {
      ...baseSun,
      intensity: baseSun.intensity * mood.sunIntensityMultiplier,
      environmentLevel,
    },
    // Clouds mute moonlight like they mute the sun.
    moon: { ...baseMoon, intensity: baseMoon.intensity * mood.sunIntensityMultiplier },
    mood,
    // dayFactor, not environmentLevel: the sky tint already encodes the
    // weather (storm's tint is dark), so dimming the mix by cloud cover too
    // would darken overcast skies twice.
    backdropHex: lerpHex(NIGHT_BACKDROP, mood.skyTintHex, baseSun.dayFactor),
    temperatureC: weather ? weather.temperatureC : null,
  };
}
