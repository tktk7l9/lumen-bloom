import { describe, expect, it } from "vitest";
import {
  CEDAR_PLANKS_PER_TILE,
  CEDAR_PLANK_WIDTH_M,
  CEDAR_TILE_WIDTH_M,
  finishSurface,
  generateCedar,
  generatePlaster,
  ROWS_PER_SLICE,
} from "./surfaceTextures";

const plasterOf = (size: number, seed: number) => finishSurface(generatePlaster(size, seed));
const cedarOf = (width: number, height: number, seed: number) =>
  finishSurface(generateCedar(width, height, seed));

function luminance(albedo: Uint8Array, index: number): number {
  return (
    0.2126 * (albedo[index] as number) +
    0.7152 * (albedo[index + 1] as number) +
    0.0722 * (albedo[index + 2] as number)
  );
}

function luminanceRange(albedo: Uint8Array): [number, number] {
  let min = 255;
  let max = 0;
  for (let i = 0; i < albedo.length; i += 4) {
    const l = luminance(albedo, i);
    min = Math.min(min, l);
    max = Math.max(max, l);
  }
  return [min, max];
}

function maxEdgeJump(albedo: Uint8Array, width: number, height: number): number {
  let jump = 0;
  for (let y = 0; y < height; y++) {
    const a = luminance(albedo, y * width * 4);
    const b = luminance(albedo, (y * width + width - 1) * 4);
    jump = Math.max(jump, Math.abs(a - b));
  }
  return jump;
}

describe("generatePlaster", () => {
  const plaster = plasterOf(128, 7);

  it("sizes the buffers and is deterministic", () => {
    expect(plaster.albedo).toHaveLength(128 * 128 * 4);
    expect(plaster.bump).toHaveLength(128 * 128);
    expect(plasterOf(128, 7)).toEqual(plaster);
    expect(plasterOf(128, 8).bump).not.toEqual(plaster.bump);
  });

  it("stays a bright, nearly flat off-white so shadows read", () => {
    const [min, max] = luminanceRange(plaster.albedo);
    expect(min).toBeGreaterThan(200);
    expect(max - min).toBeLessThan(25);
  });

  it("is warm rather than blue and fully opaque", () => {
    expect(plaster.albedo[0]).toBeGreaterThan(plaster.albedo[2] as number);
    expect(plaster.albedo[3]).toBe(255);
  });

  it("tiles without a visible seam", () => {
    expect(maxEdgeJump(plaster.albedo, 128, 128)).toBeLessThan(6);
  });
});

describe("generateCedar", () => {
  const width = 256;
  const height = 128;
  const cedar = cedarOf(width, height, 11);

  it("sizes the buffers and is deterministic", () => {
    expect(cedar.albedo).toHaveLength(width * height * 4);
    expect(cedar.bump).toHaveLength(width * height);
    expect(cedarOf(width, height, 11)).toEqual(cedar);
    expect(cedarOf(width, height, 12).albedo).not.toEqual(cedar.albedo);
  });

  it("tile width is the plank count times the plank width", () => {
    expect(CEDAR_TILE_WIDTH_M).toBeCloseTo(CEDAR_PLANK_WIDTH_M * CEDAR_PLANKS_PER_TILE);
  });

  it("reads as warm wood: red over blue, opaque, mid tone", () => {
    let total = 0;
    for (let i = 0; i < cedar.albedo.length; i += 4) {
      expect(cedar.albedo[i]).toBeGreaterThanOrEqual(cedar.albedo[i + 2] as number);
      expect(cedar.albedo[i + 3]).toBe(255);
      total += luminance(cedar.albedo, i);
    }
    const mean = total / (width * height);
    expect(mean).toBeGreaterThan(90);
    expect(mean).toBeLessThan(210);
  });

  it("cuts a V-groove at every plank boundary", () => {
    const plankHeight = height / CEDAR_PLANKS_PER_TILE;
    for (let row = 1; row < CEDAR_PLANKS_PER_TILE; row++) {
      expect(cedar.bump[(row * plankHeight - 1) * width + 3]).toBe(0);
      expect(cedar.bump[row * plankHeight * width + 3]).toBe(0);
    }
  });

  it("has knots on some seeds, darker than any grain without one", () => {
    const seeds = [1, 2, 3, 4, 5, 6];
    const darkest = seeds.map((seed) => luminanceRange(cedarOf(256, 128, seed).albedo)[0]);
    expect(Math.min(...darkest)).toBeLessThan(Math.max(...darkest));
  });

  it("keeps an unbroken tile edge inside a plank away from the joint", () => {
    expect(maxEdgeJump(cedar.albedo, width, height)).toBeLessThan(120);
  });
});

describe("generation slices", () => {
  it("pauses every ROWS_PER_SLICE rows", () => {
    const job = generatePlaster(ROWS_PER_SLICE * 3, 1);
    let pauses = 0;
    while (!job.next().done) pauses++;
    expect(pauses).toBe(3);
  });
});
