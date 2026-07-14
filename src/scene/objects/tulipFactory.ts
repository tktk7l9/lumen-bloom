import * as THREE from "three";
import { type BouquetOptions, layoutBouquet } from "../../engine/geometry/flowerLayout";
import { petalGrid } from "../../engine/geometry/petalGrid";
import { DEFAULT_VASE_PROFILE } from "../../engine/geometry/vaseProfile";
import { addRadialRing, attachBreeze, gridToGeometry } from "./flowers";
import { registerSceneObject } from "./registry";
import { createVaseGroup } from "./vase";

export const TULIP_OBJECT_ID = "vase-tulips";

const UP = new THREE.Vector3(0, 1, 0);
const PALETTE = [0xd7443e, 0xe86fa4, 0xf2b93d, 0x9a5fc2];

function createTulipsGroup(opts?: Partial<BouquetOptions>): THREE.Group {
  const stems = layoutBouquet({ stemCount: 5, seed: 8, ...opts });
  const group = new THREE.Group();
  const stemGroups: THREE.Group[] = [];

  const stemMaterial = new THREE.MeshStandardMaterial({ color: 0x577f3a, roughness: 0.75 });
  // Near-white gradient baked into the geometry; per-instance tint supplies
  // the actual petal color (instanceColor multiplies vertex color).
  const petalGeometry = gridToGeometry(
    petalGrid({ lengthM: 1, widthM: 0.55, segmentsU: 8, segmentsV: 6, cupM: 0.24, bendM: -0.12 }),
    0xb8b8b8,
    0xffffff,
  );
  const petalMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.55,
    side: THREE.DoubleSide,
  });
  const leafGeometry = gridToGeometry(
    petalGrid({ lengthM: 1, widthM: 0.5, segmentsU: 10, segmentsV: 6, cupM: -0.08, bendM: 0.3 }),
    0x33541d,
    0x4d7c2b,
  );
  const leafMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.7,
    side: THREE.DoubleSide,
  });
  const pistilMaterial = new THREE.MeshStandardMaterial({ color: 0x3a3210, roughness: 0.8 });

  for (const stem of stems) {
    const stemGroup = new THREE.Group();
    const curve = new THREE.CatmullRomCurve3(
      stem.controlPoints.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    );
    const stemMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.004, 8, false), stemMaterial);
    stemMesh.castShadow = true;
    stemGroup.add(stemMesh);

    for (const leaf of stem.leaves) {
      const mesh = new THREE.Mesh(leafGeometry, leafMaterial);
      mesh.castShadow = true;
      mesh.position.copy(curve.getPointAt(leaf.t));
      mesh.scale.setScalar(leaf.lengthM * 1.2);
      const az = (leaf.azimuthDeg * Math.PI) / 180;
      const dir = new THREE.Vector3(Math.cos(az) * 0.6, 0.5, Math.sin(az) * 0.6).normalize();
      const side = new THREE.Vector3().crossVectors(UP, dir).normalize();
      const normal = new THREE.Vector3().crossVectors(side, dir);
      mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(side, dir, normal));
      stemGroup.add(mesh);
    }

    // Tulip heads face mostly upward regardless of the stem's lean.
    const head = new THREE.Group();
    head.position.set(...stem.headPosition);
    const [dx, , dz] = stem.headDirection;
    head.quaternion.setFromUnitVectors(
      UP,
      new THREE.Vector3(dx * 0.3, 1, dz * 0.3).normalize(),
    );

    const cupR = stem.headRadiusM * 0.28;
    const petalLen = stem.headRadiusM * 0.62;
    const tint = new THREE.Color(PALETTE[Math.floor(stem.colorSeed * PALETTE.length)]);
    const innerTint = tint.clone().multiplyScalar(0.9);

    // Two offset rings of three near-vertical petals form the closed cup.
    addRadialRing(head, petalGeometry, petalMaterial, {
      count: 3,
      ringRadius: cupR * 0.55,
      ringY: 0,
      tiltDeg: 78,
      lengthM: petalLen,
      angleOffsetRad: 0,
      tint: innerTint,
    });
    addRadialRing(head, petalGeometry, petalMaterial, {
      count: 3,
      ringRadius: cupR * 0.75,
      ringY: -0.003,
      tiltDeg: 68,
      lengthM: petalLen,
      angleOffsetRad: Math.PI / 3,
      tint,
    });

    const pistil = new THREE.Mesh(new THREE.SphereGeometry(cupR * 0.3, 8, 6), pistilMaterial);
    pistil.position.y = 0.004;
    head.add(pistil);

    stemGroup.add(head);
    group.add(stemGroup);
    stemGroups.push(stemGroup);
  }

  attachBreeze(group, stemGroups);
  return group;
}

registerSceneObject({
  id: TULIP_OBJECT_ID,
  displayName: "花瓶とチューリップ",
  create(): THREE.Group {
    const group = new THREE.Group();
    group.add(createVaseGroup());
    const tulips = createTulipsGroup({
      vaseRimYM: DEFAULT_VASE_PROFILE.heightM,
      vaseNeckRadiusM: DEFAULT_VASE_PROFILE.neckRadiusM,
    });
    group.add(tulips);
    group.userData.update = tulips.userData.update;
    return group;
  },
});
