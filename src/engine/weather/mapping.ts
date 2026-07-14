// WMO weather-code interpretation → coarse condition bucket, and
// condition → scene mood mapping. See https://open-meteo.com/en/docs
// ("WMO Weather interpretation codes") for the code table.

import type { WeatherCondition, WeatherMood, WeatherSnapshot } from "./types";

export function wmoToCondition(code: number): WeatherCondition {
  if (code === 0) return "clear";
  if (code >= 1 && code <= 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return "snow";
  if (code >= 95) return "storm";
  return "cloudy"; // unassigned WMO code — a neutral, plausible fallback
}

type MoodBase = Omit<WeatherMood, "particleIntensity">;

// Overcast conditions keep a blue cast and a healthy sun multiplier on
// purpose: cloudy is the single most common state the wallpaper will sit
// in, and a fully desaturated grey preset made the whole scene look drab
// the moment the first real weather fetch replaced the clear-sky default.
const MOODS: Record<WeatherCondition, MoodBase> = {
  clear: { ambientTintHex: 0x223047, skyTintHex: 0x8fa3c0, fogDensityMultiplier: 0.7, sunIntensityMultiplier: 1.0, particle: "none" },
  cloudy: { ambientTintHex: 0x334059, skyTintHex: 0x8494ab, fogDensityMultiplier: 1.15, sunIntensityMultiplier: 0.72, particle: "none" },
  fog: { ambientTintHex: 0x3a4351, skyTintHex: 0x9099a4, fogDensityMultiplier: 2.2, sunIntensityMultiplier: 0.5, particle: "none" },
  rain: { ambientTintHex: 0x243040, skyTintHex: 0x5d6a7a, fogDensityMultiplier: 1.5, sunIntensityMultiplier: 0.5, particle: "rain" },
  snow: { ambientTintHex: 0x414a5a, skyTintHex: 0x949ba7, fogDensityMultiplier: 1.35, sunIntensityMultiplier: 0.55, particle: "snow" },
  storm: { ambientTintHex: 0x1a2029, skyTintHex: 0x3d4552, fogDensityMultiplier: 1.9, sunIntensityMultiplier: 0.3, particle: "rain" },
};

const PRECIPITATION_FOR_FULL_INTENSITY_MM = 5;

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

/** Weather snapshot → scene mood. Particle intensity ramps up to 5mm/h precipitation. */
export function conditionToMood(snapshot: WeatherSnapshot): WeatherMood {
  const base = MOODS[snapshot.condition];
  const particleIntensity =
    base.particle === "none" ? 0 : clamp01(snapshot.precipitationMm / PRECIPITATION_FOR_FULL_INTENSITY_MM);
  return { ...base, particleIntensity };
}

/** Used when the weather API has never once succeeded — no particles, clear-sky tone. */
export function neutralMood(): WeatherMood {
  return { ...MOODS.clear, particleIntensity: 0 };
}
