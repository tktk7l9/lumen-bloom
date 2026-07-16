import * as THREE from "three";
import { layoutBouquet } from "../../../engine/geometry/flowerLayout";
import { petalGrid } from "../../../engine/geometry/petalGrid";
import { mulberry32 } from "../../../engine/geometry/prng";
import {
  type BloomElement,
  MAX_DEBRIS_INSTANCES,
  addAnimatedRadialRing,
  addFloorDebris,
  attachBloomCycle,
  scaleBloom,
} from "../bloomRig";
import { attachBreeze, gridToGeometry } from "../flowers";

const UP = new THREE.Vector3(0, 1, 0);
const LEAF_BUD_FRAC = 0.4;

export interface TulipOptions {
  paletteHex: readonly number[];
  stemCount: number;
  seed: number;
  vaseRimYM: number;
  vaseNeckRadiusM: number;
  vaseBaseRadiusM: number;
}

/** Cup-shaped six-petal tulips; heads face mostly upward. */
export function createTulipsGroup(opts: TulipOptions): THREE.Group {
  const stems = layoutBouquet(opts);
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
  const rand = mulberry32(opts.seed + 601);
  const bloomElements: BloomElement[] = [];

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
      const openScale = mesh.scale.clone();
      bloomElements.push(
        scaleBloom(mesh, openScale.clone().multiplyScalar(LEAF_BUD_FRAC), openScale, rand()),
      );
    }

    // Tulip heads face mostly upward regardless of the stem's lean.
    const head = new THREE.Group();
    head.position.set(...stem.headPosition);
    const [dx, , dz] = stem.headDirection;
    head.quaternion.setFromUnitVectors(UP, new THREE.Vector3(dx * 0.3, 1, dz * 0.3).normalize());

    const cupR = stem.headRadiusM * 0.28;
    const petalLen = stem.headRadiusM * 0.62;
    const tint = new THREE.Color(
      opts.paletteHex[Math.floor(stem.colorSeed * opts.paletteHex.length)] ?? 0xd7443e,
    );
    const innerTint = tint.clone().multiplyScalar(0.9);

    // Two offset rings of three near-vertical petals form the closed cup.
    bloomElements.push(
      addAnimatedRadialRing(head, petalGeometry, petalMaterial, {
        count: 3,
        ringRadius: cupR * 0.55,
        ringY: 0,
        tiltDeg: 78,
        lengthM: petalLen,
        angleOffsetRad: 0,
        tint: innerTint,
        rand,
      }),
    );
    bloomElements.push(
      addAnimatedRadialRing(head, petalGeometry, petalMaterial, {
        count: 3,
        ringRadius: cupR * 0.75,
        ringY: -0.003,
        tiltDeg: 68,
        lengthM: petalLen,
        angleOffsetRad: Math.PI / 3,
        tint,
        rand,
      }),
    );

    const pistil = new THREE.Mesh(new THREE.SphereGeometry(cupR * 0.3, 8, 6), pistilMaterial);
    pistil.position.y = 0.004;
    head.add(pistil);
    bloomElements.push(scaleBloom(pistil, 0.3, 1));

    stemGroup.add(head);
    group.add(stemGroup);
    stemGroups.push(stemGroup);
  }

  const avgHeadRadiusM = stems.reduce((sum, s) => sum + s.headRadiusM, 0) / stems.length;
  bloomElements.push(
    addFloorDebris(group, {
      geometry: petalGeometry,
      material: petalMaterial,
      count: Math.min(MAX_DEBRIS_INSTANCES, stems.length * 20),
      sizeM: avgHeadRadiusM * 0.62 * 0.5,
      radiusM: { min: opts.vaseBaseRadiusM * 1.15, max: opts.vaseBaseRadiusM * 2.4 },
      rand,
      tint: new THREE.Color(opts.paletteHex[0] ?? 0xd7443e),
    }),
  );
  bloomElements.push(
    addFloorDebris(group, {
      geometry: leafGeometry,
      material: leafMaterial,
      count: Math.min(MAX_DEBRIS_INSTANCES, stems.length * 6),
      sizeM: 0.09,
      radiusM: { min: opts.vaseBaseRadiusM * 1.15, max: opts.vaseBaseRadiusM * 2.4 },
      rand,
    }),
  );

  attachBreeze(group, stemGroups);
  attachBloomCycle(group, bloomElements);
  return group;
}
