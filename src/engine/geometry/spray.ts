// A spray of small flowers on one stem, as on spray chrysanthemums
// (kogiku): side shoots leave the top stretch of the stem and curve up so
// their heads finish close to the terminal flower, giving the domed,
// flat-topped cluster (a corymb) a bunch is sold as. The lowest shoots are
// the longest and reach furthest out, so their heads ring the edge of the
// dome. Coordinates are in the stem tip's frame: +Y continues the stem and
// the shoots fan out around it in X/Z. Pure and seeded.

import type { Point3 } from "./flowerLayout";
import { GOLDEN_ANGLE_RAD } from "./phyllotaxis";
import { mulberry32 } from "./prng";

export interface SprayOptions {
  /** Side shoots below the terminal head. */
  shoots: number;
  seed: number;
  /** How far below the stem tip the lowest shoot leaves the stem, metres. */
  spanM: number;
  /** Horizontal reach of the outermost heads from the stem axis, metres. */
  reachM: number;
  /** How far the outermost heads sit below the terminal head, metres (the dome's sag). */
  sagM: number;
  headRadiusM: { min: number; max: number };
  /** Fraction of the side shoots still in bud at peak bloom, taken from the top shoots down. */
  budFraction: number;
}

export interface SprayHead {
  /** How far below the stem tip the shoot leaves the stem, metres (0 for the terminal head). */
  dropM: number;
  /** The shoot as four points from its attachment on the stem to the head (stem-tip frame). */
  pedicel: readonly Point3[];
  /** Unit vector the head faces (stem-tip frame). */
  facing: Point3;
  headRadiusM: number;
  /** Still a closed bud at peak bloom. */
  bud: boolean;
}

const TERMINAL_NECK_M = 0.006;

function bezier(p0: Point3, c: Point3, p1: Point3, s: number): Point3 {
  const a = (1 - s) * (1 - s);
  const b = 2 * (1 - s) * s;
  const d = s * s;
  return [a * p0[0] + b * c[0] + d * p1[0], a * p0[1] + b * c[1] + d * p1[1], a * p0[2] + b * c[2] + d * p1[2]];
}

function normalize([x, y, z]: Point3): Point3 {
  const len = Math.hypot(x, y, z);
  return [x / len, y / len, z / len];
}

/** The terminal head first, then the side shoots from the top of the stem down. */
export function sprayLayout(o: SprayOptions): SprayHead[] {
  const shoots = Math.max(0, Math.floor(o.shoots));
  const rand = mulberry32(o.seed);
  const budCount = Math.round(shoots * Math.min(1, Math.max(0, o.budFraction)));
  const radius = (): number => o.headRadiusM.min + (o.headRadiusM.max - o.headRadiusM.min) * rand();

  const heads: SprayHead[] = [
    {
      dropM: 0,
      pedicel: [0, 1, 2, 3].map((k): Point3 => [0, (TERMINAL_NECK_M * k) / 3, 0]),
      facing: [0, 1, 0],
      headRadiusM: radius(),
      bud: false,
    },
  ];
  const phase = rand() * Math.PI * 2;
  for (let k = 1; k <= shoots; k++) {
    const f = k / shoots;
    // Evenly spaced down the span with up to half a step of jitter, so the order never flips.
    const dropM = (o.spanM * (k - rand() * 0.5)) / shoots;
    const azimuth = phase + k * GOLDEN_ANGLE_RAD + (rand() - 0.5) * 0.6;
    const reach = o.reachM * (0.45 + 0.55 * f) * (0.88 + rand() * 0.24);
    // The dome: heads further out sit lower, but never below their own attachment.
    const sag = o.sagM * (reach / o.reachM) ** 2 * (0.8 + rand() * 0.4);
    const top = Math.max(-dropM + 0.25 * reach, -sag);
    const start: Point3 = [0, -dropM, 0];
    const end: Point3 = [Math.cos(azimuth) * reach, top, Math.sin(azimuth) * reach];
    // Leave the stem flatter than the chord, then curve up into the head.
    const chord = Math.atan2(reach, top + dropM);
    const splay = Math.min(1.35, chord + 0.3);
    const lean = Math.hypot(reach, top + dropM) * 0.6;
    const control: Point3 = [
      Math.cos(azimuth) * Math.sin(splay) * lean,
      -dropM + Math.cos(splay) * lean,
      Math.sin(azimuth) * Math.sin(splay) * lean,
    ];
    const arrive = normalize([end[0] - control[0], end[1] - control[1], end[2] - control[2]]);
    heads.push({
      dropM,
      pedicel: [0, 1 / 3, 2 / 3, 1].map((s) => bezier(start, control, end, s)),
      facing: normalize([arrive[0], arrive[1] + 1.3, arrive[2]]),
      headRadiusM: radius(),
      bud: k <= budCount,
    });
  }
  return heads;
}
