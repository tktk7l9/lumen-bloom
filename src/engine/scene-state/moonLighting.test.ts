import { sunDirection } from "../geometry/sunVector";
import { deriveMoonLighting } from "./moonLighting";

const HIGH_MOON = { azimuth: 180, apparentAltitude: 60 };

describe("deriveMoonLighting", () => {
  it("peaks for a high full moon in deep night", () => {
    const state = deriveMoonLighting(HIGH_MOON, 1, -30);
    expect(state.intensity).toBeCloseTo(0.5, 5);
  });

  it("is zero during the day even with a full moon up", () => {
    expect(deriveMoonLighting(HIGH_MOON, 1, 40).intensity).toBe(0);
  });

  it("is zero when the moon is below the horizon", () => {
    expect(deriveMoonLighting({ azimuth: 0, apparentAltitude: -10 }, 1, -30).intensity).toBe(0);
  });

  it("scales linearly with the illuminated fraction", () => {
    const full = deriveMoonLighting(HIGH_MOON, 1, -30).intensity;
    const half = deriveMoonLighting(HIGH_MOON, 0.5, -30).intensity;
    expect(half).toBeCloseTo(full / 2, 9);
  });

  it("clamps out-of-range illumination", () => {
    expect(deriveMoonLighting(HIGH_MOON, 1.5, -30).intensity).toBeCloseTo(0.5, 5);
    expect(deriveMoonLighting(HIGH_MOON, -0.5, -30).intensity).toBe(0);
  });

  it("fades in through twilight as the sun sets", () => {
    const dusk = deriveMoonLighting(HIGH_MOON, 1, -5).intensity;
    const night = deriveMoonLighting(HIGH_MOON, 1, -20).intensity;
    expect(dusk).toBeGreaterThan(0);
    expect(dusk).toBeLessThan(night);
  });

  it("uses the shared ENU direction convention", () => {
    const state = deriveMoonLighting({ azimuth: 123, apparentAltitude: 45 }, 1, -30);
    expect(state.directionEnu).toEqual(sunDirection(123, 45));
  });
});
