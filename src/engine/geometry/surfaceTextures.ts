import { mulberry32 } from "./prng";

// Procedural room surfaces as raw pixel buffers. No Three.js and no images:
// the scene layer uploads these as data textures, so the strict CSP stays
// untouched. Every buffer tiles seamlessly on both axes.

export interface SurfacePixels {
  width: number;
  height: number;
  /** sRGB, RGBA8. */
  albedo: Uint8Array;
  /** Bump height, one byte per pixel. */
  bump: Uint8Array;
}

/** Physical size of one tile, used to set the texture repeat. */
export const PLASTER_TILE_M = 1.6;
export const CEDAR_TILE_LENGTH_M = 1.82; // one traditional 6-shaku board
export const CEDAR_PLANK_WIDTH_M = 0.135;
export const CEDAR_PLANKS_PER_TILE = 8;
export const CEDAR_TILE_WIDTH_M = CEDAR_PLANK_WIDTH_M * CEDAR_PLANKS_PER_TILE;

/** Rows generated between pauses, so a slow phone never blocks a whole frame budget. */
export const ROWS_PER_SLICE = 48;

/** A generation in progress: each yield is a safe point to give the main thread back. */
export type SurfaceJob = Generator<void, SurfacePixels, void>;

/** Runs a job to the end without pausing. */
export function finishSurface(job: SurfaceJob): SurfacePixels {
  for (;;) {
    const step = job.next();
    if (step.done) return step.value;
  }
}

type Rgb = readonly [number, number, number];

const PLASTER_RGB: Rgb = [238, 233, 222];
// Sugi boards mix pale sapwood and reddish heartwood.
const CEDAR_SAPWOOD_RGB: Rgb = [226, 190, 142];
const CEDAR_HEARTWOOD_RGB: Rgb = [196, 142, 100];
const CEDAR_LATEWOOD_RGB: Rgb = [150, 102, 70];
const CEDAR_KNOT_RGB: Rgb = [84, 50, 34];

function toByte(value: number): number {
  return Math.round(Math.min(1, Math.max(0, value)) * 255);
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Wrapping value noise on a square lattice, sampled in lattice units. */
function createLattice(cells: number, seed: number): (x: number, y: number) => number {
  const random = mulberry32(seed);
  const values = Float32Array.from({ length: cells * cells }, () => random());
  const at = (x: number, y: number): number =>
    values[(((y % cells) + cells) % cells) * cells + (((x % cells) + cells) % cells)] as number;
  return (x, y) => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    return mix(
      mix(at(ix, iy), at(ix + 1, iy), sx),
      mix(at(ix, iy + 1), at(ix + 1, iy + 1), sx),
      sy,
    );
  };
}

/** Lime plaster: calm off-white with soft trowel mottling and a fine sand grain. */
export function* generatePlaster(size: number, seed: number): SurfaceJob {
  const trowel = createLattice(6, seed);
  const stroke = createLattice(24, seed + 1);
  const sand = createLattice(size >> 1, seed + 2);
  const albedo = new Uint8Array(size * size * 4);
  const bump = new Uint8Array(size * size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const broad = trowel(u * 6, v * 6);
      const mid = stroke(u * 24, v * 24);
      const fine = sand(x / 2, y / 2);
      const relief = broad * 0.5 + mid * 0.32 + fine * 0.18;
      // Only a whisper of tone: a shadow must stay the strongest thing on the wall.
      const shade = 0.975 + (relief - 0.5) * 0.07;
      const i = (y * size + x) * 4;
      albedo[i] = toByte((PLASTER_RGB[0] / 255) * shade);
      albedo[i + 1] = toByte((PLASTER_RGB[1] / 255) * shade);
      albedo[i + 2] = toByte((PLASTER_RGB[2] / 255) * shade);
      albedo[i + 3] = 255;
      bump[y * size + x] = toByte(relief);
    }
    if ((y + 1) % ROWS_PER_SLICE === 0) yield;
  }
  return { width: size, height: size, albedo, bump };
}

interface Plank {
  /** Pixel column of the butt joint. */
  joint: number;
  heartwood: number;
  ringDensity: number;
  phase: number;
  /** Knot centre as [along, across] in 0..1 of the plank, or null. */
  knot: readonly [number, number] | null;
}

function createPlanks(count: number, width: number, seed: number): Plank[] {
  const random = mulberry32(seed);
  return Array.from({ length: count }, () => ({
    joint: Math.floor(random() * width),
    heartwood: random() ** 1.4,
    ringDensity: 7 + random() * 9,
    phase: random() * 100,
    knot: random() < 0.3 ? ([random(), 0.2 + random() * 0.6] as const) : null,
  }));
}

/** Solid sugi (Japanese cedar) boards with straight grain, knots and V-grooves. */
export function* generateCedar(width: number, height: number, seed: number): SurfaceJob {
  const planks = createPlanks(CEDAR_PLANKS_PER_TILE, width, seed);
  const warp = createLattice(16, seed + 1);
  const pore = createLattice(64, seed + 2);
  const albedo = new Uint8Array(width * height * 4);
  const bump = new Uint8Array(width * height);
  const plankHeight = height / CEDAR_PLANKS_PER_TILE;
  const grooveWidth = Math.max(1, plankHeight * 0.012);

  for (let y = 0; y < height; y++) {
    const row = Math.min(CEDAR_PLANKS_PER_TILE - 1, Math.floor(y / plankHeight));
    const plank = planks[row] as Plank;
    const across = y / plankHeight - row;
    const edge = Math.min(y - row * plankHeight, (row + 1) * plankHeight - y - 1);

    for (let x = 0; x < width; x++) {
      const along = (x - plank.joint + width) % width;
      const u = along / width;
      const jointDistance = Math.min(along, width - along - 1);
      const groove = Math.min(edge, jointDistance) < grooveWidth;

      // Rings run along the board; the warp keeps them from looking ruled.
      const wander = warp(u * 4 + plank.phase, across * 2 + plank.phase);
      const uneven = warp(u + plank.phase, across * 6 + plank.phase);
      let rings = across * plank.ringDensity + wander * 3.5 + uneven * 2.5 + plank.phase;
      let knot = 0;
      if (plank.knot) {
        const dx = (u - plank.knot[0]) * (width / height) * CEDAR_PLANKS_PER_TILE;
        const dy = across - plank.knot[1];
        const distanceSquared = dx * dx + dy * dy;
        rings += 3.5 * Math.exp(-distanceSquared / 0.05);
        knot = Math.exp(-distanceSquared / 0.0035);
      }
      const latewood = (0.5 + 0.5 * Math.sin(rings * Math.PI * 2)) ** 3;
      const fibre = pore(u * 64 + plank.phase, across * 16);

      const tone = plank.heartwood * (0.75 + wander * 0.5);
      const i = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) {
        let value = mix(CEDAR_SAPWOOD_RGB[c] as number, CEDAR_HEARTWOOD_RGB[c] as number, tone);
        value = mix(value, CEDAR_LATEWOOD_RGB[c] as number, latewood * 0.3);
        value *= 0.95 + fibre * 0.1;
        value = mix(value, CEDAR_KNOT_RGB[c] as number, knot);
        albedo[i + c] = toByte((groove ? value * 0.62 : value) / 255);
      }
      albedo[i + 3] = 255;
      bump[y * width + x] = groove ? 0 : toByte(0.7 - latewood * 0.2 + fibre * 0.1);
    }
    if ((y + 1) % ROWS_PER_SLICE === 0) yield;
  }
  return { width, height, albedo, bump };
}
