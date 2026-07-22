import { DEFAULT_BOUQUET, layoutBouquet } from "./flowerLayout";

describe("layoutBouquet", () => {
  it("is deterministic for a given seed", () => {
    expect(layoutBouquet({ seed: 5 })).toEqual(layoutBouquet({ seed: 5 }));
  });

  it("produces a different layout for a different seed", () => {
    expect(layoutBouquet({ seed: 1 })).not.toEqual(layoutBouquet({ seed: 2 }));
  });

  it("honors stemCount and clamps it to at least one", () => {
    expect(layoutBouquet({ stemCount: 4 })).toHaveLength(4);
    expect(layoutBouquet({ stemCount: 0 })).toHaveLength(1);
  });

  it("rests every foot against the base interior on the FAR side of the lean", () => {
    for (const stem of layoutBouquet({ stemCount: 6, seed: 9 })) {
      const [fx, fy, fz] = stem.controlPoints[0];
      const [rx, , rz] = stem.controlPoints[1];
      // Foot and rim contact sit on opposite sides of the vase axis…
      expect(fx * rx + fz * rz).toBeLessThan(0);
      // …and the foot stays inside the base.
      expect(Math.hypot(fx, fz)).toBeLessThanOrEqual(DEFAULT_BOUQUET.vaseBaseRadiusM);
      expect(fy).toBe(DEFAULT_BOUQUET.vaseBottomYM);
    }
  });

  it("pivots on the rim edge: contact point at rim height near the neck radius", () => {
    for (const stem of layoutBouquet({ stemCount: 6, seed: 3 })) {
      const [rx, ry, rz] = stem.controlPoints[1];
      expect(ry).toBeCloseTo(DEFAULT_BOUQUET.vaseRimYM - 0.006, 9);
      const r = Math.hypot(rx, rz);
      expect(r).toBeGreaterThan(DEFAULT_BOUQUET.vaseNeckRadiusM * 0.8);
      expect(r).toBeLessThanOrEqual(DEFAULT_BOUQUET.vaseNeckRadiusM * 0.93);
    }
  });

  it("leans outward above the rim: the tip sits farther from the axis than the rim contact", () => {
    for (const stem of layoutBouquet({ stemCount: 6, seed: 7 })) {
      const [rx, , rz] = stem.controlPoints[1];
      const tip = stem.controlPoints[stem.controlPoints.length - 1];
      expect(Math.hypot(tip[0], tip[2])).toBeGreaterThan(Math.hypot(rx, rz));
    }
  });

  it("droops progressively: each free segment is less vertical than the last", () => {
    for (const stem of layoutBouquet({ stemCount: 6, seed: 11 })) {
      const [, rim, p1, p2, tip] = stem.controlPoints;
      const rise = (a: readonly number[], b: readonly number[]): number => {
        const dy = b[1] - a[1];
        const dh = Math.hypot(b[0] - a[0], b[2] - a[2]);
        return dy / dh; // higher = more vertical
      };
      expect(rise(rim, p1)).toBeGreaterThan(rise(p1, p2));
      expect(rise(p1, p2)).toBeGreaterThan(rise(p2, tip));
    }
  });

  it("keeps every head above the rim at a plausible height", () => {
    const rimY = DEFAULT_BOUQUET.vaseRimYM;
    for (const stem of layoutBouquet({ seed: 9 })) {
      const [, headY] = stem.headPosition;
      expect(headY).toBeGreaterThan(rimY + 0.01);
      expect(headY).toBeLessThan(rimY + 0.3);
    }
  });

  it("varies stem length enough that some heads hug the rim and some ride high", () => {
    const heights = layoutBouquet({ stemCount: 8, seed: 5 }).map(
      (s) => s.headPosition[1] - DEFAULT_BOUQUET.vaseRimYM,
    );
    expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(0.05);
  });

  it("returns unit-length head directions pointing outward along the lean", () => {
    for (const stem of layoutBouquet({ stemCount: 6, seed: 3 })) {
      const [dx, dy, dz] = stem.headDirection;
      expect(Math.hypot(dx, dy, dz)).toBeCloseTo(1, 9);
      expect(dy).toBeGreaterThan(Math.sin((-25 * Math.PI) / 180) - 1e-9);
      expect(dy).toBeLessThan(Math.sin((5 * Math.PI) / 180) + 1e-9);
      const [rx, , rz] = stem.controlPoints[1];
      expect(dx * rx + dz * rz).toBeGreaterThan(0);
    }
  });

  it("keeps petal count in the sunflower ray range (21-28)", () => {
    for (const seed of [1, 2, 3, 4]) {
      for (const stem of layoutBouquet({ stemCount: 5, seed })) {
        expect(stem.petalCount).toBeGreaterThanOrEqual(21);
        expect(stem.petalCount).toBeLessThanOrEqual(28);
      }
    }
  });

  it("keeps head radius in a plausible cut-flower range", () => {
    for (const stem of layoutBouquet({ stemCount: 6, seed: 7 })) {
      expect(stem.headRadiusM).toBeGreaterThanOrEqual(0.044);
      expect(stem.headRadiusM).toBeLessThanOrEqual(0.09);
    }
  });

  it("gives each stem one or two leaves on the above-rim stretch of the curve", () => {
    const counts = new Set<number>();
    for (const seed of [1, 2, 3, 4, 5]) {
      for (const stem of layoutBouquet({ stemCount: 4, seed })) {
        counts.add(stem.leaves.length);
        for (const leaf of stem.leaves) {
          // The rim sits at 0.5-0.8 of the curve depending on stem length;
          // leaves always land past it and before the head.
          expect(leaf.t).toBeGreaterThan(0.5);
          expect(leaf.t).toBeLessThan(1);
          expect(leaf.lengthM).toBeGreaterThan(0.06);
          expect(leaf.lengthM).toBeLessThan(0.11);
        }
      }
    }
    // Across several seeds both branch outcomes (1 leaf and 2 leaves) occur.
    expect(counts).toEqual(new Set([1, 2]));
  });

  it("colorSeed stays within [0, 1)", () => {
    for (const stem of layoutBouquet({ stemCount: 8, seed: 11 })) {
      expect(stem.colorSeed).toBeGreaterThanOrEqual(0);
      expect(stem.colorSeed).toBeLessThan(1);
    }
  });

  it("a slimmer vessel yields more upright in-vase lean angles", () => {
    const leanOf = (neck: number, base: number): number => {
      const stem = layoutBouquet({ seed: 4, stemCount: 1, vaseNeckRadiusM: neck, vaseBaseRadiusM: base })[0];
      const [fx, fy, fz] = stem.controlPoints[0];
      const [rx, ry, rz] = stem.controlPoints[1];
      return Math.atan2(Math.hypot(rx - fx, rz - fz), ry - fy);
    };
    expect(leanOf(0.03, 0.035)).toBeLessThan(leanOf(0.06, 0.07));
  });

  it("merges partial options with the defaults", () => {
    expect(layoutBouquet({ seed: 4 })).toHaveLength(DEFAULT_BOUQUET.stemCount);
  });
});
