import { GOLDEN_ANGLE_RAD } from "./phyllotaxis";
import { spiralBloom } from "./spiralBloom";

const BASE = {
  petals: 22,
  seed: 5,
  tiltDeg: { outer: -8, inner: 72 },
  innerLength: 0.5,
  radius: { outer: 0.14, inner: 0.03 },
  innerLift: 0.16,
};

const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

describe("spiralBloom", () => {
  it("is deterministic for a given seed", () => {
    expect(spiralBloom(BASE)).toEqual(spiralBloom(BASE));
    expect(spiralBloom({ ...BASE, seed: 6 })).not.toEqual(spiralBloom(BASE));
  });

  it("returns the requested petals, clamped to at least one", () => {
    expect(spiralBloom(BASE)).toHaveLength(22);
    expect(spiralBloom({ ...BASE, petals: 0 })).toHaveLength(1);
    expect(spiralBloom({ ...BASE, petals: 1 })[0].depth).toBe(0);
  });

  it("runs from the outermost petal (depth 0) to the innermost (depth 1)", () => {
    const petals = spiralBloom(BASE);
    expect(petals[0].depth).toBe(0);
    expect(petals[petals.length - 1].depth).toBe(1);
  });

  it("turns each petal on by about the golden angle", () => {
    const petals = spiralBloom(BASE);
    for (let i = 1; i < petals.length; i++) {
      const step = petals[i].azimuthRad - petals[i - 1].azimuthRad;
      expect(Math.abs(step - GOLDEN_ANGLE_RAD)).toBeLessThanOrEqual(0.2);
    }
  });

  it("opens flat (or curled back) outside and stands up toward the center", () => {
    const petals = spiralBloom(BASE);
    expect(petals[0].tiltDeg).toBeLessThan(0);
    expect(petals[petals.length - 1].tiltDeg).toBeGreaterThan(65);
    const outer = petals.slice(0, 7).map((p) => p.tiltDeg);
    const inner = petals.slice(15).map((p) => p.tiltDeg);
    expect(Math.max(...outer)).toBeLessThan(Math.min(...inner));
  });

  it("shortens, draws in and lifts the petals toward the center", () => {
    const petals = spiralBloom(BASE);
    expect(mean(petals.slice(0, 7).map((p) => p.length))).toBeGreaterThan(
      mean(petals.slice(15).map((p) => p.length)),
    );
    for (let i = 1; i < petals.length; i++) {
      expect(petals[i].radius).toBeLessThan(petals[i - 1].radius);
      expect(petals[i].lift).toBeGreaterThan(petals[i - 1].lift);
    }
    expect(petals[0].radius).toBeCloseTo(0.14, 9);
    expect(petals[petals.length - 1].lift).toBeCloseTo(0.16, 9);
    for (const p of petals) {
      expect(p.length).toBeGreaterThan(0.4);
      expect(p.length).toBeLessThan(1.07);
    }
  });

  it("produces only finite numbers", () => {
    for (const p of spiralBloom({ ...BASE, petals: 40, seed: 1 })) {
      for (const v of Object.values(p)) expect(Number.isFinite(v)).toBe(true);
    }
  });
});
