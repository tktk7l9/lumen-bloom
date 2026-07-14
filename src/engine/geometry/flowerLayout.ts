// Sunflower bouquet layout — a decorative, not physical, arrangement.
// Deterministic per seed so a render is reproducible, and Three.js-
// independent so it can be tested without a WebGL context.

import { mulberry32 } from "./prng";

export type Point3 = readonly [x: number, y: number, z: number];

export interface LeafLayout {
  /** Position along the stem curve, 0 (vase) .. 1 (head). */
  t: number;
  /** Direction the leaf points, compass-style around the stem. */
  azimuthDeg: number;
  lengthM: number;
}

export interface StemLayout {
  /** Curve control points from inside the vase neck up to the head attachment. */
  controlPoints: readonly Point3[];
  headPosition: Point3;
  /** Unit vector the flower face points toward (outward, nodding slightly). */
  headDirection: Point3;
  /** Radius of the whole head including ray petals. */
  headRadiusM: number;
  /** Ray petals in the outer ring (Fibonacci-neighborhood counts). */
  petalCount: number;
  /** 0..1, mapped to a subtle petal hue variation by the renderer. */
  colorSeed: number;
  leaves: readonly LeafLayout[];
}

export interface BouquetOptions {
  stemCount: number;
  vaseNeckRadiusM: number;
  vaseRimYM: number;
  seed: number;
}

export const DEFAULT_BOUQUET: BouquetOptions = {
  stemCount: 4,
  vaseNeckRadiusM: 0.05,
  vaseRimYM: 0.32,
  // Chosen by comparing rendered compositions across seeds — one full-face
  // head toward the camera, two profiles, no clumping.
  seed: 5,
};

/** Layout a bouquet of sunflower stems emerging from the vase neck, seeded for repeatability. */
export function layoutBouquet(opts?: Partial<BouquetOptions>): StemLayout[] {
  const o: BouquetOptions = { ...DEFAULT_BOUQUET, ...opts };
  const rand = mulberry32(o.seed);
  const n = Math.max(1, Math.floor(o.stemCount));
  const stems: StemLayout[] = [];

  for (let i = 0; i < n; i++) {
    const azimuthDeg = (i / n) * 360 + (rand() - 0.5) * (360 / n) * 0.6;
    const az = (azimuthDeg * Math.PI) / 180;
    const emergeR = o.vaseNeckRadiusM * (0.2 + rand() * 0.4);
    const startX = Math.cos(az) * emergeR;
    const startZ = Math.sin(az) * emergeR;
    const startY = o.vaseRimYM - 0.05;

    const riseM = 0.17 + rand() * 0.09;
    const leanDeg = 8 + rand() * 16; // always leans a little outward
    const outwardM = Math.sin((leanDeg * Math.PI) / 180) * riseM;

    const at = (upFrac: number, outFrac: number): Point3 => [
      startX + Math.cos(az) * outwardM * outFrac,
      startY + riseM * upFrac,
      startZ + Math.sin(az) * outwardM * outFrac,
    ];

    // Cut sunflowers nod: faces point outward and mostly a touch downward.
    const elevationDeg = -22 + rand() * 30;
    const el = (elevationDeg * Math.PI) / 180;
    const headDirection: Point3 = [
      Math.cos(el) * Math.cos(az),
      Math.sin(el),
      Math.cos(el) * Math.sin(az),
    ];

    const top = at(1, 1);
    const neckM = 0.012; // head center sits just forward of the stem tip
    const headPosition: Point3 = [
      top[0] + headDirection[0] * neckM,
      top[1] + headDirection[1] * neckM,
      top[2] + headDirection[2] * neckM,
    ];

    const leafCount = 1 + (rand() < 0.6 ? 1 : 0);
    const leaves: LeafLayout[] = [];
    for (let j = 0; j < leafCount; j++) {
      leaves.push({
        t: 0.38 + 0.28 * j + rand() * 0.08,
        azimuthDeg: azimuthDeg + (rand() - 0.5) * 160,
        lengthM: 0.07 + rand() * 0.035,
      });
    }

    stems.push({
      controlPoints: [at(0, 0), at(0.4, 0.12), at(0.75, 0.5), top],
      headPosition,
      headDirection,
      headRadiusM: 0.055 + rand() * 0.018,
      petalCount: 21 + Math.floor(rand() * 8),
      colorSeed: rand(),
      leaves,
    });
  }

  return stems;
}
