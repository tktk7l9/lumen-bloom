// Bouquet layout with vase statics: each cut stem is a lever resting
// against the vase — its foot pushes on the inside of the base on one side,
// it pivots on the rim edge on the opposite side, and above the rim it
// arcs outward and down under the head's weight. The maximum lean falls
// out of the vessel's real geometry (neck radius, base radius, depth), so
// stems in a slim bottle stand taller than stems in a wide-mouthed jar.
// Deterministic per seed and Three.js-independent for testability.

import { mulberry32 } from "./prng";

export type Point3 = readonly [x: number, y: number, z: number];

export interface LeafLayout {
  /** Position along the stem curve, 0 (vase floor) .. 1 (head). */
  t: number;
  /** Direction the leaf points, compass-style around the stem. */
  azimuthDeg: number;
  lengthM: number;
}

export interface StemLayout {
  /**
   * Curve control points: foot (against the far base wall) → rim contact →
   * three points arcing up and outward above the rim.
   */
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
  /** Where the stems bottom out inside the vase — under the waterline. */
  vaseBottomYM: number;
  /** Interior base radius — where a leaning stem's foot comes to rest. */
  vaseBaseRadiusM: number;
  seed: number;
}

export const DEFAULT_BOUQUET: BouquetOptions = {
  stemCount: 4,
  vaseNeckRadiusM: 0.05,
  vaseRimYM: 0.32,
  vaseBottomYM: 0.04,
  vaseBaseRadiusM: 0.055,
  seed: 5,
};

/** Layout a bouquet of stems leaning on the vase rim, seeded for repeatability. */
export function layoutBouquet(opts?: Partial<BouquetOptions>): StemLayout[] {
  const o: BouquetOptions = { ...DEFAULT_BOUQUET, ...opts };
  const rand = mulberry32(o.seed);
  const n = Math.max(1, Math.floor(o.stemCount));
  const stems: StemLayout[] = [];

  for (let i = 0; i < n; i++) {
    // Wide jitter on purpose — real arrangements cluster and gap, they
    // don't space themselves evenly around the compass.
    const azimuthDeg = (i / n) * 360 + (rand() - 0.5) * (360 / n) * 1.2;
    const az = (azimuthDeg * Math.PI) / 180;
    const cos = Math.cos(az);
    const sin = Math.sin(az);

    // Statics inside the vessel: the foot rests against the base interior
    // on the FAR side of the lean, the stem crosses the opening and pivots
    // on the near rim edge. The resulting in-vase lean angle is whatever
    // that geometry dictates.
    const footR = o.vaseBaseRadiusM * 0.6 * (0.4 + rand() * 0.6);
    const rimR = o.vaseNeckRadiusM * (0.82 + rand() * 0.1);
    const foot: Point3 = [-cos * footR, o.vaseBottomYM, -sin * footR];
    const rimY = o.vaseRimYM - 0.006;
    const rim: Point3 = [cos * rimR, rimY, sin * rimR];
    const drop = rimY - o.vaseBottomYM;
    const leanRad = Math.atan2(rimR + footR, drop);

    // Above the rim the stem continues at the pivot angle, then bows
    // further outward-and-down under the head — long stems droop hard,
    // short ones barely clear the rim and rest against it.
    const freeLenM = 0.09 + rand() * 0.17;
    const droopRad = (0.25 + rand() * 0.6) * Math.min(1, freeLenM / 0.18);
    const seg = freeLenM / 3;
    const point = (prev: Point3, phi: number): Point3 => [
      prev[0] + Math.sin(phi) * cos * seg,
      prev[1] + Math.cos(phi) * seg,
      prev[2] + Math.sin(phi) * sin * seg,
    ];
    const p1 = point(rim, leanRad + droopRad * 0.3);
    const p2 = point(p1, leanRad + droopRad * 0.65);
    const tip = point(p2, leanRad + droopRad);

    // Faces follow the lean's azimuth, nodding a touch up or down from it.
    const elevationDeg = -25 + rand() * 30;
    const el = (elevationDeg * Math.PI) / 180;
    const headDirection: Point3 = [Math.cos(el) * cos, Math.sin(el), Math.cos(el) * sin];

    const neckM = 0.012; // head center sits just forward of the stem tip
    const headPosition: Point3 = [
      tip[0] + headDirection[0] * neckM,
      tip[1] + headDirection[1] * neckM,
      tip[2] + headDirection[2] * neckM,
    ];

    // Leaves live on the above-rim stretch; where that starts on the curve
    // depends on this stem's in-vase vs free length.
    const inVaseLen = Math.hypot(rimR + footR, drop);
    const rimT = inVaseLen / (inVaseLen + freeLenM);
    const leafCount = 1 + (rand() < 0.6 ? 1 : 0);
    const leaves: LeafLayout[] = [];
    for (let j = 0; j < leafCount; j++) {
      leaves.push({
        t: rimT + (0.2 + 0.35 * j + rand() * 0.1) * (1 - rimT),
        azimuthDeg: azimuthDeg + (rand() - 0.5) * 160,
        lengthM: 0.07 + rand() * 0.035,
      });
    }

    stems.push({
      controlPoints: [foot, rim, p1, p2, tip],
      headPosition,
      headDirection,
      // Wide spread on purpose — a real bouquet mixes a few dominant blooms
      // with plenty of smaller ones, not a shelf of identical heads.
      headRadiusM: 0.044 + rand() * 0.046,
      petalCount: 21 + Math.floor(rand() * 8),
      colorSeed: rand(),
      leaves,
    });
  }

  return stems;
}
