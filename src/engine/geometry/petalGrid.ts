// Parametric petal/leaf surface as a plain point grid — pointed tip, cupped
// cross-section, tipward backward bend. The scene layer turns this into an
// indexed BufferGeometry; keeping the surface math here makes the shape
// testable without a WebGL context, and one function covers ray petals,
// calyx bracts, and leaves (they differ only in proportions).

export type GridPoint = readonly [x: number, y: number, z: number];

export interface PetalGridOptions {
  lengthM: number;
  /** Maximum width, reached partway along the length. */
  widthM: number;
  /** Rows along the length. */
  segmentsU: number;
  /** Columns across the width. */
  segmentsV: number;
  /** Cross-section cupping: centerline lifted above the edges (negative to sag). */
  cupM: number;
  /** How far the tip bends backward out of the petal plane. */
  bendM: number;
}

export interface PetalGrid {
  /** rows × cols points, row-major, base row first. x across, y along length, z out of plane. */
  positions: ReadonlyArray<GridPoint>;
  rows: number;
  cols: number;
  /** Length fraction t of each row — for color gradients in the renderer. */
  rowT: ReadonlyArray<number>;
}

// Width profile phase offset: w(t) = W·sin(π(BASE_PHASE + (1−BASE_PHASE)t))
// gives a ~37%-width attachment at the base and a sharp zero-width tip.
const BASE_PHASE = 0.12;

export function petalGrid(o: PetalGridOptions): PetalGrid {
  const rows = Math.max(2, Math.floor(o.segmentsU)) + 1;
  const cols = Math.max(2, Math.floor(o.segmentsV)) + 1;
  const positions: GridPoint[] = [];
  const rowT: number[] = [];

  for (let iu = 0; iu < rows; iu++) {
    const t = iu / (rows - 1);
    rowT.push(t);
    const halfWidth = (o.widthM * Math.sin(Math.PI * (BASE_PHASE + (1 - BASE_PHASE) * t))) / 2;
    for (let iv = 0; iv < cols; iv++) {
      const s = (iv / (cols - 1)) * 2 - 1; // -1..1 across
      const x = s * halfWidth;
      const y = t * o.lengthM;
      const z = o.cupM * (1 - s * s) * Math.sin(Math.PI * t) - o.bendM * t * t;
      positions.push([x, y, z]);
    }
  }

  return { positions, rows, cols, rowT };
}
