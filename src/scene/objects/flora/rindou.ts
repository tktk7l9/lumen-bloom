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
const LEAF_BUD_FRAC = 0.4;

interface PodStyle {
  /** Pods per stem: min + up to `jitter` more. */
  count: { min: number; jitter: number };
  /** One pod crowns the stem tip; the rest sit in the upper axils between these t values. */
  tipPod: boolean;
  axilT: { min: number; max: number };
  /** Pods point up out of the axils (gentian) or hang below the stem (lantern). */
  hang: boolean;
  lean: number;
  lengthM: { min: number; jitter: number };
  widthFrac: number;
  /** Bud pose scale: gentians barely change shape, lanterns swell as they ripen. */
  budScaleFrac: number;
  stemRadiusM: number;
  stemHex: number;
  leafScale: number;
  droopScale: number;
  freeLengthScale: number;
}

// One machine, two plants: the gentian's tube is a near-closed bud that
// stands upright; the hozuki's is the same tapered tube hung upside down,
// swelling into the papery orange lantern.
const STYLES = {
  rindou: {
    count: { min: 4, jitter: 3 },
    tipPod: true,
    axilT: { min: 0.82, max: 0.96 },
    hang: false,
    lean: 0.35,
    lengthM: { min: 0.02, jitter: 0.007 },
    widthFrac: 0.55,
    // Real gentians barely open even in bloom — the bud pose is a subtly
    // smaller version of the same near-closed tube, not a different shape.
    budScaleFrac: 0.6,
    stemRadiusM: 0.0032,
    stemHex: 0x4a6b34,
    leafScale: 0.7,
    droopScale: 1,
    freeLengthScale: 1,
  },
  hozuki: {
    count: { min: 4, jitter: 2 },
    tipPod: false,
    axilT: { min: 0.6, max: 0.95 },
    hang: true,
    lean: 0.3,
    lengthM: { min: 0.034, jitter: 0.008 },
    widthFrac: 0.62,
    budScaleFrac: 0.4,
    stemRadiusM: 0.0028,
    stemHex: 0x5f8a3c,
    leafScale: 0.9,
    droopScale: 0.35,
    freeLengthScale: 1.2,
  },
} satisfies Record<string, PodStyle>;

export interface RindouOptions {
  paletteHex: readonly number[];
  stemCount: number;
  seed: number;
  vaseRimYM: number;
  vaseNeckRadiusM: number;
  vaseBaseRadiusM: number;
}

/** Gentian bud: a nearly closed tube tapering to a pointed tip, along +Y. */
function createBudGeometry(): THREE.LatheGeometry {
  const profile = [
    new THREE.Vector2(0.02, 0),
    new THREE.Vector2(0.28, 0.25),
    new THREE.Vector2(0.34, 0.6),
    new THREE.Vector2(0.22, 0.88),
    new THREE.Vector2(0.05, 1.0),
  ];
  return new THREE.LatheGeometry(profile, 10);
}

