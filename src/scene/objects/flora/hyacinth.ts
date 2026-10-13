import * as THREE from "three";
import { starFloret } from "../../../engine/geometry/floraMeshes";
import { layoutBouquet } from "../../../engine/geometry/flowerLayout";
import { petalGrid } from "../../../engine/geometry/petalGrid";
import { mulberry32 } from "../../../engine/geometry/prng";
import { racemeLayout } from "../../../engine/geometry/raceme";
import {
  type BloomElement,
  type InstancePose,
  MAX_DEBRIS_INSTANCES,
  addAnimatedInstances,
  addFloorDebris,
  attachBloomCycle,
  orientedPose,
} from "../bloomRig";
import { attachBreeze, gridToGeometry } from "../flowers";
import { grayShade, meshDataToGeometry } from "./meshData";

const UP = new THREE.Vector3(0, 1, 0);
const X_AXIS = new THREE.Vector3(1, 0, 0);

// Raceme: the length grows with the stem (a tall scape carries a longer
// head), and the floret count with the length, so density stays the same.
const RACEME_FRACTION_OF_FREE_STEM = 0.55;
const RACEME_LENGTH_M = { min: 0.07, max: 0.095 };
const FLORETS_PER_M = 440;
/** How much of the raceme rides beyond the stem's own tip (the young top buds). */
const RACEME_OVERHANG = 0.1;
const FLORET_M = 0.027;
/** Florets stand off the rachis on short pedicels. */
const PEDICEL_M = 0.0015;
const BUD_FRACTION = 0.18;
const STEM_RADIUS_M = 0.0048;
const STEM_HEX = 0x6f9a4a;
// Closed florets: squeezed sideways (the tepals folded up over the tube) and short.
const BUD_SQUEEZE = { lateral: 0.3, axial: 0.62 };
const BUD_GREEN = new THREE.Color(0xb7cf86);
const LEAVES_PER_STEM = 2;
/** Where the leaves leave the stem, as a fraction of its in-vase run from the foot. */
const LEAF_BASE_ALONG = 0.62;

export interface HyacinthOptions {
  /** Floret colors — one per stem, picked by the layout's color seed. */
  paletteHex: readonly number[];
  stemCount: number;
  seed: number;
  vaseRimYM: number;
  vaseNeckRadiusM: number;
  vaseBaseRadiusM: number;
}

/**
 * Hyacinth: a thick, stiff scape carrying a dense cylinder of star-shaped
 * florets that spiral up it, open from the bottom and still bud green at
 * the top, between broad strap leaves that sheathe the stem in the neck of
 * the vase and arch outward over the rim.
 */
