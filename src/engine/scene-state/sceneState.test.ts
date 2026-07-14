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

  it("keeps the environment level unchanged under a clear sky", () => {
    const base = deriveSunLighting(SUN);
    const state = deriveSceneState(SUN, snapshot({ condition: "clear" }));
    expect(state.sun.environmentLevel).toBeCloseTo(base.environmentLevel, 9);
  });

  it("dims the environment under a storm, but less than the direct sun", () => {
    const base = deriveSunLighting(SUN);
    const state = deriveSceneState(SUN, snapshot({ condition: "storm" }));
    const envRatio = state.sun.environmentLevel / base.environmentLevel;
    const sunRatio = state.sun.intensity / base.intensity;
    expect(envRatio).toBeLessThan(1);
    expect(envRatio).toBeGreaterThan(sunRatio);
  });

  it("backdrop matches the mood's sky tint in full daylight", () => {
    // Altitude 40° → environmentLevel 1.0; clear sky keeps the multiplier at 1.
    const state = deriveSceneState(SUN, snapshot({ condition: "clear" }));
    expect(state.backdropHex).toBe(state.mood.skyTintHex);
  });

  it("backdrop fades to near-black at night", () => {
    const state = deriveSceneState(
      { azimuth: 0, apparentAltitude: -30 },
      snapshot({ condition: "clear" }),
    );
    // environmentLevel bottoms out at 0.06, so only a whisper of sky tint remains.
    expect(state.backdropHex).toBeLessThan(0x141821);
  });

  it("backdrop is darker under a midday storm than a midday clear sky", () => {
    const clear = deriveSceneState(SUN, snapshot({ condition: "clear" }));
    const storm = deriveSceneState(SUN, snapshot({ condition: "storm" }));
    expect(storm.backdropHex).toBeLessThan(clear.backdropHex);
  });

  it("moon defaults to absent (zero intensity) when not provided", () => {
    const state = deriveSceneState(SUN, snapshot({ condition: "clear" }));
    expect(state.moon.intensity).toBe(0);
  });

  it("moonlight shows at night and is muted by clouds like the sun", () => {
    const night = { azimuth: 0, apparentAltitude: -30 };
    const moon = { position: { azimuth: 180, apparentAltitude: 60 }, illumination: 1 };
    const clear = deriveSceneState(night, snapshot({ condition: "clear" }), moon);
    const storm = deriveSceneState(night, snapshot({ condition: "storm" }), moon);
    expect(clear.moon.intensity).toBeGreaterThan(0);
    expect(storm.moon.intensity).toBeCloseTo(clear.moon.intensity * 0.3, 9);
  });

  it("exposes the snapshot temperature, or null before weather arrives", () => {
    expect(deriveSceneState(SUN, snapshot({ temperatureC: -4 })).temperatureC).toBe(-4);
    expect(deriveSceneState(SUN, null).temperatureC).toBeNull();
  });

  it("returns the exact mood conditionToMood would produce for that snapshot", () => {
    const weather = snapshot({ condition: "rain", precipitationMm: 3 });
    const state = deriveSceneState(SUN, weather);
    expect(state.mood.particle).toBe("rain");
    expect(state.mood.particleIntensity).toBeCloseTo(0.6, 5);
  });
});
