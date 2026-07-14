export type WeatherCondition = "clear" | "cloudy" | "fog" | "rain" | "snow" | "storm";

export interface WeatherSnapshot {
  condition: WeatherCondition;
  cloudCoverPct: number;
  /** Current-hour precipitation, mm — used to scale particle density. */
  precipitationMm: number;
  temperatureC: number;
  isDay: boolean;
  /** epoch ms this snapshot was fetched, for staleness checks. */
  fetchedAt: number;
}

export type WeatherFetchResult =
  | { ok: true; snapshot: WeatherSnapshot }
  | { ok: false; error: "network" | "http" | "parse" };

export interface WeatherMood {
  /** Ambient/fog tint, as a plain hex number (scene layer converts to THREE.Color). */
  ambientTintHex: number;
  fogDensityMultiplier: number;
  sunIntensityMultiplier: number;
  particle: "none" | "rain" | "snow";
  /** 0..1, derived from precipitation. */
  particleIntensity: number;
}
