import { moonEphemeris, moonPosition } from "./lunar";
import { TOKYO } from "./__fixtures__/ephemeris";

describe("lunar ephemeris", () => {
  it("Meeus example 47.a: moon at 1992-04-12.0 TD", () => {
    const eph = moonEphemeris(2_448_724.5);
    expect(eph.lambda).toBeCloseTo(133.162655, 1);
    expect(Math.abs(eph.lambda - 133.162655)).toBeLessThan(0.02);
    expect(Math.abs(eph.beta - -3.229126)).toBeLessThan(0.02);
    expect(Math.abs(eph.distanceKm - 368_409.7)).toBeLessThan(50);
    expect(eph.parallax).toBeCloseTo(0.99199, 3);
  });

  it("distance stays within the lunar orbit's physical range", () => {
    for (let m = 0; m < 12; m++) {
      const eph = moonEphemeris(2_461_041.5 + m * 29.53);
      expect(eph.distanceKm).toBeGreaterThan(354_000);
      expect(eph.distanceKm).toBeLessThan(407_000);
    }
  });

  it("topocentric altitude sits below the geocentric one by ~parallax", () => {
    const pos = moonPosition(new Date("2026-06-21T08:15:00Z"), TOKYO);
    expect(pos.altitude).toBeLessThan(pos.geocentricAltitude);
    expect(pos.geocentricAltitude - pos.altitude).toBeLessThan(1.05);
    expect(pos.apparentAltitude).toBeGreaterThanOrEqual(pos.altitude);
  });

  it("azimuth stays within compass range across a full day", () => {
    for (let h = 0; h < 24; h++) {
      const pos = moonPosition(new Date(Date.UTC(2026, 6, 14, h)), TOKYO);
      expect(pos.azimuth).toBeGreaterThanOrEqual(0);
      expect(pos.azimuth).toBeLessThan(360);
    }
  });
});
