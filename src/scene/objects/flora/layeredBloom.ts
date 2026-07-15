import * as THREE from "three";
import { layoutBouquet } from "../../../engine/geometry/flowerLayout";
import { petalGrid } from "../../../engine/geometry/petalGrid";
import { phyllotaxis } from "../../../engine/geometry/phyllotaxis";
import { addRadialRing, attachBreeze, gridToGeometry } from "../flowers";

const UP = new THREE.Vector3(0, 1, 0);

export interface LayeredBloomOptions {
  paletteHex: readonly number[];
  stemCount: number;
  seed: number;
  vaseRimYM: number;
  vaseNeckRadiusM: number;
}

interface RingSpec {
  count: number;
  radius: number; // × head R
  y: number; // × head R
  tilt: number; // degrees from the face plane
  len: number; // × head R
  shade: number; // tint multiplier
}

interface BloomStyle {
  petal: { widthM: number; cupM: number; bendM: number };
  rings: readonly RingSpec[];
  /** Head radius as a fraction of the layout's headRadiusM. */
  headScale: number;
  /** Golden stamens in the middle, or none for fully double blooms. */
  stamens: boolean;
  /** How strongly the face is pulled upright (0 = layout nod, 1 = straight up). */
  upBias: number;
  stemRadiusM: number;
}

// One machine, four flowers: the difference between a peony, a dahlia, a
// mum, and a carnation is just petal proportions and ring stacking.
const STYLES = {
  peony: {
    petal: { widthM: 0.62, cupM: 0.18, bendM: -0.05 },
    rings: [
      { count: 9, radius: 0.5, y: 0, tilt: 16, len: 1.0, shade: 1.0 },
      { count: 9, radius: 0.42, y: 0.015, tilt: 36, len: 0.9, shade: 0.96 },
      { count: 7, radius: 0.3, y: 0.03, tilt: 56, len: 0.78, shade: 0.92 },
      { count: 5, radius: 0.18, y: 0.04, tilt: 74, len: 0.6, shade: 0.88 },
    ],
    headScale: 0.55,
    stamens: true,
    upBias: 0.7,
    stemRadiusM: 0.0045,
  },
  dahlia: {
    petal: { widthM: 0.38, cupM: 0.14, bendM: -0.06 },
    rings: [
      { count: 12, radius: 0.52, y: 0, tilt: 12, len: 1.0, shade: 1.0 },
      { count: 12, radius: 0.44, y: 0.01, tilt: 30, len: 0.88, shade: 0.95 },
      { count: 10, radius: 0.34, y: 0.02, tilt: 48, len: 0.74, shade: 0.9 },
      { count: 8, radius: 0.22, y: 0.03, tilt: 64, len: 0.6, shade: 0.85 },
      { count: 6, radius: 0.12, y: 0.04, tilt: 78, len: 0.46, shade: 0.8 },
    ],
    headScale: 0.58,
    stamens: false,
    upBias: 0.6,
    stemRadiusM: 0.0045,
  },
  mum: {
    petal: { widthM: 0.26, cupM: 0.3, bendM: 0.02 },
    rings: [
      { count: 14, radius: 0.5, y: 0, tilt: 15, len: 1.0, shade: 1.0 },
      { count: 13, radius: 0.4, y: 0.015, tilt: 35, len: 0.85, shade: 0.96 },
      { count: 11, radius: 0.28, y: 0.03, tilt: 55, len: 0.68, shade: 0.92 },
      { count: 9, radius: 0.16, y: 0.04, tilt: 72, len: 0.52, shade: 0.88 },
    ],
    headScale: 0.5,
    stamens: false,
    upBias: 0.65,
    stemRadiusM: 0.004,
  },
  carnation: {
    petal: { widthM: 0.6, cupM: 0.22, bendM: 0.1 },
    rings: [
      { count: 10, radius: 0.42, y: 0, tilt: 24, len: 1.0, shade: 1.0 },
      { count: 9, radius: 0.34, y: 0.015, tilt: 44, len: 0.85, shade: 0.95 },
      { count: 8, radius: 0.24, y: 0.03, tilt: 62, len: 0.7, shade: 0.9 },
      { count: 6, radius: 0.14, y: 0.04, tilt: 78, len: 0.55, shade: 0.85 },
    ],
    headScale: 0.42,
    stamens: false,
    upBias: 0.75,
    stemRadiusM: 0.0035,
  },
  rose: {
    petal: { widthM: 0.55, cupM: 0.3, bendM: -0.12 },
    rings: [
      { count: 8, radius: 0.42, y: 0, tilt: 30, len: 0.85, shade: 1.0 },
      { count: 7, radius: 0.32, y: 0.012, tilt: 48, len: 0.72, shade: 0.94 },
      { count: 6, radius: 0.22, y: 0.024, tilt: 62, len: 0.58, shade: 0.88 },
      { count: 5, radius: 0.13, y: 0.034, tilt: 76, len: 0.45, shade: 0.82 },
    ],
    headScale: 0.45,
    stamens: false,
    upBias: 0.55,
    stemRadiusM: 0.004,
  },
  ranunculus: {
    petal: { widthM: 0.6, cupM: 0.22, bendM: -0.04 },
    rings: [
      { count: 11, radius: 0.46, y: 0, tilt: 14, len: 1.0, shade: 1.0 },
      { count: 10, radius: 0.38, y: 0.01, tilt: 30, len: 0.85, shade: 0.96 },
      { count: 9, radius: 0.29, y: 0.02, tilt: 46, len: 0.7, shade: 0.92 },
      { count: 7, radius: 0.2, y: 0.03, tilt: 62, len: 0.56, shade: 0.88 },
      { count: 5, radius: 0.11, y: 0.038, tilt: 76, len: 0.42, shade: 0.84 },
    ],
    headScale: 0.4,
    stamens: false,
    upBias: 0.7,
    stemRadiusM: 0.0035,
  },
} satisfies Record<string, BloomStyle>;

