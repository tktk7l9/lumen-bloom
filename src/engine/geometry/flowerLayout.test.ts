import { DEFAULT_BOUQUET, layoutBouquet } from "./flowerLayout";

describe("layoutBouquet", () => {
  it("is deterministic for a given seed", () => {
    const a = layoutBouquet({ seed: 5 });
    const b = layoutBouquet({ seed: 5 });
    expect(a).toEqual(b);
  });

  it("produces a different layout for a different seed", () => {
    const a = layoutBouquet({ seed: 1 });
    const b = layoutBouquet({ seed: 2 });
    expect(a).not.toEqual(b);
  });

  it("honors stemCount", () => {
    expect(layoutBouquet({ stemCount: 3 })).toHaveLength(3);
    expect(layoutBouquet({ stemCount: 8 })).toHaveLength(8);
  });

  it("clamps stemCount to at least one stem", () => {
    expect(layoutBouquet({ stemCount: 0 })).toHaveLength(1);
  });

  it("every head sits above the vase rim by a plausible amount", () => {
    const rimY = 0.3;
    for (const stem of layoutBouquet({ vaseRimYM: rimY, seed: 9 })) {
      const [, headY] = stem.headPosition;
      expect(headY).toBeGreaterThan(rimY);
      expect(headY).toBeLessThan(rimY + 0.2);
    }
  });

  it("petal count stays within the intended 5-7 range", () => {
    for (const stem of layoutBouquet({ stemCount: 12, seed: 3 })) {
      expect(stem.petalCount).toBeGreaterThanOrEqual(5);
      expect(stem.petalCount).toBeLessThanOrEqual(7);
    }
  });

  it("colorSeed stays within [0, 1)", () => {
    for (const stem of layoutBouquet({ stemCount: 10, seed: 11 })) {
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
      // Jitter is ±35% of the step, so consecutive stems stay well separated.
      expect(delta).toBeGreaterThan(expectedStepDeg * 0.4);
    }
  });

  it("merges partial options with the defaults", () => {
    const stems = layoutBouquet({ seed: 4 });
    expect(stems).toHaveLength(DEFAULT_BOUQUET.stemCount);
  });
});
