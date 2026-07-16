import * as THREE from "three";
import { layoutBouquet } from "../../../engine/geometry/flowerLayout";
import { mulberry32 } from "../../../engine/geometry/prng";
import { petalGrid } from "../../../engine/geometry/petalGrid";
import { phyllotaxis } from "../../../engine/geometry/phyllotaxis";
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
const FLORETS_PER_HEAD = 42;
const LEAF_BUD_FRAC = 0.4;
// How much a bud floret's petals lean toward the center normal (closed,
// pointing straight up off the dome) vs splayed flat in the open pose —
// same u/v/n mixing the built shape already uses, just weighted differently.
const BUD_SPLAY_WEIGHT = 0.22;
const BUD_AXIS_WEIGHT = 0.97;
const OPEN_SPLAY_WEIGHT = 0.92;
const OPEN_AXIS_WEIGHT = 0.4;
const BUD_LENGTH_FRAC = 0.4;

export interface HydrangeaOptions {
  paletteHex: readonly number[];
  stemCount: number;
  seed: number;
  vaseRimYM: number;
  vaseNeckRadiusM: number;
  vaseBaseRadiusM: number;
}

/** Dome heads of dozens of little four-petal florets in blue-purple. */
export function createHydrangeaGroup(opts: HydrangeaOptions): THREE.Group {
  const stems = layoutBouquet(opts);
  const group = new THREE.Group();
  const stemGroups: THREE.Group[] = [];
  const rand = mulberry32(opts.seed + 101);

  const stemMaterial = new THREE.MeshStandardMaterial({ color: 0x44652c, roughness: 0.75 });
  const petalGeometry = gridToGeometry(
    petalGrid({ lengthM: 1, widthM: 0.78, segmentsU: 5, segmentsV: 4, cupM: 0.08, bendM: 0 }),
    0xc4c4c4,
    0xffffff,
  );
  const petalMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.6,
    side: THREE.DoubleSide,
  });
  const leafGeometry = gridToGeometry(
    petalGrid({ lengthM: 1, widthM: 0.85, segmentsU: 8, segmentsV: 6, cupM: -0.07, bendM: 0.28 }),
    0x2c4a1c,
    0x437024,
  );
  const leafMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.68,
    side: THREE.DoubleSide,
  });

  const matrix = new THREE.Matrix4();
  const dir = new THREE.Vector3();
  const side = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const color = new THREE.Color();
  const bloomElements: BloomElement[] = [];

  function petalPose(u: THREE.Vector3, v: THREE.Vector3, n: THREE.Vector3, a: number, splay: number, axis: number, length: number, center: THREE.Vector3): InstancePose {
    dir
      .copy(u)
      .multiplyScalar(Math.cos(a))
      .addScaledVector(v, Math.sin(a))
      .multiplyScalar(splay)
      .addScaledVector(n, axis)
      .normalize();
    side.crossVectors(n, dir).normalize();
    normal.crossVectors(side, dir);
    matrix.makeBasis(side, dir, normal);
    return {
      position: center.clone(),
      quaternion: new THREE.Quaternion().setFromRotationMatrix(matrix),
      scale: new THREE.Vector3(length, length, length),
    };
  }

  for (const stem of stems) {
    const stemGroup = new THREE.Group();
    const curve = new THREE.CatmullRomCurve3(
      stem.controlPoints.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    );
    const stemMesh = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 20, 0.005, 8, false),
      stemMaterial,
    );
    stemMesh.castShadow = true;
    stemGroup.add(stemMesh);

    for (const leaf of stem.leaves) {
      const mesh = new THREE.Mesh(leafGeometry, leafMaterial);
      mesh.castShadow = true;
      mesh.position.copy(curve.getPointAt(leaf.t));
      mesh.scale.setScalar(leaf.lengthM * 1.15);
      const az = (leaf.azimuthDeg * Math.PI) / 180;
      const d = new THREE.Vector3(Math.cos(az) * 0.8, -0.25, Math.sin(az) * 0.8).normalize();
      const s = new THREE.Vector3().crossVectors(UP, d).normalize();
      const n = new THREE.Vector3().crossVectors(s, d);
      mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(s, d, n));
      stemGroup.add(mesh);
      const openScale = mesh.scale.clone();
      bloomElements.push(
        scaleBloom(mesh, openScale.clone().multiplyScalar(LEAF_BUD_FRAC), openScale, rand()),
      );
    }

    const head = new THREE.Group();
    head.position.set(...stem.headPosition);
    const [hx, hy, hz] = stem.headDirection;
    head.quaternion.setFromUnitVectors(
      UP,
      new THREE.Vector3(hx * 0.6, Math.max(hy, 0) + 0.8, hz * 0.6).normalize(),
    );

    const R = stem.headRadiusM * 0.62;
    const headTint = new THREE.Color(
      opts.paletteHex[Math.floor(stem.colorSeed * opts.paletteHex.length)] ?? 0x7d8fd1,
    );

    // Florets on the upper hemisphere: phyllotaxis on the unit disc lifted
    // to the dome, four petals splayed around each floret's surface normal.
    const florets = new THREE.InstancedMesh(
      petalGeometry,
      petalMaterial,
      FLORETS_PER_HEAD * 4,
    );
    florets.castShadow = true;
    let instance = 0;
    const openPoses: InstancePose[] = [];
    const budPoses: InstancePose[] = [];
    const shedAt = new Float32Array(FLORETS_PER_HEAD * 4);
    for (const [px, pz] of phyllotaxis(FLORETS_PER_HEAD, 1)) {
      const rr = Math.min(0.98, Math.hypot(px, pz));
      const ny = Math.sqrt(Math.max(0, 1 - rr * rr));
      const n = new THREE.Vector3(px, ny, pz).normalize();
      const center = n.clone().multiplyScalar(R);
      const u = new THREE.Vector3()
        .crossVectors(Math.abs(n.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : UP, n)
        .normalize();
      const v = new THREE.Vector3().crossVectors(n, u);
      const spin = rand() * Math.PI;
      const petalLen = R * (0.32 + rand() * 0.08);
      color.copy(headTint).offsetHSL((rand() - 0.5) * 0.03, 0, (rand() - 0.5) * 0.1);
      for (let k = 0; k < 4; k++) {
        const a = spin + (k / 4) * Math.PI * 2;
        openPoses.push(
          petalPose(u, v, n, a, OPEN_SPLAY_WEIGHT, OPEN_AXIS_WEIGHT, petalLen, center),
        );
        budPoses.push(
          petalPose(
            u,
            v,
            n,
            a,
            BUD_SPLAY_WEIGHT,
            BUD_AXIS_WEIGHT,
            petalLen * BUD_LENGTH_FRAC,
            center,
          ),
        );
        shedAt[instance] = rand();
        florets.setColorAt(instance, color);
        instance++;
      }
    }
    if (florets.instanceColor) florets.instanceColor.needsUpdate = true;
    head.add(florets);
    bloomElements.push(addAnimatedInstances(florets, openPoses, budPoses, shedAt));

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
      sizeM: avgHeadRadiusM * 0.62 * 0.32,
      radiusM: { min: opts.vaseBaseRadiusM * 1.15, max: opts.vaseBaseRadiusM * 2.4 },
      rand,
      tint: new THREE.Color(opts.paletteHex[0] ?? 0x7d8fd1),
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
