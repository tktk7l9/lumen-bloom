import type { ProfilePoint } from "./vaseProfile";

/**
 * Offset a lathe profile inward by a wall thickness, clamped to a minimum
 * radius so the lathe never degenerates. Used to derive the vase's inner
 * wall (and the water surface inside it) from the outer silhouette.
 */
export function offsetProfileInward(
  points: readonly ProfilePoint[],
  offsetM: number,
  minRadiusM = 0.002,
): ProfilePoint[] {
  return points.map(([r, y]) => [Math.max(r - offsetM, minRadiusM), y]);
}
