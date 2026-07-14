import * as THREE from "three";

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

// Plain lit materials, not ShadowMaterial: this scene is often dark, so a
// shadow that only darkens (assuming a bright default surface) is invisible
// against a background that's already near-black. Dim surfaces that brighten
// where the sun actually hits them — and simply stay dim where shadowed —
// read instead. The walls sit lighter than the floor so the cast shadow has
// contrast to land on.
const FLOOR_COLOR = 0x252c3a;
const WALL_COLOR = 0x49536a;

function createWall(): THREE.Mesh {
  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(EXTENT_M, EXTENT_M / 2),
    new THREE.MeshStandardMaterial({ color: WALL_COLOR, roughness: 0.9 }),
  );
  wall.receiveShadow = true;
  // Deliberately NOT castShadow: the real sun regularly sits behind one
  // wall or the other (northeast at a July sunrise, east all morning), and
  // a shadow-casting wall would black the whole scene out whenever it does.
  return wall;
}

/** Floor + two-wall corner, all shadow receivers. */
export function createRoom(): THREE.Group {
  const group = new THREE.Group();

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(EXTENT_M, EXTENT_M),
    new THREE.MeshStandardMaterial({ color: FLOOR_COLOR, roughness: 0.85 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.0005; // hair below y=0 so the vase base never z-fights
  floor.receiveShadow = true;
  group.add(floor);

  const backWall = createWall();
  backWall.position.set(0, EXTENT_M / 4, BACK_WALL_Z);
  group.add(backWall);

  const sideWall = createWall();
  sideWall.rotation.y = -Math.PI / 2;
  sideWall.position.set(SIDE_WALL_X, EXTENT_M / 4, 0);
  group.add(sideWall);

  return group;
}
