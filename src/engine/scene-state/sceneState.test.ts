import { neutralMood } from "../weather/mapping";
import type { WeatherSnapshot } from "../weather/types";
import { deriveSunLighting } from "./sunLighting";
import { deriveSceneState } from "./sceneState";

const SUN = { azimuth: 200, apparentAltitude: 40 };

function snapshot(overrides: Partial<WeatherSnapshot>): WeatherSnapshot {
  return {
    condition: "clear",
    cloudCoverPct: 0,
    precipitationMm: 0,
    temperatureC: 20,
    isDay: true,
    fetchedAt: 0,
    ...overrides,
  };
}

describe("deriveSceneState", () => {
  it("falls back to neutralMood when there is no weather yet", () => {
    const state = deriveSceneState(SUN, null);
    expect(state.mood).toEqual(neutralMood());
  });

  it("leaves sun intensity unchanged under a clear-sky mood (multiplier 1)", () => {
    const base = deriveSunLighting(SUN);
    const state = deriveSceneState(SUN, snapshot({ condition: "clear" }));
    expect(state.sun.intensity).toBeCloseTo(base.intensity, 9);
  });

  it("dims sun intensity under a storm mood", () => {
    const base = deriveSunLighting(SUN);
    const state = deriveSceneState(SUN, snapshot({ condition: "storm" }));
    expect(state.sun.intensity).toBeLessThan(base.intensity);
    expect(state.sun.intensity).toBeGreaterThan(0);
  });

  it("passes direction/ambient/colorTemp through unaffected by weather", () => {
    const base = deriveSunLighting(SUN);
    const state = deriveSceneState(SUN, snapshot({ condition: "storm" }));
    expect(state.sun.directionEnu).toEqual(base.directionEnu);
    expect(state.sun.ambientLevel).toBe(base.ambientLevel);
    expect(state.sun.colorTempK).toBe(base.colorTempK);
  });

  it("returns the exact mood conditionToMood would produce for that snapshot", () => {
    const weather = snapshot({ condition: "rain", precipitationMm: 3 });
    const state = deriveSceneState(SUN, weather);
    expect(state.mood.particle).toBe("rain");
    expect(state.mood.particleIntensity).toBeCloseTo(0.6, 5);
  });
});
