import { sunDirection } from "./sunVector";

describe("sunDirection", () => {
  it("points due south and lifted by altitude at az=180, alt=45", () => {
    const d = sunDirection(180, 45);
    expect(d[0]).toBeCloseTo(0, 9);
    expect(d[1]).toBeCloseTo(Math.SQRT1_2, 9);
    expect(d[2]).toBeCloseTo(Math.SQRT1_2, 9);
  });

  it("points due east at the horizon (az=90, alt=0)", () => {
    const d = sunDirection(90, 0);
    expect(d[0]).toBeCloseTo(1, 9);
    expect(d[1]).toBeCloseTo(0, 9);
    expect(d[2]).toBeCloseTo(0, 9);
  });

  it("points due north at the horizon (az=0, alt=0)", () => {
    const d = sunDirection(0, 0);
    expect(d[0]).toBeCloseTo(0, 9);
    expect(d[1]).toBeCloseTo(0, 9);
    expect(d[2]).toBeCloseTo(-1, 9);
  });

  it("points straight up at the zenith regardless of azimuth", () => {
    const d = sunDirection(37, 90);
    expect(d[0]).toBeCloseTo(0, 9);
    expect(d[1]).toBeCloseTo(1, 9);
    expect(d[2]).toBeCloseTo(0, 9);
  });
});
