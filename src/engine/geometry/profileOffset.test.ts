import { offsetProfileInward } from "./profileOffset";

describe("offsetProfileInward", () => {
  const profile: ReadonlyArray<readonly [number, number]> = [
    [0.05, 0],
    [0.09, 0.15],
    [0.045, 0.3],
  ];

  it("shifts every radius inward by the offset, preserving y", () => {
    const inner = offsetProfileInward(profile, 0.004);
    const expected = [
      [0.046, 0],
      [0.086, 0.15],
      [0.041, 0.3],
    ];
    inner.forEach(([r, y], i) => {
      expect(r).toBeCloseTo(expected[i][0], 9);
      expect(y).toBe(expected[i][1]);
    });
  });

  it("clamps to the minimum radius instead of going non-positive", () => {
    const inner = offsetProfileInward(profile, 0.06, 0.003);
    expect(inner[0][0]).toBe(0.003);
    expect(inner[2][0]).toBe(0.003);
    expect(inner[1][0]).toBeCloseTo(0.03, 9);
  });

  it("uses the default minimum radius when none is given", () => {
    const inner = offsetProfileInward([[0.001, 0]], 0.01);
    expect(inner[0][0]).toBe(0.002);
  });

  it("preserves the point count", () => {
    expect(offsetProfileInward(profile, 0.001)).toHaveLength(3);
  });
});
