// A double flower whose petals are set in one golden-angle spiral, as on a
// double gardenia: the outermost petals lie open or curl back, and each
// next petal sits a little further in, stands a little steeper and is a
// little shorter, closing to a cupped, rose-like center. Pure; the small
// jitter that keeps the spiral from looking machined is seeded.

import { GOLDEN_ANGLE_RAD } from "./phyllotaxis";
import { mulberry32 } from "./prng";

export interface SpiralBloomOptions {
  petals: number;
  seed: number;
  /** Tilt above the face plane of the outermost and innermost petal, degrees (negative curls back). */
  tiltDeg: { outer: number; inner: number };
  /** Innermost petal length as a fraction of the outermost. */
  innerLength: number;
  /** Petal attachment radius, outermost and innermost, as a fraction of the outer petal length. */
  radius: { outer: number; inner: number };
  /** How far the innermost petal's base sits above the outermost's, × the outer petal length. */
  innerLift: number;
}

export interface SpiralPetal {
  /** 0 for the outermost petal, 1 for the innermost. */
  depth: number;
  azimuthRad: number;
  tiltDeg: number;
  /** × the outer petal length. */
  length: number;
  /** × the outer petal length. */
  radius: number;
  /** × the outer petal length. */
  lift: number;
}

const TILT_JITTER_DEG = 6;
const LENGTH_JITTER = 0.12;
const AZIMUTH_JITTER_RAD = 0.2;

/** Petals from the outermost in. */
export function spiralBloom(o: SpiralBloomOptions): SpiralPetal[] {
  const n = Math.max(1, Math.floor(o.petals));
  const rand = mulberry32(o.seed);
  const petals: SpiralPetal[] = [];
  for (let i = 0; i < n; i++) {
    const depth = n === 1 ? 0 : i / (n - 1);
    petals.push({
      depth,
      azimuthRad: i * GOLDEN_ANGLE_RAD + (rand() - 0.5) * AZIMUTH_JITTER_RAD,
      // Steepening eases in, so the open outer whorls stay broad and the
      // last few petals fold up quickly into the cupped center.
      tiltDeg: o.tiltDeg.outer + (o.tiltDeg.inner - o.tiltDeg.outer) * depth ** 1.4 + (rand() - 0.5) * TILT_JITTER_DEG,
      length: (1 - (1 - o.innerLength) * depth) * (1 - LENGTH_JITTER / 2 + rand() * LENGTH_JITTER),
      radius: o.radius.outer + (o.radius.inner - o.radius.outer) * depth,
      lift: o.innerLift * depth * depth,
    });
  }
  return petals;
}
