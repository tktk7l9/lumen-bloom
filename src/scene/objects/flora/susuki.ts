import * as THREE from "three";
import { layoutBouquet } from "../../../engine/geometry/flowerLayout";
import { petalGrid } from "../../../engine/geometry/petalGrid";
import { mulberry32 } from "../../../engine/geometry/prng";
import {
  type BloomElement,
  type InstancePose,
  MAX_DEBRIS_INSTANCES,
  addAnimatedInstances,
  addFloorDebris,
  attachBloomCycle,
  orientedPose,
  scaleBloom,
} from "../bloomRig";
import { attachBreeze, gridToGeometry } from "../flowers";

const UP = new THREE.Vector3(0, 1, 0);
const STRANDS_PER_PLUME = 16;
// A closed plume is a tight bundle along the culm; it fans out as it opens.
const STRAND_BUD_FRAC = 0.7;
const LEAF_BUD_FRAC = 0.4;
const STRAND_ROWS = 8;

export interface SusukiOptions {
  /** [plume color, leaf tint] */
  paletteHex: readonly number[];
  stemCount: number;
  seed: number;
  vaseRimYM: number;
  vaseNeckRadiusM: number;
  vaseBaseRadiusM: number;
}

/**
 * One raceme of the plume: two thin tapering ribbons crossed at right
 * angles along the same sagging centerline, so the strand keeps some body
 * from every viewpoint instead of vanishing edge-on. Local +Y is the
 * length axis, the sag goes toward −Z (petal-grid convention).
 */
