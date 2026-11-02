import * as THREE from "three";
import {
  CEDAR_TILE_LENGTH_M,
  CEDAR_TILE_WIDTH_M,
  generateCedar,
  type SurfaceJob,
  type SurfacePixels,
  generatePlaster,
  PLASTER_TILE_M,
} from "../../engine/geometry/surfaceTextures";
import { surfaceMaps } from "./roomTextures";

// The vase sits in a room corner: a flat floor running past the fog horizon
// (no visible edge, unlike the old round disc), a back wall, and an east
// side wall. Two walls, not one: with Tokyo's real July sun the low
// morning/evening light comes from the northeast/northwest, so a lone north
// wall would almost never catch the bouquet's shadow — the east wall picks
// up the long afternoon/evening shadows instead, and the back wall takes
// over when the sun sits low in the southern sky (autumn through spring).
const BACK_WALL_Z = -0.4;
const SIDE_WALL_X = 0.55;
const EXTENT_M = 40;

// Plain lit materials, not ShadowMaterial: the shadow is simply where the sun
// does not reach. Lime plaster is pale and matte, so a cast shadow lands on it
// with full contrast; the fine trowel relief only shows up at a raking light.
// The solid cedar floor is warmer and darker, and takes a soft oiled sheen.
const WALL_ROUGHNESS = 0.96;
const WALL_BUMP_SCALE = 0.6;
// Pale surfaces drink in the image-based fill and wash the shadow out, so most
// of their light has to come from the sun itself. These materials hold the
// environment map directly: scene.environmentIntensity ignores envMapIntensity,
// and a material's own envMap ignores scene.environmentIntensity.
const WALL_ENV_SHARE = 0.25;
const FLOOR_ENV_SHARE = 0.5;
const FLOOR_ROUGHNESS = 0.58;
const FLOOR_BUMP_SCALE = 0.5;
const PLASTER_SIZE_PX = 512;
const CEDAR_WIDTH_PX = 1024;
const CEDAR_HEIGHT_PX = 512;
const MAX_ANISOTROPY = 8;

function createWall(material: THREE.Material): THREE.Mesh {
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(EXTENT_M, EXTENT_M / 2), material);
  wall.receiveShadow = true;
  // Deliberately NOT castShadow: the real sun regularly sits behind one
  // wall or the other (northeast at a July sunrise, east all morning), and
  // a shadow-casting wall would black the whole scene out whenever it does.
  return wall;
}

export interface Room {
  group: THREE.Group;
  /** Pale layer over the boards; the scene rig fades its opacity while it snows. */
  snowMaterial: THREE.MeshStandardMaterial;
  /** Follows the day/night curve, as the shared scene.environmentIntensity would. */
  setEnvironmentLevel(level: number): void;
}

/** Snow cover opacity. Tinting cannot whiten a wood map, so it is a separate layer. */
export const SNOW_COVER_OPACITY = 0.78;
const SNOW_COLOR = 0x99a3b3;

export interface RoomSurfaces {
  cedar: SurfacePixels;
  plaster: SurfacePixels;
}

async function runJob(job: SurfaceJob, pause: () => Promise<void>): Promise<SurfacePixels> {
  for (;;) {
    const step = job.next();
    if (step.done) return step.value;
    await pause();
  }
}

/** Generates the surfaces over several tasks; a phone needs hundreds of ms for them. */
export async function generateRoomSurfaces(pause: () => Promise<void>): Promise<RoomSurfaces> {
  const cedar = await runJob(generateCedar(CEDAR_WIDTH_PX, CEDAR_HEIGHT_PX, 3), pause);
  const plaster = await runJob(generatePlaster(PLASTER_SIZE_PX, 5), pause);
  return { cedar, plaster };
}

/** Floor + two-wall corner, all shadow receivers. */
export function createRoom(
  surfaces: RoomSurfaces,
  maxAnisotropy: number,
  environment: THREE.Texture | null,
): Room {
  const group = new THREE.Group();
  const anisotropy = Math.min(MAX_ANISOTROPY, maxAnisotropy);

  const cedar = surfaceMaps(
    surfaces.cedar,
    [EXTENT_M / CEDAR_TILE_LENGTH_M, EXTENT_M / CEDAR_TILE_WIDTH_M],
    anisotropy,
  );
  const floorMaterial = new THREE.MeshStandardMaterial({
    ...cedar,
    bumpScale: FLOOR_BUMP_SCALE,
    envMap: environment,
    roughness: FLOOR_ROUGHNESS,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(EXTENT_M, EXTENT_M), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.0005; // hair below y=0 so the vase base never z-fights
  floor.receiveShadow = true;
  group.add(floor);

  // Always rendered, at opacity 0 unless it snows, so its program is already
  // compiled by the time the first snowfall arrives.
  const snowMaterial = new THREE.MeshStandardMaterial({
    color: SNOW_COLOR,
    roughness: 0.85,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const snow = new THREE.Mesh(floor.geometry, snowMaterial);
  snow.rotation.x = -Math.PI / 2;
  snow.position.y = floor.position.y;
  snow.receiveShadow = true;
  group.add(snow);

  const plaster = surfaceMaps(
    surfaces.plaster,
    [EXTENT_M / PLASTER_TILE_M, EXTENT_M / 2 / PLASTER_TILE_M],
    anisotropy,
  );
  const wallMaterial = new THREE.MeshStandardMaterial({
    ...plaster,
    bumpScale: WALL_BUMP_SCALE,
    envMap: environment,
    roughness: WALL_ROUGHNESS,
  });

  const backWall = createWall(wallMaterial);
  backWall.position.set(0, EXTENT_M / 4, BACK_WALL_Z);
  group.add(backWall);

  const sideWall = createWall(wallMaterial);
  sideWall.rotation.y = -Math.PI / 2;
  sideWall.position.set(SIDE_WALL_X, EXTENT_M / 4, 0);
  group.add(sideWall);

  return {
    group,
    snowMaterial,
    setEnvironmentLevel(level) {
      wallMaterial.envMapIntensity = level * WALL_ENV_SHARE;
      floorMaterial.envMapIntensity = level * FLOOR_ENV_SHARE;
    },
  };
}
