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
// Buds have no petal to angle open — they swell in place instead, each on
// its own seeded position along the spike (organic filling-out, not one
// rigid whole-head scale-up).
const BUD_SCALE_FRAC = 0.35;
const LEAF_BUD_FRAC = 0.4;

interface SpikeStyle {
  budsPerSpike: number;
  spikeLengthM: number;
  budRadiusM: number;
  /** Bud height as a multiple of its radius (lavender buds are oblong, muscari bells squat). */
  budElongation: number;
  /** How much smaller the buds get toward the tip (0 = uniform). */
  taper: number;
  stemRadiusM: number;
  stemHex: number;
  leafScale: number;
  droopScale: number;
  freeLengthScale: number;
}

// One machine, two flowers: a lavender spike is long, loose and oblong;
// a muscari raceme is a short, fat, tapering bunch of round bells on a
// stem a third as tall.
const STYLES = {
  lavender: {
    budsPerSpike: 22,
    spikeLengthM: 0.05,
    budRadiusM: 0.0022,
    budElongation: 1.5,
    taper: 0,
    stemRadiusM: 0.0016,
    stemHex: 0x5f7a52,
    leafScale: 0.55,
    droopScale: 1,
    freeLengthScale: 1,
  },
  muscari: {
    budsPerSpike: 30,
    spikeLengthM: 0.03,
    budRadiusM: 0.0027,
    budElongation: 1.05,
    taper: 0.5,
    stemRadiusM: 0.002,
    stemHex: 0x6f8f5a,
    leafScale: 0.7,
    droopScale: 0.3,
    freeLengthScale: 0.45,
  },
} satisfies Record<string, SpikeStyle>;

export interface LavenderOptions {
  paletteHex: readonly number[];
  stemCount: number;
  seed: number;
  vaseRimYM: number;
  vaseNeckRadiusM: number;
  vaseBaseRadiusM: number;
}

/** Slender stems ending in spikes of tiny buds. */
function createGroup(opts: LavenderOptions, style: SpikeStyle): THREE.Group {
  const stems = layoutBouquet({
    ...opts,
    droopScale: style.droopScale,
    freeLengthScale: style.freeLengthScale,
  });
  const group = new THREE.Group();
  const stemGroups: THREE.Group[] = [];
  const rand = mulberry32(opts.seed + 51);

  const stemMaterial = new THREE.MeshStandardMaterial({ color: style.stemHex, roughness: 0.75 });
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
      new THREE.TubeGeometry(curve, 20, style.stemRadiusM, 5, false),
      stemMaterial,
    );
    stemMesh.castShadow = true;
    stemGroup.add(stemMesh);

    for (const leaf of stem.leaves) {
      const mesh = new THREE.Mesh(leafGeometry, leafMaterial);
      mesh.castShadow = true;
      mesh.position.copy(curve.getPointAt(leaf.t));
      mesh.scale.setScalar(leaf.lengthM * style.leafScale);
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
    const buds = new THREE.InstancedMesh(budGeometry, budMaterial, style.budsPerSpike);
    buds.castShadow = true;
    const tip = curve.getPointAt(1);
    const tangent = curve.getTangentAt(0.98).normalize();
    const openPoses: InstancePose[] = [];
    const budPoses: InstancePose[] = [];
    const shedAt = new Float32Array(style.budsPerSpike);
    const identity = new THREE.Quaternion();
    for (let k = 0; k < style.budsPerSpike; k++) {
      const frac = k / style.budsPerSpike;
      const along = frac * style.spikeLengthM - style.spikeLengthM * 0.24;
      const jitterR = style.budRadiusM * (1 + rand() * 0.55);
      const a = rand() * Math.PI * 2;
      const s = style.budRadiusM * (1 + rand() * 0.36) * (1 - style.taper * frac);
      const position = new THREE.Vector3(
        tip.x + tangent.x * along + Math.cos(a) * jitterR,
        tip.y + tangent.y * along + (rand() - 0.5) * 0.002,
        tip.z + tangent.z * along + Math.sin(a) * jitterR,
      );
      const scale = new THREE.Vector3(s, s * style.budElongation, s);
      openPoses.push({ position, quaternion: identity, scale });
      budPoses.push({ position, quaternion: identity, scale: scale.clone().multiplyScalar(BUD_SCALE_FRAC) });
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

export const createLavenderGroup = (o: LavenderOptions): THREE.Group => createGroup(o, STYLES.lavender);
export const createMuscariGroup = (o: LavenderOptions): THREE.Group => createGroup(o, STYLES.muscari);
