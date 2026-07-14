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

const MOODS: Record<WeatherCondition, MoodBase> = {
  clear: { ambientTintHex: 0x223047, skyTintHex: 0x8fa3c0, fogDensityMultiplier: 0.7, sunIntensityMultiplier: 1.0, particle: "none" },
  cloudy: { ambientTintHex: 0x2c3442, skyTintHex: 0x79828e, fogDensityMultiplier: 1.3, sunIntensityMultiplier: 0.55, particle: "none" },
  fog: { ambientTintHex: 0x333c48, skyTintHex: 0x868d96, fogDensityMultiplier: 2.4, sunIntensityMultiplier: 0.35, particle: "none" },
  rain: { ambientTintHex: 0x1c2430, skyTintHex: 0x525c68, fogDensityMultiplier: 1.6, sunIntensityMultiplier: 0.4, particle: "rain" },
  snow: { ambientTintHex: 0x3a4250, skyTintHex: 0x8b929c, fogDensityMultiplier: 1.4, sunIntensityMultiplier: 0.5, particle: "snow" },
  storm: { ambientTintHex: 0x161a22, skyTintHex: 0x3a414c, fogDensityMultiplier: 2.0, sunIntensityMultiplier: 0.25, particle: "rain" },
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