export function createHyacinthGroup(opts: HyacinthOptions): THREE.Group {
  const stems = layoutBouquet({ ...opts, droopScale: 0.2, freeLengthScale: 1 });
  const group = new THREE.Group();
  const stemGroups: THREE.Group[] = [];
  const rand = mulberry32(opts.seed + 53);
  const bloomElements: BloomElement[] = [];

  const stemMaterial = new THREE.MeshStandardMaterial({ color: STEM_HEX, roughness: 0.6 });
  const floretGeometry = meshDataToGeometry(starFloret(), grayShade);
  const floretMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.45,
    side: THREE.DoubleSide,
  });
  // Strap leaves: blunt-tipped, channelled, paler toward the base.
  const leafGeometry = gridToGeometry(
    petalGrid({ lengthM: 1, widthM: 1, segmentsU: 8, segmentsV: 2, cupM: -0.025, bendM: 0.45, widthExponent: 0.4 }),
    0x7fa05c,
    0x467a2e,
  );
  const leafMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.5,
    side: THREE.DoubleSide,
  });

  const color = new THREE.Color();
  const usedTints: THREE.Color[] = [];

  for (const stem of stems) {
    const stemGroup = new THREE.Group();
    const curve = new THREE.CatmullRomCurve3(
      stem.controlPoints.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    );
    const stemMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, STEM_RADIUS_M, 6, false), stemMaterial);
    stemMesh.castShadow = true;
    stemGroup.add(stemMesh);

    // Leaves: sheathing the stem from just under the neck (where the cut
    // stem keeps them), leaning out with it above the rim and arching over
    // (the bend curls the tip toward local −Z, which faces outward here).
    // Starting them low in the vase would put their widest part inside it.
    const [foot, rim] = stem.controlPoints;
    const tip = curve.getPointAt(1);
    const rimAz = Math.atan2(rim[2], rim[0]);
    const freeM = tip.y - rim[1];
    const inVase = new THREE.Vector3(rim[0] - foot[0], rim[1] - foot[1], rim[2] - foot[2]);
    const leafPoses: InstancePose[] = [];
    for (let k = 0; k < LEAVES_PER_STEM; k++) {
      const spin = rimAz + (k - (LEAVES_PER_STEM - 1) / 2) * 0.9 + (rand() - 0.5) * 0.3;
      const side = new THREE.Vector3(Math.cos(spin), 0, Math.sin(spin));
      const base = new THREE.Vector3(...foot)
        .addScaledVector(inVase, LEAF_BASE_ALONG + rand() * 0.08)
        .addScaledVector(side, STEM_RADIUS_M * 1.2);
      const through = new THREE.Vector3(
        Math.cos(spin) * opts.vaseNeckRadiusM * 0.7,
        rim[1],
        Math.sin(spin) * opts.vaseNeckRadiusM * 0.7,
      );
      const dir = through.clone().sub(base).normalize();
      const above = freeM * (0.5 + rand() * 0.35);
      const length = through.distanceTo(base) + above / Math.max(0.4, dir.y);
      const inward = new THREE.Vector3(-Math.cos(spin), 0, -Math.sin(spin));
      const width = 0.015 + rand() * 0.005;
      leafPoses.push(orientedPose(base, dir, inward, new THREE.Vector3(width, length, length * 0.45)));
    }
    const leaves = new THREE.InstancedMesh(leafGeometry, leafMaterial, leafPoses.length);
    leaves.name = "hyacinth-leaves";
    leaves.castShadow = true;
    stemGroup.add(leaves);
    // Full size all week: the leaves come with the cut stem and outlast the florets.
    bloomElements.push(
      addAnimatedInstances(leaves, leafPoses, leafPoses, new Float32Array(leafPoses.length).fill(2)),
    );

    // Raceme along the top of the stem, a little past its tip.
    const stemLength = curve.getLength();
    const racemeM = THREE.MathUtils.clamp(
      freeM * RACEME_FRACTION_OF_FREE_STEM,
      RACEME_LENGTH_M.min,
      RACEME_LENGTH_M.max,
    );
    const florets = racemeLayout({
      count: Math.round(racemeM * FLORETS_PER_M),
      seed: opts.seed * 31 + stemGroups.length,
      budFraction: BUD_FRACTION,
    });
    const tint = new THREE.Color(
      opts.paletteHex[Math.floor(stem.colorSeed * opts.paletteHex.length)] ?? 0x8a76c9,
    );
    usedTints.push(tint);
    const mesh = new THREE.InstancedMesh(floretGeometry, floretMaterial, florets.length);
    mesh.name = "hyacinth-florets";
    mesh.castShadow = true;
    const openPoses: InstancePose[] = [];
    const budPoses: InstancePose[] = [];
    const shedAt = new Float32Array(florets.length);
    const tipTangent = curve.getTangentAt(1);
    const u = new THREE.Vector3();
    const v = new THREE.Vector3();
    const radial = new THREE.Vector3();
    const dir = new THREE.Vector3();
    florets.forEach((f, i) => {
      const arc = stemLength - racemeM * (1 - RACEME_OVERHANG) + f.along * racemeM;
      const onStem = arc <= stemLength;
      const axisPoint = onStem
        ? curve.getPointAt(arc / stemLength)
        : curve.getPointAt(1).addScaledVector(tipTangent, arc - stemLength);
      const tangent = onStem ? curve.getTangentAt(arc / stemLength) : tipTangent.clone();
      u.crossVectors(Math.abs(tangent.y) > 0.95 ? X_AXIS : UP, tangent).normalize();
      v.crossVectors(tangent, u);
      radial.copy(u).multiplyScalar(Math.cos(f.azimuthRad)).addScaledVector(v, Math.sin(f.azimuthRad));
      // Out from the rachis, nodding down (or, near the tip, pointing up) by droop.
      dir.copy(radial).multiplyScalar(Math.cos(f.droopRad)).addScaledVector(tangent, -Math.sin(f.droopRad));
      const position = axisPoint.clone().addScaledVector(radial, STEM_RADIUS_M + PEDICEL_M);
      const s = FLORET_M * f.scale;
      const lateral = THREE.MathUtils.lerp(BUD_SQUEEZE.lateral, 1, f.openness);
      const axial = THREE.MathUtils.lerp(BUD_SQUEEZE.axial, 1, f.openness);
      openPoses.push(orientedPose(position, dir, tangent, new THREE.Vector3(s * lateral, s * axial, s * lateral)));
      // Before the week's opening, every floret is a small closed bud hugging the rachis.
      budPoses.push(
        orientedPose(
          axisPoint.clone().addScaledVector(radial, STEM_RADIUS_M * 0.5),
          dir.clone().addScaledVector(tangent, 0.8).normalize(),
          tangent,
          new THREE.Vector3(s * BUD_SQUEEZE.lateral * 0.8, s * BUD_SQUEEZE.axial * 0.8, s * BUD_SQUEEZE.lateral * 0.8),
        ),
      );
      shedAt[i] = f.shedAt;
      color
        .copy(tint)
        .lerp(BUD_GREEN, (1 - f.openness) * 0.55)
        .offsetHSL(0, 0, (rand() - 0.5) * 0.06);
      mesh.setColorAt(i, color);
    });
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    stemGroup.add(mesh);
    bloomElements.push(addAnimatedInstances(mesh, openPoses, budPoses, shedAt));

    group.add(stemGroup);
    stemGroups.push(stemGroup);
  }

  // Withered florets drop in the stems' own colors.
  bloomElements.push(
    addFloorDebris(group, {
      geometry: floretGeometry,
      material: floretMaterial,
      count: Math.min(MAX_DEBRIS_INSTANCES, stems.length * 14),
      sizeM: FLORET_M * 0.9,
      // A fallen floret lies on its side, resting on two tepal tips.
      centerY: FLORET_M * 0.9 * 0.6,
      radiusM: { min: opts.vaseBaseRadiusM * 1.15, max: opts.vaseBaseRadiusM * 2.4 },
      rand,
      tints: usedTints,
    }),
  );

  attachBreeze(group, stemGroups);
  attachBloomCycle(group, bloomElements);
  return group;
}
