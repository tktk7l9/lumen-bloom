import * as THREE from "three";
import { layoutBouquet } from "../../../engine/geometry/flowerLayout";
import { mulberry32 } from "../../../engine/geometry/prng";
import { petalGrid } from "../../../engine/geometry/petalGrid";
import {
  type BloomElement,
  type InstancePose,
  MAX_DEBRIS_INSTANCES,
  addAnimatedInstances,
  addFloorDebris,
  attachBloomCycle,
  scaleBloom,
} from "../bloomRig";
import { attachBreeze, gridToGeometry } from "../flowers";

const UP = new THREE.Vector3(0, 1, 0);
const BUDS_PER_SPIKE = 22;
// Buds have no petal to angle open — they swell in place instead, each on
// its own seeded position along the spike (organic filling-out, not one
// rigid whole-head scale-up).
const BUD_SCALE_FRAC = 0.35;
const LEAF_BUD_FRAC = 0.4;

export interface LavenderOptions {
  paletteHex: readonly number[];
  stemCount: number;
  seed: number;
  vaseRimYM: number;
  vaseNeckRadiusM: number;
  vaseBaseRadiusM: number;
}

/** Slender stems ending in spikes of tiny purple buds. */
export function createLavenderGroup(opts: LavenderOptions): THREE.Group {
  const stems = layoutBouquet(opts);
  const group = new THREE.Group();
  const stemGroups: THREE.Group[] = [];
  const rand = mulberry32(opts.seed + 51);

  const stemMaterial = new THREE.MeshStandardMaterial({ color: 0x5f7a52, roughness: 0.75 });
  const budGeometry = new THREE.SphereGeometry(1, 6, 5);
  const budMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.65 });
  const leafGeometry = gridToGeometry(
    petalGrid({ lengthM: 1, widthM: 0.1, segmentsU: 6, segmentsV: 3, cupM: 0, bendM: 0.15 }),
    0x5b7355,
    0x779370,
  );
  const leafMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.7,
    side: THREE.DoubleSide,
  });

  const color = new THREE.Color();
  const bloomElements: BloomElement[] = [];

  for (const stem of stems) {
    const stemGroup = new THREE.Group();
    const curve = new THREE.CatmullRomCurve3(
      stem.controlPoints.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    );
    const stemMesh = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 20, 0.0016, 5, false),
      stemMaterial,
    );
    stemMesh.castShadow = true;
    stemGroup.add(stemMesh);

    for (const leaf of stem.leaves) {
      const mesh = new THREE.Mesh(leafGeometry, leafMaterial);
      mesh.castShadow = true;
      mesh.position.copy(curve.getPointAt(leaf.t));
      mesh.scale.setScalar(leaf.lengthM * 0.55);
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

    // The spike rides the last stretch of the stem and a little beyond it.
    const tint = new THREE.Color(
      opts.paletteHex[Math.floor(stem.colorSeed * opts.paletteHex.length)] ?? 0x8a76c9,
    );
    const buds = new THREE.InstancedMesh(budGeometry, budMaterial, BUDS_PER_SPIKE);
    buds.castShadow = true;
    const tip = curve.getPointAt(1);
    const tangent = curve.getTangentAt(0.98).normalize();
    const openPoses: InstancePose[] = [];
    const budPoses: InstancePose[] = [];
    const shedAt = new Float32Array(BUDS_PER_SPIKE);
    const identity = new THREE.Quaternion();
    for (let k = 0; k < BUDS_PER_SPIKE; k++) {
      const along = (k / BUDS_PER_SPIKE) * 0.05 - 0.012;
      const jitterR = 0.0022 + rand() * 0.0012;
      const a = rand() * Math.PI * 2;
      const s = 0.0022 + rand() * 0.0008;
      const position = new THREE.Vector3(
        tip.x + tangent.x * along + Math.cos(a) * jitterR,
        tip.y + tangent.y * along + (rand() - 0.5) * 0.002,
        tip.z + tangent.z * along + Math.sin(a) * jitterR,
      );
      openPoses.push({ position, quaternion: identity, scale: new THREE.Vector3(s, s * 1.5, s) });
      budPoses.push({
        position,
        quaternion: identity,
        scale: new THREE.Vector3(s, s * 1.5, s).multiplyScalar(BUD_SCALE_FRAC),
      });
      shedAt[k] = rand();
      color.copy(tint).offsetHSL(0, 0, (rand() - 0.5) * 0.08);
      buds.setColorAt(k, color);
    }
    if (buds.instanceColor) buds.instanceColor.needsUpdate = true;
    stemGroup.add(buds);
    bloomElements.push(addAnimatedInstances(buds, openPoses, budPoses, shedAt));

    group.add(stemGroup);
    stemGroups.push(stemGroup);
  }

  const avgHeadRadiusM = stems.reduce((sum, s) => sum + s.headRadiusM, 0) / stems.length;
  bloomElements.push(
    addFloorDebris(group, {
      geometry: budGeometry,
      material: budMaterial,
      count: Math.min(MAX_DEBRIS_INSTANCES, stems.length * 20),
      sizeM: avgHeadRadiusM * 0.06,
      radiusM: { min: opts.vaseBaseRadiusM * 1.15, max: opts.vaseBaseRadiusM * 2.4 },
      rand,
      tint: new THREE.Color(opts.paletteHex[0] ?? 0x8a76c9),
    }),
  );
  bloomElements.push(
    addFloorDebris(group, {
      geometry: leafGeometry,
      material: leafMaterial,
      count: Math.min(MAX_DEBRIS_INSTANCES, stems.length * 6),
      sizeM: 0.04,
      radiusM: { min: opts.vaseBaseRadiusM * 1.15, max: opts.vaseBaseRadiusM * 2.4 },
      rand,
    }),
  );

  attachBreeze(group, stemGroups);
  attachBloomCycle(group, bloomElements);
  return group;
}
