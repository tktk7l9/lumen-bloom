import * as THREE from "three";
import { layoutBouquet } from "../../../engine/geometry/flowerLayout";
import { type PetalGrid, petalGrid } from "../../../engine/geometry/petalGrid";
import { mulberry32 } from "../../../engine/geometry/prng";
import {
  type BloomElement,
  MAX_DEBRIS_INSTANCES,
  addAnimatedRadialRing,
  addFloorDebris,
  attachBloomCycle,
  orientedPose,
  scaleBloom,
} from "../bloomRig";
import { attachBreeze, gridToGeometry } from "../flowers";

const UP = new THREE.Vector3(0, 1, 0);
// Sword leaves rise from the vase floor beside the stems. They are full
// size from day one (a blade that "grew" out of the vase over the bud days
// would read as wrong) and only fall during the shed window.
const BLADES_PER_STEM = 2;
const SIGNAL_HEX = 0xf2cf3a;

export interface IrisOptions {
  /** Petal colors — one per stem, picked by the layout's color seed. */
  paletteHex: readonly number[];
  stemCount: number;
  seed: number;
  vaseRimYM: number;
  vaseNeckRadiusM: number;
  vaseBaseRadiusM: number;
}

/**
 * A fall (the outer, drooping petal) carries the species' yellow signal
 * streak at its base. That is a two-color surface, which the usual
 * neutral-gradient + instance-tint trick cannot express (tint multiplies),
 * so each palette color gets its own small geometry with the colors baked
 * into the vertices: signal in the center of the base, fading into the
 * petal color toward the edges and the tip.
 */
function fallGeometry(grid: PetalGrid, petalHex: number): THREE.BufferGeometry {
  const geometry = gridToGeometry(grid, petalHex, petalHex);
  const colors = geometry.getAttribute("color") as THREE.BufferAttribute;
  const petal = new THREE.Color(petalHex);
  const signal = new THREE.Color(SIGNAL_HEX);
  const scratch = new THREE.Color();
  for (let iu = 0; iu < grid.rows; iu++) {
    const t = grid.rowT[iu];
    const along = THREE.MathUtils.smoothstep(t, 0.06, 0.42);
    for (let iv = 0; iv < grid.cols; iv++) {
      const s = (iv / (grid.cols - 1)) * 2 - 1;
      const streak = (1 - along) * Math.max(0, 1 - s * s * 1.6);
      scratch.copy(petal).lerp(signal, streak);
      colors.setXYZ(iu * grid.cols + iv, scratch.r, scratch.g, scratch.b);
    }
  }
  colors.needsUpdate = true;
  return geometry;
}

/**
 * Iris (ayame / hanashoubu): three broad falls arching out and down with a
 * yellow signal at the base, three narrower standards rising between them,
 * and three small style arms over the falls — on straight stems among
 * upright sword leaves.
 */
