import * as THREE from "three";
import { layoutBouquet } from "../../../engine/geometry/flowerLayout";
import { type BloomElement, attachBloomCycle, scaleBloom } from "../bloomRig";
import { attachBreeze } from "../flowers";

const UP = new THREE.Vector3(0, 1, 0);
// Calla has only one spathe per stem — nothing to shed, so it just grows
// from a small rolled cone to its full flared, asymmetric size.
const BUD_SCALE_FRAC = 0.3;

export interface CallaOptions {
  /** [spathe white, spadix yellow] */
  paletteHex: readonly number[];
  stemCount: number;
  seed: number;
  vaseRimYM: number;
  vaseNeckRadiusM: number;
}

/** Wine-glass spathe: a flaring open cone along +Y (squashed for asymmetry). */
function createSpatheGeometry(): THREE.LatheGeometry {
  const profile = [
    new THREE.Vector2(0.04, 0),
    new THREE.Vector2(0.16, 0.28),
    new THREE.Vector2(0.28, 0.62),
    new THREE.Vector2(0.46, 0.9),
    new THREE.Vector2(0.58, 1.0),
  ];
  return new THREE.LatheGeometry(profile, 18);
}

/** Sleek single-spathe blooms — the wedding-bouquet calla. */
export function createCallaGroup(opts: CallaOptions): THREE.Group {
  const stems = layoutBouquet(opts);
  const group = new THREE.Group();
  const stemGroups: THREE.Group[] = [];
  const bloomElements: BloomElement[] = [];

  const stemMaterial = new THREE.MeshStandardMaterial({ color: 0x50713c, roughness: 0.6 });
  const spatheGeometry = createSpatheGeometry();
  const spatheMaterial = new THREE.MeshStandardMaterial({
    color: opts.paletteHex[0] ?? 0xf4f1e8,
    roughness: 0.45,
    side: THREE.DoubleSide,
  });
  const spadixGeometry = new THREE.CylinderGeometry(0.06, 0.075, 0.85, 8);
  spadixGeometry.translate(0, 0.45, 0);
  const spadixMaterial = new THREE.MeshStandardMaterial({
    color: opts.paletteHex[1] ?? 0xe8c23a,
    roughness: 0.7,
  });

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

    // Callas are all line — no leaves, the spathe rides the stem tip,
    // facing up and a touch outward.
    const head = new THREE.Group();
    head.position.set(...stem.headPosition);
    const [dx, , dz] = stem.headDirection;
    head.quaternion.setFromUnitVectors(
      UP,
      new THREE.Vector3(dx * 0.45, 1, dz * 0.45).normalize(),
    );

    const size = stem.headRadiusM * 0.55;
    const spathe = new THREE.Mesh(spatheGeometry, spatheMaterial);
    spathe.castShadow = true;
    head.add(spathe);
    const openSpatheScale = new THREE.Vector3(size * 0.82, size, size * 0.62); // squashed = gently asymmetric
    bloomElements.push(
      scaleBloom(spathe, openSpatheScale.clone().multiplyScalar(BUD_SCALE_FRAC), openSpatheScale),
    );

    const spadix = new THREE.Mesh(spadixGeometry, spadixMaterial);
    head.add(spadix);
    bloomElements.push(scaleBloom(spadix, size * BUD_SCALE_FRAC, size));

    stemGroup.add(head);
    group.add(stemGroup);
    stemGroups.push(stemGroup);
  }

  attachBreeze(group, stemGroups);
  attachBloomCycle(group, bloomElements);
  return group;
}
