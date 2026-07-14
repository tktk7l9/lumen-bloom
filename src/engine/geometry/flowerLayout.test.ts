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

  it("puts every head above the vase rim by a plausible amount", () => {
    const rimY = DEFAULT_BOUQUET.vaseRimYM;
    for (const stem of layoutBouquet({ seed: 9 })) {
      const [, headY] = stem.headPosition;
      expect(headY).toBeGreaterThan(rimY + 0.08);
      expect(headY).toBeLessThan(rimY + 0.3);
    }
  });

  it("returns unit-length head directions pointing outward from the stem's azimuth", () => {
    for (const stem of layoutBouquet({ stemCount: 6, seed: 3 })) {
      const [dx, dy, dz] = stem.headDirection;
      expect(Math.hypot(dx, dy, dz)).toBeCloseTo(1, 9);
      // Nod range: −22°..+8° of elevation.
      expect(dy).toBeGreaterThan(Math.sin((-22 * Math.PI) / 180) - 1e-9);
      expect(dy).toBeLessThan(Math.sin((8 * Math.PI) / 180) + 1e-9);
      // Horizontal component matches the stem's outward azimuth.
      const [sx, , sz] = stem.controlPoints[0];
      const dot = dx * sx + dz * sz;
      expect(dot).toBeGreaterThan(0);
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

  it("keeps head radius in a plausible cut-sunflower range", () => {
    for (const stem of layoutBouquet({ stemCount: 6, seed: 7 })) {
      expect(stem.headRadiusM).toBeGreaterThanOrEqual(0.055);
      expect(stem.headRadiusM).toBeLessThanOrEqual(0.073);
    }
  });

  it("gives each stem one or two leaves along the middle of the stem", () => {
    const counts = new Set<number>();
    for (const seed of [1, 2, 3, 4, 5]) {
      for (const stem of layoutBouquet({ stemCount: 4, seed })) {
        counts.add(stem.leaves.length);
        for (const leaf of stem.leaves) {
          expect(leaf.t).toBeGreaterThan(0.3);
          expect(leaf.t).toBeLessThan(0.9);
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

  it("spreads stems roughly evenly around the neck instead of clustering", () => {
    const stems = layoutBouquet({ stemCount: DEFAULT_BOUQUET.stemCount, seed: 2 });
    const angles = stems.map(({ controlPoints }) => {
      const [x, , z] = controlPoints[0];
      return (Math.atan2(z, x) * 180) / Math.PI;
    });
    const expectedStepDeg = 360 / stems.length;
    for (let i = 1; i < angles.length; i++) {
      let delta = Math.abs(angles[i] - angles[i - 1]);
      if (delta > 180) delta = 360 - delta;
      // Jitter is ±30% of the step, so consecutive stems stay well separated.
      expect(delta).toBeGreaterThan(expectedStepDeg * 0.35);
    }
  });

  it("merges partial options with the defaults", () => {
    expect(layoutBouquet({ seed: 4 })).toHaveLength(DEFAULT_BOUQUET.stemCount);
  });
});
