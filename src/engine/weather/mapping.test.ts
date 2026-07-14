import { conditionToMood, neutralMood, wmoToCondition } from "./mapping";
import type { WeatherSnapshot } from "./types";

describe("wmoToCondition", () => {
  const table: Array<[number, ReturnType<typeof wmoToCondition>]> = [
    [0, "clear"],
    [1, "cloudy"],
    [2, "cloudy"],
    [3, "cloudy"],
    [45, "fog"],
    [48, "fog"],
    [51, "rain"],
    [55, "rain"],
    [61, "rain"],
    [67, "rain"],
    [80, "rain"],
    [82, "rain"],
    [71, "snow"],
    [75, "snow"],
    [77, "snow"],
    [85, "snow"],
    [86, "snow"],
    [95, "storm"],
    [99, "storm"],
    [4, "cloudy"], // unassigned code — falls back
    [49, "cloudy"],
    [68, "cloudy"],
    [200, "storm"], // way out of range but >=95, treated as storm
  ];

  it.each(table)("maps WMO code %i to %s", (code, expected) => {
    expect(wmoToCondition(code)).toBe(expected);
  });
});

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

describe("conditionToMood", () => {
  it("gives clear sky no particles regardless of stray precipitation", () => {
    const mood = conditionToMood(snapshot({ condition: "clear", precipitationMm: 2 }));
    expect(mood.particle).toBe("none");
    expect(mood.particleIntensity).toBe(0);
  });

  it("scales rain particle intensity with precipitation, clamped to 1", () => {
    expect(conditionToMood(snapshot({ condition: "rain", precipitationMm: 0 })).particleIntensity).toBe(0);
    expect(conditionToMood(snapshot({ condition: "rain", precipitationMm: 2.5 })).particleIntensity).toBeCloseTo(0.5, 5);
    expect(conditionToMood(snapshot({ condition: "rain", precipitationMm: 5 })).particleIntensity).toBe(1);
    expect(conditionToMood(snapshot({ condition: "rain", precipitationMm: 50 })).particleIntensity).toBe(1);
  });

  it("gives snow its own particle type", () => {
    expect(conditionToMood(snapshot({ condition: "snow", precipitationMm: 3 })).particle).toBe("snow");
  });

  it("dims the sun most under storm and least under clear sky", () => {
    const storm = conditionToMood(snapshot({ condition: "storm" }));
    const clear = conditionToMood(snapshot({ condition: "clear" }));
    expect(storm.sunIntensityMultiplier).toBeLessThan(clear.sunIntensityMultiplier);
  });

  it("gives every condition a sky tint, brightest for clear and darkest for storm", () => {
    const conditions = ["clear", "cloudy", "fog", "rain", "snow", "storm"] as const;
    const tints = conditions.map((c) => conditionToMood(snapshot({ condition: c })).skyTintHex);
    for (const tint of tints) {
      expect(tint).toBeGreaterThan(0);
      expect(tint).toBeLessThanOrEqual(0xffffff);
    }
    const clear = tints[0];
    const storm = tints[5];
    expect(storm).toBeLessThan(clear);
  });
});

describe("neutralMood", () => {
  it("has no particles and matches the clear-sky tone", () => {
    const mood = neutralMood();
    expect(mood.particle).toBe("none");
    expect(mood.particleIntensity).toBe(0);
    expect(mood).toEqual(conditionToMood(snapshot({ condition: "clear" })));
  });
});
