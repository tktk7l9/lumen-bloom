import * as THREE from "three";
import { layoutBouquet } from "../../../engine/geometry/flowerLayout";
import { petalGrid } from "../../../engine/geometry/petalGrid";
import { phyllotaxis } from "../../../engine/geometry/phyllotaxis";
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

export interface DaisyOptions {
  paletteHex: readonly number[];
  stemCount: number;
  seed: number;
  vaseRimYM: number;
  vaseNeckRadiusM: number;
  vaseBaseRadiusM: number;
}

interface DaisyRing {
  count: number;
  tiltDeg: number;
  lenFrac: number;
}

interface DaisyStyle {
  petal: { widthM: number; cupM: number; bendM: number };
  rings: readonly DaisyRing[];
  /** Center disc radius as a fraction of head R. */
  discFrac: number;
  discColorCenterHex: number;
  discColorRimHex: number;
  /** Petal length as a fraction of the layout's headRadiusM. */
  petalLenFrac: number;
  stemRadiusM: number;
  leafWidthM: number;
}

// One machine, four flowers: cosmos, anemone, gerbera, and margaret differ
// only in petal proportions, ring stacking, and the center disc.
const STYLES = {
  cosmos: {
    petal: { widthM: 0.52, cupM: 0.05, bendM: 0.04 },
    rings: [{ count: 8, tiltDeg: 10, lenFrac: 1 }],
    discFrac: 0.13,
    discColorCenterHex: 0xe8b83a,
    discColorRimHex: 0xd9a52e,
    petalLenFrac: 0.42,
    stemRadiusM: 0.0026,
    leafWidthM: 0.16,
  },
  anemone: {
    petal: { widthM: 0.66, cupM: 0.09, bendM: 0.02 },
    rings: [{ count: 7, tiltDeg: 14, lenFrac: 1 }],
    discFrac: 0.2,
    discColorCenterHex: 0x1c1826,
    discColorRimHex: 0x322c42,
    petalLenFrac: 0.4,
    stemRadiusM: 0.003,
    leafWidthM: 0.2,
  },
  gerbera: {
    petal: { widthM: 0.28, cupM: 0.04, bendM: 0.03 },
    rings: [
      { count: 15, tiltDeg: 8, lenFrac: 1 },
      { count: 13, tiltDeg: 22, lenFrac: 0.78 },
    ],
    discFrac: 0.18,
    discColorCenterHex: 0x4a3218,
    discColorRimHex: 0x8a6428,
    petalLenFrac: 0.45,
    stemRadiusM: 0.0034,
    leafWidthM: 0.24,
  },
  margaret: {
    petal: { widthM: 0.4, cupM: 0.05, bendM: 0.03 },
    rings: [{ count: 11, tiltDeg: 12, lenFrac: 1 }],
    discFrac: 0.15,
    discColorCenterHex: 0xe8c23a,
    discColorRimHex: 0xd9ab2e,
    petalLenFrac: 0.38,
    stemRadiusM: 0.0024,
    leafWidthM: 0.18,
  },
} satisfies Record<string, DaisyStyle>;

