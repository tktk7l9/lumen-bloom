// Vase silhouette as a foot→belly→shoulder→neck→rim radius curve, sampled
// as [radius, y] points for a THREE.LatheGeometry. Three.js-independent so
// the curve shape can be tested without a WebGL context.

export interface VaseProfileOptions {
  heightM: number;
  neckRadiusM: number;
  bellyRadiusM: number;
  baseRadiusM: number;
  segments: number;
}

export const DEFAULT_VASE_PROFILE: VaseProfileOptions = {
  heightM: 0.3,
  neckRadiusM: 0.045,
  bellyRadiusM: 0.09,
  baseRadiusM: 0.05,
  segments: 24,
};

export type ProfilePoint = readonly [radius: number, y: number];

interface Knot {
  t: number;
  r: number;
}

function knots(o: VaseProfileOptions): Knot[] {
  return [
    { t: 0, r: o.baseRadiusM },
    { t: 0.1, r: o.baseRadiusM * 1.04 },
    { t: 0.42, r: o.bellyRadiusM },
    { t: 0.8, r: o.neckRadiusM },
    { t: 1, r: o.neckRadiusM * 1.12 },
  ];
}

/**
 * Cosine-eased interpolation between the profile's radius knots. `result`
 * starts at the last knot's radius (t=1 is always matched by the final
 * interval below, so this default is never actually returned unmodified —
 * it exists only so the function has a well-typed return with no
 * unreachable fallback branch for the knot spacing to leave untested).
 */
function radiusAt(t: number, ks: readonly Knot[]): number {
  let result = ks[ks.length - 1].r;
  for (let i = 0; i < ks.length - 1; i++) {
    const a = ks[i];
    const b = ks[i + 1];
    if (t >= a.t && t <= b.t) {
      const u = (t - a.t) / (b.t - a.t);
      const ease = 0.5 - 0.5 * Math.cos(Math.PI * u);
      result = a.r + (b.r - a.r) * ease;
      break;
    }
  }
  return result;
}

/** Sample the vase's [radius, y] silhouette from base (y=0) to rim (y=heightM). */
export function vaseProfile(opts?: Partial<VaseProfileOptions>): readonly ProfilePoint[] {
  const o: VaseProfileOptions = { ...DEFAULT_VASE_PROFILE, ...opts };
  const ks = knots(o);
  const n = Math.max(4, Math.floor(o.segments));
  const points: ProfilePoint[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    points.push([radiusAt(t, ks), t * o.heightM]);
  }
  return points;
}
