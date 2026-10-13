// Floret placement on a dense raceme such as a hyacinth's: florets spiral up
// the rachis at the golden angle (so neighbors never stack in a column),
// the lower ones nod outward and down, the upper ones point up, and the
// youngest few at the top are still closed buds even at peak bloom. Older
// florets lower down are the first to wither. Pure and seeded.

import { GOLDEN_ANGLE_RAD } from "./phyllotaxis";
import { mulberry32 } from "./prng";

export interface RacemeOptions {
  count: number;
  seed: number;
  /** Fraction of the raceme, from the top, that is still in bud at peak bloom (0..1). */
  budFraction: number;
}

export interface RacemeFloret {
  /** Height up the raceme: 0 = the lowest floret, 1 = the tip. Strictly increasing by index. */
  along: number;
  /** Direction around the rachis, radians. */
  azimuthRad: number;
  /** Tilt of the floret axis below horizontal, radians (negative = pointing up). */
  droopRad: number;
  /** Size relative to a full-grown floret. */
  scale: number;
  /** How open the floret is at peak bloom: 1 = a spread star, 0 = a closed bud. */
  openness: number;
  /** Shed threshold in 0..1 — lower florets wither and drop first. */
  shedAt: number;
}

// Index jitter stays under half a step, so `along` never reorders.
const ALONG_JITTER = 0.3;
const AZIMUTH_JITTER_RAD = 0.35;

function smoothstep01(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

/** Florets of one raceme, lowest first. */
export function racemeLayout(o: RacemeOptions): RacemeFloret[] {
  const n = Math.max(1, Math.floor(o.count));
  const rand = mulberry32(o.seed);
  const budFraction = Math.min(1, Math.max(0, o.budFraction));
  const budStart = 1 - budFraction;
  const steps = Math.max(1, n - 1);
  const florets: RacemeFloret[] = [];
  for (let i = 0; i < n; i++) {
    const along = Math.min(1, Math.max(0, (i + (rand() - 0.5) * 2 * ALONG_JITTER) / steps));
    // Only florets above budStart are (partly) closed, so budFraction 0 never divides by zero.
    const bud = along > budStart ? smoothstep01((along - budStart) / budFraction) : 0;
    florets.push({
      along,
      azimuthRad: i * GOLDEN_ANGLE_RAD + (rand() - 0.5) * AZIMUTH_JITTER_RAD,
      // Lower florets hang out and down under their own weight; the young
      // ones near the tip still point up along the rachis.
      droopRad: 0.42 - 0.75 * along - 0.35 * bud + (rand() - 0.5) * 0.2,
      scale: (1 - 0.32 * along) * (0.92 + rand() * 0.16),
      openness: 1 - bud,
      shedAt: Math.min(0.98, Math.max(0.02, 0.1 + 0.78 * along + (rand() - 0.5) * 0.16)),
    });
  }
  return florets;
}
