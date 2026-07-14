// Vogel's phyllotaxis model — the golden-angle spiral that real sunflower
// seed heads grow in. Used to place the disc florets so the head reads as
// a sunflower instead of a flat brown circle.

export const GOLDEN_ANGLE_RAD = Math.PI * (3 - Math.sqrt(5)); // ≈137.5°

/** `count` points filling a disc of `radius`, as [x, z] pairs (center-out spiral). */
export function phyllotaxis(count: number, radius: number): ReadonlyArray<readonly [number, number]> {
  const n = Math.max(0, Math.floor(count));
  const points: Array<readonly [number, number]> = [];
  for (let i = 0; i < n; i++) {
    const r = radius * Math.sqrt((i + 0.5) / n);
    const theta = i * GOLDEN_ANGLE_RAD;
    points.push([Math.cos(theta) * r, Math.sin(theta) * r]);
  }
  return points;
}
