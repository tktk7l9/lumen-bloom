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

export interface NarcissusOptions {
  /** [petal white, trumpet yellow] */
  paletteHex: readonly number[];
  stemCount: number;
  seed: number;
  vaseRimYM: number;
  vaseNeckRadiusM: number;
  vaseBaseRadiusM: number;
}

/** Trumpet lathe: a small flaring cup, opening along +Y. */
function createTrumpetGeometry(): THREE.LatheGeometry {
  const profile = [
    new THREE.Vector2(0.02, 0),
    new THREE.Vector2(0.3, 0.05),
    new THREE.Vector2(0.36, 0.45),
    new THREE.Vector2(0.5, 0.9),
    new THREE.Vector2(0.62, 1.0),
  ];
  return new THREE.LatheGeometry(profile, 14);
}

/** Six white petals around a yellow trumpet, nodding on slender stems. */
export function createNarcissusGroup(opts: NarcissusOptions): THREE.Group {
  const stems = layoutBouquet(opts);
  const group = new THREE.Group();
  const stemGroups: THREE.Group[] = [];

  const stemMaterial = new THREE.MeshStandardMaterial({ color: 0x51713a, roughness: 0.75 });
  const petalGeometry = gridToGeometry(
    petalGrid({ lengthM: 1, widthM: 0.5, segmentsU: 6, segmentsV: 5, cupM: 0.08, bendM: 0.03 }),
    0xcfcfc6,
    0xffffff,
  );
  const petalMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.55,
    side: THREE.DoubleSide,
  });
  const trumpetGeometry = createTrumpetGeometry();
  const trumpetMaterial = new THREE.MeshStandardMaterial({
    color: opts.paletteHex[1] ?? 0xe8b93a,
    roughness: 0.6,
    side: THREE.DoubleSide,
  });
  // Narcissus leaves are strap-like blades from the base.
  const leafGeometry = gridToGeometry(
    petalGrid({ lengthM: 1, widthM: 0.14, segmentsU: 8, segmentsV: 3, cupM: 0, bendM: 0.2 }),
    0x3d5c2b,
    0x527a38,
  );
  const leafMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.7,
    side: THREE.DoubleSide,
  });

  const petalTint = new THREE.Color(opts.paletteHex[0] ?? 0xf4f2ea);
  const rand = mulberry32(opts.seed + 601);
  const bloomElements: BloomElement[] = [];

  for (const stem of stems) {
    const stemGroup = new THREE.Group();
    const curve = new THREE.CatmullRomCurve3(
      stem.controlPoints.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    );
    const stemMesh = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 20, 0.003, 6, false),
      stemMaterial,
    );
    stemMesh.castShadow = true;
    stemGroup.add(stemMesh);

    for (const leaf of stem.leaves) {
      const mesh = new THREE.Mesh(leafGeometry, leafMaterial);
      mesh.castShadow = true;
      mesh.position.copy(curve.getPointAt(leaf.t));
      mesh.scale.setScalar(leaf.lengthM * 1.3);
      const az = (leaf.azimuthDeg * Math.PI) / 180;
      const dir = new THREE.Vector3(Math.cos(az) * 0.5, 0.75, Math.sin(az) * 0.5).normalize();
      const side = new THREE.Vector3().crossVectors(UP, dir).normalize();
      const normal = new THREE.Vector3().crossVectors(side, dir);
      mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(side, dir, normal));
      stemGroup.add(mesh);
      const openScale = mesh.scale.clone();
      bloomElements.push(
        scaleBloom(mesh, openScale.clone().multiplyScalar(LEAF_BUD_FRAC), openScale, rand()),
      );
    }

    // Face along the layout's nod — narcissus famously look slightly down.
    const head = new THREE.Group();
    head.position.set(...stem.headPosition);
    head.quaternion.setFromUnitVectors(UP, new THREE.Vector3(...stem.headDirection));

    const R = stem.headRadiusM * 0.32;

    bloomElements.push(
      addAnimatedRadialRing(head, petalGeometry, petalMaterial, {
        count: 6,
        ringRadius: R * 0.28,
        ringY: 0,
        tiltDeg: 22,
        lengthM: R,
        angleOffsetRad: stem.colorSeed * Math.PI,
        tint: petalTint,
        rand,
      }),
    );

    const trumpet = new THREE.Mesh(trumpetGeometry, trumpetMaterial);
    trumpet.castShadow = true;
    head.add(trumpet);
    bloomElements.push(scaleBloom(trumpet, R * 0.45 * 0.3, R * 0.45));

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
      sizeM: avgHeadRadiusM * 0.32 * 0.6,
      radiusM: { min: opts.vaseBaseRadiusM * 1.15, max: opts.vaseBaseRadiusM * 2.4 },
      rand,
      tint: petalTint,
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