/** Tapered pods (gentian buds / hozuki lanterns) along the upper stems. */
function createGroup(opts: RindouOptions, style: PodStyle): THREE.Group {
  const stems = layoutBouquet({
    ...opts,
    droopScale: style.droopScale,
    freeLengthScale: style.freeLengthScale,
  });
  const group = new THREE.Group();
  const stemGroups: THREE.Group[] = [];
  const rand = mulberry32(opts.seed + 61);

  const stemMaterial = new THREE.MeshStandardMaterial({ color: style.stemHex, roughness: 0.75 });
  const budGeometry = createBudGeometry();
  const budMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55 });
  const leafGeometry = gridToGeometry(
    petalGrid({ lengthM: 1, widthM: 0.22, segmentsU: 6, segmentsV: 3, cupM: 0, bendM: 0.15 }),
    0x3a5828,
    0x4f7433,
  );
  const leafMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.7,
    side: THREE.DoubleSide,
  });

  const matrix = new THREE.Matrix4();
  const color = new THREE.Color();
  const dir = new THREE.Vector3();
  const side = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const bloomElements: BloomElement[] = [];

  for (const stem of stems) {
    const stemGroup = new THREE.Group();
    const curve = new THREE.CatmullRomCurve3(
      stem.controlPoints.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    );
    const stemMesh = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 20, style.stemRadiusM, 6, false),
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
      const d = new THREE.Vector3(Math.cos(az) * 0.7, 0.35, Math.sin(az) * 0.7).normalize();
      const s = new THREE.Vector3().crossVectors(UP, d).normalize();
      const n = new THREE.Vector3().crossVectors(s, d);
      mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(s, d, n));
      stemGroup.add(mesh);
      const openScale = mesh.scale.clone();
      bloomElements.push(
        scaleBloom(mesh, openScale.clone().multiplyScalar(LEAF_BUD_FRAC), openScale, rand()),
      );
    }

    // Gentians stack their buds at the top: one crowning the tip, a few
    // more nestled in the upper leaf axils.
    const tint = new THREE.Color(
      opts.paletteHex[Math.floor(stem.colorSeed * opts.paletteHex.length)] ?? 0x3a55a8,
    );
    const budCount = style.count.min + Math.floor(rand() * style.count.jitter);
    const buds = new THREE.InstancedMesh(budGeometry, budMaterial, budCount);
    buds.castShadow = true;
    const openPoses: InstancePose[] = [];
    const budPoses: InstancePose[] = [];
    const shedAt = new Float32Array(budCount);
    for (let k = 0; k < budCount; k++) {
      const atTip = style.tipPod && k === 0;
      const t = atTip ? 1 : style.axilT.min + rand() * (style.axilT.max - style.axilT.min);
      const p = curve.getPointAt(Math.min(t, 1));
      const lean = atTip ? 0 : style.lean;
      const a = rand() * Math.PI * 2;
      dir.set(Math.cos(a) * lean, style.hang ? -1 : 1, Math.sin(a) * lean).normalize();
      side.crossVectors(UP, dir).normalize();
      normal.crossVectors(side, dir);
      const len = style.lengthM.min + rand() * style.lengthM.jitter;
      matrix.makeBasis(side, dir, normal);
      const quaternion = new THREE.Quaternion().setFromRotationMatrix(matrix);
      const position = new THREE.Vector3(
        p.x + Math.cos(a) * lean * 0.006,
        p.y - (atTip ? 0 : 0.004),
        p.z + Math.sin(a) * lean * 0.006,
      );
      const scale = new THREE.Vector3(len * style.widthFrac, len, len * style.widthFrac);
      openPoses.push({ position, quaternion, scale });
      budPoses.push({ position, quaternion, scale: scale.clone().multiplyScalar(style.budScaleFrac) });
      shedAt[k] = rand();
      color.copy(tint).offsetHSL(0, 0, (rand() - 0.5) * 0.06);
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
      sizeM: avgHeadRadiusM * 0.3,
      radiusM: { min: opts.vaseBaseRadiusM * 1.15, max: opts.vaseBaseRadiusM * 2.4 },
      rand,
      tint: new THREE.Color(opts.paletteHex[0] ?? 0x3a55a8),
    }),
  );
  bloomElements.push(
    addFloorDebris(group, {
      geometry: leafGeometry,
      material: leafMaterial,
      count: Math.min(MAX_DEBRIS_INSTANCES, stems.length * 6),
      sizeM: 0.05,
      radiusM: { min: opts.vaseBaseRadiusM * 1.15, max: opts.vaseBaseRadiusM * 2.4 },
      rand,
    }),
  );

  attachBreeze(group, stemGroups);
  attachBloomCycle(group, bloomElements);
  return group;
}

export const createRindouGroup = (o: RindouOptions): THREE.Group => createGroup(o, STYLES.rindou);
export const createHozukiGroup = (o: RindouOptions): THREE.Group => createGroup(o, STYLES.hozuki);
