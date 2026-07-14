// Sun direction as a Three.js-ready ENU unit vector (+x east, +y up, -z
// north — matches Three.js's default Y-up camera convention, so no
// coordinate transform is needed before assigning to DirectionalLight.position).

export type Vec3 = readonly [number, number, number];

import { cosd, sind } from "../astro/angles";

/** Unit vector toward the sun for an azimuth/altitude pair (degrees). */
export function sunDirection(azDeg: number, altDeg: number): Vec3 {
  return [sind(azDeg) * cosd(altDeg), sind(altDeg), -cosd(azDeg) * cosd(altDeg)];
}
