import * as THREE from "three";
import { offsetProfileInward } from "../../engine/geometry/profileOffset";
import {
  DEFAULT_VASE_PROFILE,
  type ProfilePoint,
  type VaseProfileOptions,
  vaseProfile,
} from "../../engine/geometry/vaseProfile";

const WALL_M = 0.004;
const WATER_LEVEL_FRAC = 0.62;
// Small non-zero radius at the lathe axis so the closed profile never degenerates.
const AXIS_R = 0.007;

/** Inner-wall radius at an arbitrary height, interpolated between profile samples. */
function radiusAtY(profile: readonly ProfilePoint[], y: number): number {
  for (let i = 1; i < profile.length; i++) {
    const [r0, y0] = profile[i - 1];
    const [r1, y1] = profile[i];
    if (y <= y1) {
      const u = (y - y0) / (y1 - y0);
      return r0 + (r1 - r0) * u;
    }
  }
  return profile[profile.length - 1][0];
}

function createGlassMesh(outer: readonly ProfilePoint[], inner: readonly ProfilePoint[]): THREE.Mesh {
  // One closed lathe polyline: bottom center → up the outer wall → over the
  // rim → back down the inner wall → inner bottom. Real wall thickness is
  // what makes glass read as glass — a single zero-thickness surface has no
  // visible rim and refracts nothing at the edges.
  const profile: THREE.Vector2[] = [new THREE.Vector2(AXIS_R, 0)];
  for (const [r, y] of outer) profile.push(new THREE.Vector2(r, y));
  for (let i = inner.length - 1; i >= 0; i--) {
    const [r, y] = inner[i];
    profile.push(new THREE.Vector2(r, Math.max(y, WALL_M)));
  }
  profile.push(new THREE.Vector2(AXIS_R, WALL_M));

  const material = new THREE.MeshPhysicalMaterial({
    color: 0xf4fbf9,
    roughness: 0.04,
    transmission: 1.0,
    thickness: 0.008,
    ior: 1.5,
    envMapIntensity: 1.1,
    clearcoat: 0.5,
    clearcoatRoughness: 0.2,
  });

  const mesh = new THREE.Mesh(new THREE.LatheGeometry(profile, 72), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createWaterMesh(inner: readonly ProfilePoint[], heightM: number): THREE.Mesh {
  const waterProfile = offsetProfileInward(inner, 0.0015, 0.003);
  const topY = heightM * WATER_LEVEL_FRAC;
  const bottomY = WALL_M + 0.002;

  const profile: THREE.Vector2[] = [new THREE.Vector2(AXIS_R * 0.8, bottomY)];
  for (const [r, y] of waterProfile) {
    if (y >= topY) break;
    if (y > bottomY) profile.push(new THREE.Vector2(r, y));
  }
  profile.push(
    new THREE.Vector2(radiusAtY(waterProfile, topY), topY),
    new THREE.Vector2(AXIS_R * 0.8, topY),
  );

  const material = new THREE.MeshPhysicalMaterial({
    color: 0xdcefe4,
    roughness: 0.08,
    transmission: 0.9,
    thickness: 0.05,
    ior: 1.33,
  });

  return new THREE.Mesh(new THREE.LatheGeometry(profile, 56), material);
}

/** Hollow glass vase with visible wall thickness, part-filled with water. */
export function createVaseGroup(opts?: Partial<VaseProfileOptions>): THREE.Group {
  const o: VaseProfileOptions = { ...DEFAULT_VASE_PROFILE, ...opts };
  const outer = vaseProfile(opts);
  const inner = offsetProfileInward(outer, WALL_M, 0.004);

  const group = new THREE.Group();
  group.add(createGlassMesh(outer, inner));
  group.add(createWaterMesh(inner, o.heightM));
  return group;
}
