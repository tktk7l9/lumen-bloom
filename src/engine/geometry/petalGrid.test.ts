import { petalGrid } from "./petalGrid";

const BASE = {
  lengthM: 1,
  widthM: 0.34,
  segmentsU: 10,
  segmentsV: 6,
  cupM: 0.06,
  bendM: 0.18,
};

describe("petalGrid", () => {
  it("returns (segmentsU+1) × (segmentsV+1) points, row-major", () => {
    const grid = petalGrid(BASE);
    expect(grid.rows).toBe(11);
    expect(grid.cols).toBe(7);
    expect(grid.positions).toHaveLength(11 * 7);
    expect(grid.rowT).toHaveLength(11);
  });

  it("clamps segments to a sane minimum", () => {
    const grid = petalGrid({ ...BASE, segmentsU: 0, segmentsV: 1 });
    expect(grid.rows).toBe(3);
    expect(grid.cols).toBe(3);
  });

  it("runs from y=0 at the base to y=lengthM at the tip", () => {
    const grid = petalGrid(BASE);
    expect(grid.positions[0][1]).toBe(0);
    expect(grid.positions[grid.positions.length - 1][1]).toBeCloseTo(1, 9);
  });

  it("converges to a zero-width tip bent back by bendM", () => {
    const grid = petalGrid(BASE);
    const tipRow = grid.positions.slice(-grid.cols);
    for (const [x, , z] of tipRow) {
      expect(Math.abs(x)).toBeLessThan(1e-9);
      expect(z).toBeCloseTo(-BASE.bendM, 9);
    }
  });

  it("is widest partway along, not at the base", () => {
    const grid = petalGrid(BASE);
    const rowWidth = (row: number): number =>
      Math.abs(grid.positions[row * grid.cols][0]) * 2;
    const widths = grid.rowT.map((_, i) => rowWidth(i));
    const maxWidth = Math.max(...widths);
    expect(maxWidth).toBeGreaterThan(widths[0]);
    expect(maxWidth).toBeCloseTo(BASE.widthM, 1);
  });

  it("is mirror-symmetric across the centerline", () => {
    const grid = petalGrid(BASE);
    for (let iu = 0; iu < grid.rows; iu++) {
      for (let iv = 0; iv < grid.cols; iv++) {
        const a = grid.positions[iu * grid.cols + iv];
        const b = grid.positions[iu * grid.cols + (grid.cols - 1 - iv)];
        expect(a[0]).toBeCloseTo(-b[0], 9);
        expect(a[1]).toBe(b[1]);
        expect(a[2]).toBeCloseTo(b[2], 9);
      }
    }
  });

  it("cups the centerline above the edges mid-petal", () => {
    const grid = petalGrid(BASE);
    const midRow = Math.floor(grid.rows / 2);
    const center = grid.positions[midRow * grid.cols + Math.floor(grid.cols / 2)];
    const edge = grid.positions[midRow * grid.cols];
    expect(center[2]).toBeGreaterThan(edge[2]);
  });

  it("is deterministic", () => {
    expect(petalGrid(BASE)).toEqual(petalGrid(BASE));
  });
});