function createStrandGeometry(baseHex: number, tipHex: number): THREE.BufferGeometry {
  const widthM = 0.045;
  const bendM = 0.55;
  const base = new THREE.Color(baseHex);
  const tip = new THREE.Color(tipHex);
  const scratch = new THREE.Color();
  const positions: number[] = [];
  const colors: number[] = [];
  const index: number[] = [];
  for (let ribbon = 0; ribbon < 2; ribbon++) {
    const offset = positions.length / 3;
    for (let iu = 0; iu <= STRAND_ROWS; iu++) {
      const t = iu / STRAND_ROWS;
      const half = (widthM * Math.sin(Math.PI * (0.12 + 0.88 * t))) / 2;
      const y = t;
      const z = -bendM * t * t;
      scratch.copy(base).lerp(tip, t);
      for (const s of [-1, 1]) {
        if (ribbon === 0) positions.push(s * half, y, z);
        else positions.push(0, y, z + s * half);
        colors.push(scratch.r, scratch.g, scratch.b);
      }
      if (iu > 0) {
        const a = offset + (iu - 1) * 2;
        index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Japanese pampas grass (susuki): tall thin culms, each ending in a plume
 * of silvery racemes that fan out and nod to one side, with long arching
 * grass blades lower down.
 */
export function createSusukiGroup(opts: SusukiOptions): THREE.Group {
  const stems = layoutBouquet({ ...opts, droopScale: 0.45, freeLengthScale: 1.5 });
  const group = new THREE.Group();
  const stemGroups: THREE.Group[] = [];
  const rand = mulberry32(opts.seed + 601);
  const bloomElements: BloomElement[] = [];

  const plumeHex = opts.paletteHex[0] ?? 0xe4d8bc;
  const stemMaterial = new THREE.MeshStandardMaterial({ color: 0xa8a05e, roughness: 0.8 });
  const strandGeometry = createStrandGeometry(
    new THREE.Color(plumeHex).multiplyScalar(0.82).getHex(),
    new THREE.Color(plumeHex).lerp(new THREE.Color(0xffffff), 0.35).getHex(),
  );
  const strandMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.9,
    side: THREE.DoubleSide,
  });
  const leafGeometry = gridToGeometry(
    petalGrid({ lengthM: 1, widthM: 0.05, segmentsU: 8, segmentsV: 2, cupM: 0.01, bendM: 0.45 }),
    0x6f8a3e,
    0xb5ab6a,
  );
  const leafMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.75,
    side: THREE.DoubleSide,
  });

  const radial = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const color = new THREE.Color();

  for (const stem of stems) {
    const stemGroup = new THREE.Group();
    const curve = new THREE.CatmullRomCurve3(
      stem.controlPoints.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    );
    const stemMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.0015, 5, false), stemMaterial);
    stemMesh.castShadow = true;
    stemGroup.add(stemMesh);

    // Long blades arching out and down from the lower culm.
    for (const leaf of stem.leaves) {
      const az = (leaf.azimuthDeg * Math.PI) / 180;
      dir.set(Math.cos(az) * 0.75, 0.65, Math.sin(az) * 0.75);
      const length = leaf.lengthM * 2;
      const pose = orientedPose(curve.getPointAt(leaf.t), dir, UP, new THREE.Vector3(0.28, length, length));
      const mesh = new THREE.Mesh(leafGeometry, leafMaterial);
      mesh.castShadow = true;
      mesh.position.copy(pose.position);
      mesh.quaternion.copy(pose.quaternion);
      mesh.scale.copy(pose.scale);
      stemGroup.add(mesh);
      bloomElements.push(
        scaleBloom(mesh, pose.scale.clone().multiplyScalar(LEAF_BUD_FRAC), pose.scale, rand()),
      );
    }

    // The plume: strands leave the last few centimeters of the culm, fan
    // out around its direction and sag under their own weight.
    const tip = curve.getPointAt(1);
    const tangent = curve.getTangentAt(0.99).normalize();
    const u = new THREE.Vector3().crossVectors(UP, tangent).normalize();
    const v = new THREE.Vector3().crossVectors(tangent, u);
    const strands = new THREE.InstancedMesh(strandGeometry, strandMaterial, STRANDS_PER_PLUME);
    strands.castShadow = true;
    const openPoses: InstancePose[] = [];
    const budPoses: InstancePose[] = [];
    const shedAt = new Float32Array(STRANDS_PER_PLUME);
    for (let k = 0; k < STRANDS_PER_PLUME; k++) {
      const a = k * 2.399963 + rand() * 0.4; // golden angle: an even fan
      radial.copy(u).multiplyScalar(Math.cos(a)).addScaledVector(v, Math.sin(a));
      const origin = tip.clone().addScaledVector(tangent, -(k / STRANDS_PER_PLUME) * 0.035);
      const length = 0.075 + rand() * 0.04;
      dir.copy(tangent).addScaledVector(radial, 0.18 + rand() * 0.22);
      openPoses.push(orientedPose(origin, dir, UP, length));
      dir.copy(tangent).addScaledVector(radial, 0.04);
      budPoses.push(orientedPose(origin, dir, UP, length * STRAND_BUD_FRAC));
      shedAt[k] = rand();
      color.setHex(0xffffff).offsetHSL(0, 0, (rand() - 0.5) * 0.08);
      strands.setColorAt(k, color);
    }
    if (strands.instanceColor) strands.instanceColor.needsUpdate = true;
    stemGroup.add(strands);
    bloomElements.push(addAnimatedInstances(strands, openPoses, budPoses, shedAt));

    group.add(stemGroup);
    stemGroups.push(stemGroup);
  }

  bloomElements.push(
    addFloorDebris(group, {
      geometry: strandGeometry,
      material: strandMaterial,
      count: Math.min(MAX_DEBRIS_INSTANCES, stems.length * 8),
      sizeM: 0.05,
      radiusM: { min: opts.vaseBaseRadiusM * 1.15, max: opts.vaseBaseRadiusM * 2.4 },
      rand,
    }),
  );
  bloomElements.push(
    addFloorDebris(group, {
      geometry: leafGeometry,
      material: leafMaterial,
      count: Math.min(MAX_DEBRIS_INSTANCES, stems.length * 3),
      sizeM: 0.12,
      radiusM: { min: opts.vaseBaseRadiusM * 1.15, max: opts.vaseBaseRadiusM * 2.4 },
      rand,
    }),
  );

  attachBreeze(group, stemGroups);
  attachBloomCycle(group, bloomElements);
  return group;
}
