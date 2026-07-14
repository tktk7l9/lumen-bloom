// Stem/flower placement for the bouquet — a decorative, not physical,
// layout. Deterministic per seed so a render is reproducible, and
// Three.js-independent so it can be tested without a WebGL context.

import { mulberry32 } from "./prng";

export type Point3 = readonly [x: number, y: number, z: number];

export interface StemLayout {
  /** Curve control points from the vase neck to the flower head, world space. */
  controlPoints: readonly Point3[];
  headPosition: Point3;
  /** Degrees the stem leans away from vertical. */
  headTiltDeg: number;
  petalCount: number;
  petalLengthM: number;
  /** 0..1, mapped to a hue by the renderer. */
  colorSeed: number;
}

export interface BouquetOptions {
  stemCount: number;
  vaseNeckRadiusM: number;
  vaseRimYM: number;
  seed: number;
}

export const DEFAULT_BOUQUET: BouquetOptions = {
  stemCount: 5,
  vaseNeckRadiusM: 0.045,
  vaseRimYM: 0.3,
  seed: 1,
};

/** Layout a bouquet of stems emerging from the vase neck, seeded for repeatability. */
export function layoutBouquet(opts?: Partial<BouquetOptions>): StemLayout[] {
  const o: BouquetOptions = { ...DEFAULT_BOUQUET, ...opts };
  const rand = mulberry32(o.seed);
  const n = Math.max(1, Math.floor(o.stemCount));
  const stems: StemLayout[] = [];

  for (let i = 0; i < n; i++) {
    const baseAngleDeg = (i / n) * 360 + (rand() - 0.5) * (360 / n) * 0.7;
    const angleRad = (baseAngleDeg * Math.PI) / 180;
    const emergeR = o.vaseNeckRadiusM * (0.3 + rand() * 0.45);
    const startX = Math.cos(angleRad) * emergeR;
    const startZ = Math.sin(angleRad) * emergeR;
    const startY = o.vaseRimYM - 0.01;

    const riseM = 0.08 + rand() * 0.09;
    const leanDeg = (rand() - 0.5) * 26;
    const leanRad = (leanDeg * Math.PI) / 180;
    const outwardM = Math.sin(leanRad) * riseM;

    const midX = startX + Math.cos(angleRad) * outwardM * 0.5;
    const midZ = startZ + Math.sin(angleRad) * outwardM * 0.5;
    const midY = startY + riseM * 0.55;

    const topX = startX + Math.cos(angleRad) * outwardM;
    const topZ = startZ + Math.sin(angleRad) * outwardM;
    const topY = startY + riseM;

    stems.push({
      controlPoints: [
        [startX, startY, startZ],
        [midX, midY, midZ],
        [topX, topY, topZ],
      ],
      headPosition: [topX, topY, topZ],
      headTiltDeg: leanDeg,
      petalCount: 5 + Math.floor(rand() * 3),
      petalLengthM: 0.018 + rand() * 0.01,
      colorSeed: rand(),
    });
  }

  return stems;
}
