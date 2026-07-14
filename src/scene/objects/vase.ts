import * as THREE from "three";
import type { VaseStyle } from "../../engine/arrangements";
import { offsetProfileInward } from "../../engine/geometry/profileOffset";
import {
  DEFAULT_VASE_PROFILE,
  type ProfilePoint,
  type VaseProfileOptions,
  vaseProfile,
} from "../../engine/geometry/vaseProfile";

const DEFAULT_STYLE: VaseStyle = { kind: "glass", colorHex: 0xf4fbf9 };

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

function createVesselMesh(
  outer: readonly ProfilePoint[],
  inner: readonly ProfilePoint[],
  style: VaseStyle,
): THREE.Mesh {
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

  const material =
    style.kind === "glass"
      ? new THREE.MeshPhysicalMaterial({
          color: style.colorHex,
          roughness: 0.04,
          transmission: 1.0,
          thickness: 0.008,
          ior: 1.5,
          envMapIntensity: 0.8,
          clearcoat: 0.5,
          clearcoatRoughness: 0.2,
          // Without this the glass writes depth and the alpha-blended water
          // inside it fails the depth test entirely — transmissive surfaces
          // render before the transparent pass, so an interior water body is
          // only compositable over the glass if the glass leaves the depth
          // buffer alone.
          depthWrite: false,
        })
      : new THREE.MeshPhysicalMaterial({
          color: style.colorHex,
          roughness: 0.38,
          clearcoat: 0.45,
          clearcoatRoughness: 0.3,
        });

  const mesh = new THREE.Mesh(new THREE.LatheGeometry(profile, 72), material);
  // Findable by the scene rig for frost styling — glazed ceramic doesn't
  // frost over, so only glass gets the name.
  mesh.name = style.kind === "glass" ? "vase-glass" : "vase-ceramic";
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createWaterGroup(inner: readonly ProfilePoint[], heightM: number): THREE.Group {
  const waterProfile = offsetProfileInward(inner, 0.0015, 0.003);
  const topY = heightM * WATER_LEVEL_FRAC;
  const bottomY = WALL_M + 0.002;
  const topR = radiusAtY(waterProfile, topY);

  const profile: THREE.Vector2[] = [new THREE.Vector2(AXIS_R * 0.8, bottomY)];
  for (const [r, y] of waterProfile) {
    if (y >= topY) break;
    if (y > bottomY) profile.push(new THREE.Vector2(r, y));
  }
  profile.push(new THREE.Vector2(topR, topY), new THREE.Vector2(AXIS_R * 0.8, topY));

  // Alpha-blended, NOT transmission: three.js's transmission pass renders a
  // buffer of the rest of the scene for transmissive surfaces to refract,
  // and a transmissive water body sitting entirely inside the transmissive
  // glass wall barely shows up in it — the water reads as absent. Classic
  // transparency is visible through the glass and tints the stems in it.
  const body = new THREE.Mesh(
    new THREE.LatheGeometry(profile, 56),
    new THREE.MeshPhysicalMaterial({
      color: 0x8fc3b0,
      roughness: 0.12,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    }),
  );

  // What actually makes water read as water in a clear vase is the
  // waterline: a glossier, lighter surface disc plus a bright meniscus
  // ring where it meets the glass.
  const surface = new THREE.Mesh(
    new THREE.CircleGeometry(topR, 48),
    new THREE.MeshPhysicalMaterial({
      color: 0xcfe8de,
      roughness: 0.05,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  surface.rotation.x = -Math.PI / 2;
  surface.position.y = topY + 0.0005;

  const meniscus = new THREE.Mesh(
    new THREE.TorusGeometry(topR, 0.0012, 6, 48),
    new THREE.MeshStandardMaterial({
      color: 0xe9f6f0,
      roughness: 0.2,
      transparent: true,
      opacity: 0.85,
    }),
  );
  meniscus.rotation.x = Math.PI / 2;
  meniscus.position.y = topY + 0.0005;

  const group = new THREE.Group();
  group.add(body, surface, meniscus);
  return group;
}

/**
 * Hollow vessel with visible wall thickness. Glass styles get a visible
 * water fill; ceramic is opaque, so water would be invisible and is skipped.
 */
export function createVaseGroup(
  opts?: Partial<VaseProfileOptions>,
  style: VaseStyle = DEFAULT_STYLE,
): THREE.Group {
  const o: VaseProfileOptions = { ...DEFAULT_VASE_PROFILE, ...opts };
  const outer = vaseProfile(opts);
  const inner = offsetProfileInward(outer, WALL_M, 0.004);

  const group = new THREE.Group();
  group.add(createVesselMesh(outer, inner, style));
  if (style.kind === "glass") group.add(createWaterGroup(inner, o.heightM));
  return group;
}
