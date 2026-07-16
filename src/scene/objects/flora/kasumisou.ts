import * as THREE from "three";
import { layoutBouquet } from "../../../engine/geometry/flowerLayout";
import { mulberry32 } from "../../../engine/geometry/prng";
import {
  type BloomElement,
  type InstancePose,
  MAX_DEBRIS_INSTANCES,
  addAnimatedInstances,
  addFloorDebris,
  attachBloomCycle,
} from "../bloomRig";
import { attachBreeze } from "../flowers";

const DOTS_PER_STEM = 30;
const BUD_SCALE_FRAC = 0.35;

export interface KasumisouOptions {
  paletteHex: readonly number[];
  stemCount: number;
  seed: number;
  vaseRimYM: number;
  vaseNeckRadiusM: number;
  vaseBaseRadiusM: number;
}

/** A mist of tiny white dots hovering in a cloud over hair-thin stems. */
export function createKasumisouGroup(opts: KasumisouOptions): THREE.Group {
  const stems = layoutBouquet(opts);
  const group = new THREE.Group();
  const stemGroups: THREE.Group[] = [];
  const rand = mulberry32(opts.seed + 71);

  const stemMaterial = new THREE.MeshStandardMaterial({ color: 0x6b8258, roughness: 0.75 });
  const dotGeometry = new THREE.SphereGeometry(1, 5, 4);
  const dotMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75 });

  const color = new THREE.Color();
  const tint = new THREE.Color(opts.paletteHex[0] ?? 0xf5f4ee);
  const identity = new THREE.Quaternion();
  const bloomElements: BloomElement[] = [];

  for (const stem of stems) {
    const stemGroup = new THREE.Group();
    const curve = new THREE.CatmullRomCurve3(
      stem.controlPoints.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    );
    const stemMesh = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 20, 0.0012, 5, false),
      stemMaterial,
    );
    stemMesh.castShadow = true;
    stemGroup.add(stemMesh);

    // The cloud: dots scattered in a flattened sphere around the stem tip,
    // denser toward the center like a real gypsophila spray.
    const tip = curve.getPointAt(1);
    const cloudR = stem.headRadiusM * 0.55;
    const dots = new THREE.InstancedMesh(dotGeometry, dotMaterial, DOTS_PER_STEM);
    dots.castShadow = true;
    const openPoses: InstancePose[] = [];
    const budPoses: InstancePose[] = [];
    const shedAt = new Float32Array(DOTS_PER_STEM);
    for (let k = 0; k < DOTS_PER_STEM; k++) {
      const r = cloudR * Math.sqrt(rand());
      const theta = rand() * Math.PI * 2;
      const phi = Math.acos(2 * rand() - 1);
      const s = 0.0016 + rand() * 0.0012;
      const position = new THREE.Vector3(
        tip.x + r * Math.sin(phi) * Math.cos(theta),
        tip.y + r * Math.cos(phi) * 0.75,
        tip.z + r * Math.sin(phi) * Math.sin(theta),
      );
      openPoses.push({ position, quaternion: identity, scale: new THREE.Vector3(s, s, s) });
      budPoses.push({
        position,
        quaternion: identity,
        scale: new THREE.Vector3(s, s, s).multiplyScalar(BUD_SCALE_FRAC),
      });
      shedAt[k] = rand();
      color.copy(tint).offsetHSL(0, 0, (rand() - 0.5) * 0.06);
      dots.setColorAt(k, color);
    }
    if (dots.instanceColor) dots.instanceColor.needsUpdate = true;
    stemGroup.add(dots);
    bloomElements.push(addAnimatedInstances(dots, openPoses, budPoses, shedAt));

    group.add(stemGroup);
    stemGroups.push(stemGroup);
  }

  const avgHeadRadiusM = stems.reduce((sum, s) => sum + s.headRadiusM, 0) / stems.length;
  bloomElements.push(
    addFloorDebris(group, {
      geometry: dotGeometry,
      material: dotMaterial,
      count: Math.min(MAX_DEBRIS_INSTANCES, stems.length * 20),
      sizeM: avgHeadRadiusM * 0.04,
      radiusM: { min: opts.vaseBaseRadiusM * 1.15, max: opts.vaseBaseRadiusM * 2.4 },
      rand,
      tint,
    }),
  );

  attachBreeze(group, stemGroups);
  attachBloomCycle(group, bloomElements);
  return group;
}
