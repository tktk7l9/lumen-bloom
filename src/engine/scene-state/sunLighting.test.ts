import { sunDirection } from "../geometry/sunVector";
import { deriveSunLighting } from "./sunLighting";

describe("deriveSunLighting", () => {
  it("is dark, warm, and dim-but-not-zero well below the horizon", () => {
    const state = deriveSunLighting({ azimuth: 180, apparentAltitude: -20 });
    expect(state.intensity).toBe(0);
    expect(state.ambientLevel).toBeCloseTo(0.2, 5);
    expect(state.environmentLevel).toBeCloseTo(0.14, 5);
    expect(state.dayFactor).toBe(0);
    expect(state.colorTempK).toBeCloseTo(1900, 5);
  });

  it("reaches the daytime plateau at a high midday altitude", () => {
    const state = deriveSunLighting({ azimuth: 180, apparentAltitude: 60 });
    expect(state.intensity).toBeCloseTo(2.6, 5);
    expect(state.ambientLevel).toBeCloseTo(0.38, 5);
    expect(state.environmentLevel).toBeCloseTo(0.55, 5);
    expect(state.dayFactor).toBe(1);
    expect(state.colorTempK).toBeCloseTo(5800, 5);
  });

  it("gives twilight a partial dayFactor for a dawn-tinted backdrop", () => {
    const state = deriveSunLighting({ azimuth: 90, apparentAltitude: 0 });
    expect(state.dayFactor).toBeCloseTo(0.3, 5);
  });

  it("never lets direct light through below the horizon", () => {
    expect(deriveSunLighting({ azimuth: 0, apparentAltitude: -0.01 }).intensity).toBe(0);
    expect(deriveSunLighting({ azimuth: 0, apparentAltitude: 0 }).intensity).toBe(0);
  });

  it("cloud cover attenuates intensity but never fully to zero", () => {
    const clear = deriveSunLighting({ azimuth: 90, apparentAltitude: 45 }, 0);
    const overcast = deriveSunLighting({ azimuth: 90, apparentAltitude: 45 }, 100);
    expect(overcast.intensity).toBeLessThan(clear.intensity);
    expect(overcast.intensity).toBeGreaterThan(0);
  });

  it("defaults to clear sky when cloud cover is omitted", () => {
    const explicit = deriveSunLighting({ azimuth: 90, apparentAltitude: 45 }, 0);
    const defaulted = deriveSunLighting({ azimuth: 90, apparentAltitude: 45 });
    expect(defaulted).toEqual(explicit);
  });

  it("intensity, ambient, environment, and color temperature all rise monotonically with altitude", () => {
    const altitudes = [-90, -30, -10, -6, -3, 0, 3, 8, 15, 20, 40, 60, 90];
    const states = altitudes.map((alt) => deriveSunLighting({ azimuth: 0, apparentAltitude: alt }));
    for (let i = 1; i < states.length; i++) {
      expect(states[i].intensity).toBeGreaterThanOrEqual(states[i - 1].intensity);
      expect(states[i].ambientLevel).toBeGreaterThanOrEqual(states[i - 1].ambientLevel);
      expect(states[i].environmentLevel).toBeGreaterThanOrEqual(states[i - 1].environmentLevel);
      expect(states[i].dayFactor).toBeGreaterThanOrEqual(states[i - 1].dayFactor);
      expect(states[i].colorTempK).toBeGreaterThanOrEqual(states[i - 1].colorTempK);
    }
  });

  it("directionEnu matches sunDirection(azimuth, apparentAltitude) exactly", () => {
    const sun = { azimuth: 123.4, apparentAltitude: 33.3 };
    const state = deriveSunLighting(sun);
    expect(state.directionEnu).toEqual(sunDirection(sun.azimuth, sun.apparentAltitude));
  });
});