function createGroup(opts: LayeredBloomOptions, style: BloomStyle): THREE.Group {
  const stems = layoutBouquet(opts);
  const group = new THREE.Group();
  const stemGroups: THREE.Group[] = [];

  const stemMaterial = new THREE.MeshStandardMaterial({ color: 0x4f6e35, roughness: 0.75 });
  const petalGeometry = gridToGeometry(
    petalGrid({ lengthM: 1, segmentsU: 7, segmentsV: 6, ...style.petal }),
    0xbdbdbd,
    0xffffff,
  );
  const petalMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.58,
    side: THREE.DoubleSide,
  });
  const leafGeometry = gridToGeometry(
    petalGrid({ lengthM: 1, widthM: 0.66, segmentsU: 8, segmentsV: 6, cupM: -0.06, bendM: 0.3 }),
    0x2f4d1e,
    0x477026,
  );
  const leafMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.7,
    side: THREE.DoubleSide,
  });
  const stamenGeometry = new THREE.SphereGeometry(1, 6, 5);
  const stamenMaterial = new THREE.MeshStandardMaterial({ color: 0xe8c24a, roughness: 0.8 });

  for (const stem of stems) {
    const stemGroup = new THREE.Group();
    const curve = new THREE.CatmullRomCurve3(
      stem.controlPoints.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    );
    const stemMesh = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 20, style.stemRadiusM, 8, false),
      stemMaterial,
    );
    stemMesh.castShadow = true;
    stemGroup.add(stemMesh);

    for (const leaf of stem.leaves) {
      const mesh = new THREE.Mesh(leafGeometry, leafMaterial);
      mesh.castShadow = true;
      mesh.position.copy(curve.getPointAt(leaf.t));
      mesh.scale.setScalar(leaf.lengthM);
      const az = (leaf.azimuthDeg * Math.PI) / 180;
      const dir = new THREE.Vector3(Math.cos(az) * 0.8, -0.3, Math.sin(az) * 0.8).normalize();
      const side = new THREE.Vector3().crossVectors(UP, dir).normalize();
      const normal = new THREE.Vector3().crossVectors(side, dir);
      mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(side, dir, normal));
      stemGroup.add(mesh);
    }

    const head = new THREE.Group();
    head.position.set(...stem.headPosition);
    const [dx, dy, dz] = stem.headDirection;
    head.quaternion.setFromUnitVectors(
      UP,
      new THREE.Vector3(dx, Math.max(dy, 0) + style.upBias, dz).normalize(),
    );

    const R = stem.headRadiusM * style.headScale;
    const tint = new THREE.Color(
      opts.paletteHex[Math.floor(stem.colorSeed * opts.paletteHex.length)] ?? 0xe98cb1,
    );

    if (style.stamens) {
      const stamens = new THREE.InstancedMesh(stamenGeometry, stamenMaterial, 18);
      const matrix = new THREE.Matrix4();
      phyllotaxis(18, R * 0.14).forEach(([x, z], i) => {
        const s = R * 0.045;
        matrix.makeScale(s, s * 1.4, s);
        matrix.setPosition(x, R * 0.1, z);
        stamens.setMatrixAt(i, matrix);
      });
      stamens.instanceMatrix.needsUpdate = true;
      head.add(stamens);
    }

    style.rings.forEach((ring, i) => {
      addRadialRing(head, petalGeometry, petalMaterial, {
        count: ring.count,
        ringRadius: R * ring.radius,
        ringY: R * ring.y,
        tiltDeg: ring.tilt,
        lengthM: R * ring.len,
        angleOffsetRad: i * 0.45,
        tint: tint.clone().multiplyScalar(ring.shade),
      });
    });

    stemGroup.add(head);
    group.add(stemGroup);
    stemGroups.push(stemGroup);
  }

  attachBreeze(group, stemGroups);
  return group;
}

export const createPeonyGroup = (o: LayeredBloomOptions): THREE.Group => createGroup(o, STYLES.peony);
export const createDahliaGroup = (o: LayeredBloomOptions): THREE.Group => createGroup(o, STYLES.dahlia);
export const createMumGroup = (o: LayeredBloomOptions): THREE.Group => createGroup(o, STYLES.mum);
export const createCarnationGroup = (o: LayeredBloomOptions): THREE.Group =>
  createGroup(o, STYLES.carnation);
export const createRoseGroup = (o: LayeredBloomOptions): THREE.Group => createGroup(o, STYLES.rose);
export const createRanunculusGroup = (o: LayeredBloomOptions): THREE.Group =>
  createGroup(o, STYLES.ranunculus);
