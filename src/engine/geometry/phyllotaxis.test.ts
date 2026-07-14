import { phyllotaxis } from "./phyllotaxis";

describe("phyllotaxis", () => {
  it("returns exactly count points", () => {
    expect(phyllotaxis(150, 1)).toHaveLength(150);
    expect(phyllotaxis(1, 1)).toHaveLength(1);
    expect(phyllotaxis(0, 1)).toHaveLength(0);
  });

  it("keeps every point within the disc radius", () => {
    for (const [x, z] of phyllotaxis(200, 0.03)) {
      expect(Math.hypot(x, z)).toBeLessThanOrEqual(0.03 + 1e-12);
    }
  });

  it("starts near the center and ends near the rim", () => {
    const pts = phyllotaxis(100, 1);
    expect(Math.hypot(...pts[0])).toBeLessThan(0.1);
    expect(Math.hypot(...pts[99])).toBeGreaterThan(0.95);
  });

  it("is deterministic", () => {
    expect(phyllotaxis(50, 0.5)).toEqual(phyllotaxis(50, 0.5));
  });

  it("spreads points apart (no two coincide)", () => {
    const pts = phyllotaxis(80, 1);
    for (let i = 1; i < pts.length; i++) {
      const [ax, az] = pts[i - 1];
      const [bx, bz] = pts[i];
      expect(Math.hypot(ax - bx, az - bz)).toBeGreaterThan(1e-3);
    }
  });
});
