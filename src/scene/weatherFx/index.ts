import * as THREE from "three";
import type { WeatherMood } from "../../engine/weather/types";
import { createRainSystem } from "./rain";
import { createSnowSystem } from "./snow";

export interface WeatherEffects {
  group: THREE.Group;
  update(mood: WeatherMood, dtSec: number): void;
  dispose(): void;
}

/** Owns both particle systems; only the one matching the current mood is visible. */
export function createWeatherEffects(reducedMotion: boolean): WeatherEffects {
  const group = new THREE.Group();
  const rain = createRainSystem(reducedMotion);
  const snow = createSnowSystem(reducedMotion);
  group.add(rain.points, snow.points);

  return {
    group,
    update(mood: WeatherMood, dtSec: number): void {
      rain.setIntensity(mood.particle === "rain" ? mood.particleIntensity : 0);
      snow.setIntensity(mood.particle === "snow" ? mood.particleIntensity : 0);
      rain.update(dtSec);
      snow.update(dtSec);
    },
    dispose(): void {
      rain.dispose();
      snow.dispose();
    },
  };
}