export function createIrisGroup(opts: IrisOptions): THREE.Group {
  const stems = layoutBouquet({ ...opts, droopScale: 0.2, freeLengthScale: 1.15 });
  const group = new THREE.Group();
  const stemGroups: THREE.Group[] = [];
  const rand = mulberry32(opts.seed + 601);
  const bloomElements: BloomElement[] = [];

  const stemMaterial = new THREE.MeshStandardMaterial({ color: 0x55783a, roughness: 0.75 });
  const fallGrid = petalGrid({ lengthM: 1, widthM: 0.62, segmentsU: 8, segmentsV: 6, cupM: 0.06, bendM: 0.62 });
  const fallGeometries = new Map<number, THREE.BufferGeometry>();
  const fallFor = (hex: number): THREE.BufferGeometry => {
    let g = fallGeometries.get(hex);
    if (!g) {
      g = fallGeometry(fallGrid, hex);
      fallGeometries.set(hex, g);
    }
    return g;
  };
  const standardGeometry = gridToGeometry(
    petalGrid({ lengthM: 1, widthM: 0.36, segmentsU: 6, segmentsV: 4, cupM: 0.1, bendM: -0.08 }),
    0xd6d6d6,
    0xffffff,
  );
  const petalMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.55,
    side: THREE.DoubleSide,
  });
  const bladeGeometry = gridToGeometry(
    petalGrid({ lengthM: 1, widthM: 0.075, segmentsU: 8, segmentsV: 2, cupM: 0.012, bendM: 0.1 }),
    0x3f6b2e,
    0x6a9a48,
  );
  const bladeMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.62,
    side: THREE.DoubleSide,
  });

  for (const stem of stems) {
    const stemGroup = new THREE.Group();
    const curve = new THREE.CatmullRomCurve3(
      stem.controlPoints.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    );
    const stemMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.0034, 7, false), stemMaterial);
    stemMesh.castShadow = true;
    stemGroup.add(stemMesh);

    // Sword leaves: straight blades from the vase floor, through the
    // opening, arching gently outward above the rim.
    const [foot, rim] = stem.controlPoints;
    const tip = curve.getPointAt(1);
    const az = Math.atan2(rim[2], rim[0]);
    for (let b = 0; b < BLADES_PER_STEM; b++) {
      const spin = az + (rand() - 0.5) * 1.2;
      const base = new THREE.Vector3(foot[0] * 0.5, foot[1] + 0.004, foot[2] * 0.5);
      const through = new THREE.Vector3(
        Math.cos(spin) * opts.vaseNeckRadiusM * 0.45,
        rim[1],
        Math.sin(spin) * opts.vaseNeckRadiusM * 0.45,
      );
      const dir = through.clone().sub(base).normalize();
      const aboveRim = (tip.y - rim[1]) * (0.5 + rand() * 0.35);
      const length = through.distanceTo(base) + Math.max(0.1, aboveRim) / Math.max(0.4, dir.y);
      const outward = new THREE.Vector3(-Math.cos(spin), 0, -Math.sin(spin));
      const pose = orientedPose(base, dir, outward, new THREE.Vector3(0.13, length, length * 0.6));
      const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
      blade.castShadow = true;
      blade.position.copy(pose.position);
      blade.quaternion.copy(pose.quaternion);
      blade.scale.copy(pose.scale);
      stemGroup.add(blade);
      bloomElements.push(scaleBloom(blade, pose.scale, pose.scale, rand()));
    }

    // The flower sits on the stem tip, facing along it (mostly up).
    const head = new THREE.Group();
    head.position.copy(tip);
    const tangent = curve.getTangentAt(1);
    head.quaternion.setFromUnitVectors(UP, tangent.clone().multiplyScalar(0.6).add(UP).normalize());

    const R = stem.headRadiusM * 0.8;
    const petalHex =
      opts.paletteHex[Math.floor(stem.colorSeed * opts.paletteHex.length)] ?? 0x5b3fa8;
    const tint = new THREE.Color(petalHex);
    const spin = stem.colorSeed * Math.PI;

    bloomElements.push(
      addAnimatedRadialRing(head, fallFor(petalHex), petalMaterial, {
        count: 3,
        ringRadius: R * 0.08,
        ringY: 0,
        tiltDeg: 22,
        lengthM: R,
        angleOffsetRad: spin,
        rand,
        budTiltDeg: 84,
        budLengthFrac: 0.55,
      }),
    );
    bloomElements.push(
      addAnimatedRadialRing(head, standardGeometry, petalMaterial, {
        count: 3,
        ringRadius: R * 0.06,
        ringY: R * 0.02,
        tiltDeg: 68,
        lengthM: R * 0.72,
        angleOffsetRad: spin + Math.PI / 3,
        tint,
        rand,
        budLengthFrac: 0.6,
      }),
    );
    bloomElements.push(
      addAnimatedRadialRing(head, standardGeometry, petalMaterial, {
        count: 3,
        ringRadius: R * 0.05,
        ringY: R * 0.03,
        tiltDeg: 30,
        lengthM: R * 0.38,
        angleOffsetRad: spin,
        tint: tint.clone().lerp(new THREE.Color(0xffffff), 0.35),
        rand,
      }),
    );

    stemGroup.add(head);
    group.add(stemGroup);
    stemGroups.push(stemGroup);
  }

  const avgHeadRadiusM = stems.reduce((sum, s) => sum + s.headRadiusM, 0) / stems.length;
  const firstHex = opts.paletteHex[0] ?? 0x5b3fa8;
  bloomElements.push(
    addFloorDebris(group, {
      geometry: fallFor(firstHex),
      material: petalMaterial,
      count: Math.min(MAX_DEBRIS_INSTANCES, stems.length * 16),
      sizeM: avgHeadRadiusM * 0.8 * 0.5,
      radiusM: { min: opts.vaseBaseRadiusM * 1.15, max: opts.vaseBaseRadiusM * 2.4 },
      rand,
    }),
  );
  bloomElements.push(
    addFloorDebris(group, {
      geometry: standardGeometry,
      material: petalMaterial,
      count: Math.min(MAX_DEBRIS_INSTANCES, stems.length * 8),
      sizeM: avgHeadRadiusM * 0.8 * 0.4,
      radiusM: { min: opts.vaseBaseRadiusM * 1.15, max: opts.vaseBaseRadiusM * 2.4 },
      rand,
      tint: new THREE.Color(firstHex),
    }),
  );

  attachBreeze(group, stemGroups);
  attachBloomCycle(group, bloomElements);
  return group;
}