function createGroup(opts: DaisyOptions, style: DaisyStyle): THREE.Group {
  const stems = layoutBouquet(opts);
  const group = new THREE.Group();
  const stemGroups: THREE.Group[] = [];

  const stemMaterial = new THREE.MeshStandardMaterial({ color: 0x4c7030, roughness: 0.75 });
  const petalGeometry = gridToGeometry(
    petalGrid({ lengthM: 1, segmentsU: 6, segmentsV: 5, ...style.petal }),
    0xc9c9c9,
    0xffffff,
  );
  const petalMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.55,
    side: THREE.DoubleSide,
  });
  const leafGeometry = gridToGeometry(
    petalGrid({ lengthM: 1, widthM: style.leafWidthM, segmentsU: 6, segmentsV: 3, cupM: 0, bendM: 0.25 }),
    0x3d5c26,
    0x527a33,
  );
  const leafMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.7,
    side: THREE.DoubleSide,
  });
  const floretGeometry = new THREE.SphereGeometry(1, 6, 5);
  const floretMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 });

  const centerColor = new THREE.Color(style.discColorCenterHex);
  const rimColor = new THREE.Color(style.discColorRimHex);
  const scratch = new THREE.Color();
  const rand = mulberry32(opts.seed + 601);
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
      mesh.scale.setScalar(leaf.lengthM * 0.8);
      const az = (leaf.azimuthDeg * Math.PI) / 180;
      const dir = new THREE.Vector3(Math.cos(az) * 0.8, -0.2, Math.sin(az) * 0.8).normalize();
      const side = new THREE.Vector3().crossVectors(UP, dir).normalize();
      const normal = new THREE.Vector3().crossVectors(side, dir);
      mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(side, dir, normal));
      stemGroup.add(mesh);
      const openScale = mesh.scale.clone();
      bloomElements.push(
        scaleBloom(mesh, openScale.clone().multiplyScalar(LEAF_BUD_FRAC), openScale, rand()),
      );
    }

    const head = new THREE.Group();
    head.position.set(...stem.headPosition);
    head.quaternion.setFromUnitVectors(UP, new THREE.Vector3(...stem.headDirection));

    const discR = stem.headRadiusM * style.discFrac;
    const petalLen = stem.headRadiusM * style.petalLenFrac;
    const tint = new THREE.Color(
      opts.paletteHex[Math.floor(stem.colorSeed * opts.paletteHex.length)] ?? 0xe973a8,
    );

    const florets = new THREE.InstancedMesh(floretGeometry, floretMaterial, 24);
    const matrix = new THREE.Matrix4();
    phyllotaxis(24, discR * 0.9).forEach(([x, z], i) => {
      const rr = Math.min(1, Math.hypot(x, z) / discR);
      const s = discR * 0.22;
      matrix.makeScale(s, s * 0.7, s);
      matrix.setPosition(x, 0.0012, z);
      florets.setMatrixAt(i, matrix);
      scratch.copy(centerColor).lerp(rimColor, rr);
      florets.setColorAt(i, scratch);
    });
    florets.instanceMatrix.needsUpdate = true;
    if (florets.instanceColor) florets.instanceColor.needsUpdate = true;
    head.add(florets);

    style.rings.forEach((ring, i) => {
      bloomElements.push(
        addAnimatedRadialRing(head, petalGeometry, petalMaterial, {
          count: ring.count,
          ringRadius: discR * 0.9,
          ringY: i * 0.0015,
          tiltDeg: ring.tiltDeg,
          lengthM: petalLen * ring.lenFrac,
          angleOffsetRad: stem.colorSeed * Math.PI + i * (Math.PI / ring.count),
          tint: i === 0 ? tint : tint.clone().multiplyScalar(0.95),
          rand,
        }),
      );
    });

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
      sizeM: avgHeadRadiusM * style.petalLenFrac * 0.7,
      radiusM: { min: opts.vaseBaseRadiusM * 1.15, max: opts.vaseBaseRadiusM * 2.4 },
      rand,
      tint: new THREE.Color(opts.paletteHex[0] ?? 0xe973a8),
    }),
  );
  bloomElements.push(
    addFloorDebris(group, {
      geometry: leafGeometry,
      material: leafMaterial,
      count: Math.min(MAX_DEBRIS_INSTANCES, stems.length * 6),
      sizeM: 0.06,
      radiusM: { min: opts.vaseBaseRadiusM * 1.15, max: opts.vaseBaseRadiusM * 2.4 },
      rand,
    }),
  );

  attachBreeze(group, stemGroups);
  attachBloomCycle(group, bloomElements);
  return group;
}

export const createCosmosGroup = (o: DaisyOptions): THREE.Group => createGroup(o, STYLES.cosmos);
export const createAnemoneGroup = (o: DaisyOptions): THREE.Group => createGroup(o, STYLES.anemone);
export const createGerberaGroup = (o: DaisyOptions): THREE.Group => createGroup(o, STYLES.gerbera);
export const createMargaretGroup = (o: DaisyOptions): THREE.Group => createGroup(o, STYLES.margaret);
