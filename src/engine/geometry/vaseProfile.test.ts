import { DEFAULT_VASE_PROFILE, vaseProfile } from "./vaseProfile";

describe("vaseProfile", () => {
  it("starts at the base radius on the ground and ends at the rim height", () => {
    const points = vaseProfile();
    const [firstR, firstY] = points[0];
    const [, lastY] = points[points.length - 1];
    expect(firstY).toBe(0);
    expect(firstR).toBeCloseTo(DEFAULT_VASE_PROFILE.baseRadiusM, 9);
    expect(lastY).toBeCloseTo(DEFAULT_VASE_PROFILE.heightM, 9);
  });

  it("returns segments+1 points", () => {
    expect(vaseProfile({ segments: 10 })).toHaveLength(11);
    expect(vaseProfile({ segments: 40 })).toHaveLength(41);
  });

  it("clamps segments to a sane minimum", () => {
    expect(vaseProfile({ segments: 1 })).toHaveLength(5);
  });

  it("keeps every radius strictly positive so the lathe never degenerates", () => {
    for (const [r] of vaseProfile({ segments: 60 })) {
      expect(r).toBeGreaterThan(0);
    }
  });

  it("y increases monotonically from base to rim", () => {
    const points = vaseProfile({ segments: 30 });
    for (let i = 1; i < points.length; i++) {
      expect(points[i][1]).toBeGreaterThan(points[i - 1][1]);
    }
  });

  it("a larger bellyRadiusM increases the sampled maximum radius", () => {
    const maxOf = (pts: readonly (readonly [number, number])[]): number =>
      Math.max(...pts.map(([r]) => r));
    const narrow = vaseProfile({ bellyRadiusM: 0.07 });
    const wide = vaseProfile({ bellyRadiusM: 0.15 });
    expect(maxOf(wide)).toBeGreaterThan(maxOf(narrow));
  });

  it("merges partial options with defaults", () => {
    const points = vaseProfile({ heightM: 0.5 });
    expect(points[points.length - 1][1]).toBeCloseTo(0.5, 9);
    expect(points[0][0]).toBeCloseTo(DEFAULT_VASE_PROFILE.baseRadiusM, 9);
  });
});
