import { GOLDEN_ANGLE_RAD } from "./phyllotaxis";
import { racemeLayout } from "./raceme";

const BASE = { count: 40, seed: 7, budFraction: 0.2 };

describe("racemeLayout", () => {
  it("is deterministic for a given seed", () => {
    expect(racemeLayout(BASE)).toEqual(racemeLayout(BASE));
    expect(racemeLayout({ ...BASE, seed: 8 })).not.toEqual(racemeLayout(BASE));
  });

  it("returns count florets, clamped to at least one", () => {
    expect(racemeLayout(BASE)).toHaveLength(40);
    expect(racemeLayout({ ...BASE, count: 0 })).toHaveLength(1);
    expect(racemeLayout({ ...BASE, count: 12.9 })).toHaveLength(12);
  });

  it("climbs the raceme strictly upward from 0 to 1", () => {
    const florets = racemeLayout(BASE);
    for (let i = 1; i < florets.length; i++) {
      expect(florets[i].along).toBeGreaterThan(florets[i - 1].along);
    }
    for (const f of florets) {
      expect(f.along).toBeGreaterThanOrEqual(0);
      expect(f.along).toBeLessThanOrEqual(1);
    }
    expect(florets[0].along).toBeLessThan(0.02);
    expect(florets[florets.length - 1].along).toBeGreaterThan(0.98);
  });

  it("spirals around the rachis at the golden angle", () => {
    const florets = racemeLayout(BASE);
    for (let i = 1; i < florets.length; i++) {
      const step = florets[i].azimuthRad - florets[i - 1].azimuthRad;
      expect(Math.abs(step - GOLDEN_ANGLE_RAD)).toBeLessThanOrEqual(0.35);
    }
  });

  it("is fully open below the bud zone and closed at the tip", () => {
    const florets = racemeLayout(BASE);
    for (const f of florets.filter((f) => f.along <= 0.8)) expect(f.openness).toBe(1);
    expect(florets[florets.length - 1].openness).toBeLessThan(0.05);
    // Openness only falls toward the tip.
    for (let i = 1; i < florets.length; i++) {
      expect(florets[i].openness).toBeLessThanOrEqual(florets[i - 1].openness);
    }
  });

  it("opens every floret when there is no bud zone", () => {
    for (const f of racemeLayout({ ...BASE, budFraction: 0 })) expect(f.openness).toBe(1);
  });

  it("nods the low florets down and points the top ones up", () => {
    const florets = racemeLayout(BASE);
    expect(florets[0].droopRad).toBeGreaterThan(0.2);
    expect(florets[florets.length - 1].droopRad).toBeLessThan(-0.4);
  });

  it("grows smaller toward the tip, staying within sane sizes", () => {
    const florets = racemeLayout(BASE);
    for (const f of florets) {
      expect(f.scale).toBeGreaterThan(0.6);
      expect(f.scale).toBeLessThanOrEqual(1.08);
    }
    const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
    const lower = florets.slice(0, 20).map((f) => f.scale);
    const upper = florets.slice(20).map((f) => f.scale);
    expect(mean(lower)).toBeGreaterThan(mean(upper));
  });

  it("withers from the bottom up", () => {
    const florets = racemeLayout(BASE);
    for (const f of florets) {
      expect(f.shedAt).toBeGreaterThanOrEqual(0.02);
      expect(f.shedAt).toBeLessThanOrEqual(0.98);
    }
    expect(florets[0].shedAt).toBeLessThan(florets[florets.length - 1].shedAt);
    const firstQuarter = florets.slice(0, 10).map((f) => f.shedAt);
    const lastQuarter = florets.slice(30).map((f) => f.shedAt);
    expect(Math.max(...firstQuarter)).toBeLessThan(Math.min(...lastQuarter));
  });

  it("produces only finite numbers", () => {
    for (const f of racemeLayout({ ...BASE, count: 1, budFraction: 1 })) {
      for (const v of Object.values(f)) expect(Number.isFinite(v)).toBe(true);
    }
  });
});
