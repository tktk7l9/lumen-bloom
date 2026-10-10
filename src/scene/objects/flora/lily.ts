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

interface TrumpetStyle {
  petal: { widthM: number; cupM: number; bendM: number };
  /** Head radius × the layout's head radius. */
  headScale: number;
  /** Tilt of the two tepal triads from the face plane (steeper = more of a trumpet). */
  tiltDeg: { outer: number; inner: number };
  /** Face direction: layout nod × nodScale + upLift, renormalized. */
  nodScale: number;
  upLift: number;
  /** Yaw of each bloom about the stem tip — several entries give an umbel of blooms per stem. */
  bloomYawsDeg: readonly number[];
  /** Amaryllis scapes are leafless. */
  leafless: boolean;
  stemRadiusM: number;
  stemHex: number;
  filamentHex: number;
}

// One machine, two flowers: a lily's tepals curl hard backward around
// splayed stamens, one bloom per stem; an amaryllis holds two broad
// trumpets sideways off a thick hollow scape.
const STYLES = {
  lily: {
    // Long petal with a strong backward curl — the lily's signature recurve.
    petal: { widthM: 0.42, cupM: 0.1, bendM: 0.5 },
    headScale: 0.62,
    tiltDeg: { outer: 38, inner: 30 },
    nodScale: 0.4,
    upLift: 0.35,
    bloomYawsDeg: [0],
    leafless: false,
    stemRadiusM: 0.0045,
    stemHex: 0x46672f,
    filamentHex: 0xe6e2d2,
  },
  amaryllis: {
    petal: { widthM: 0.64, cupM: 0.16, bendM: 0.14 },
    headScale: 0.72,
    tiltDeg: { outer: 46, inner: 40 },
    nodScale: 0.3,
    upLift: 0.15,
    bloomYawsDeg: [-48, 48],
    leafless: true,
    stemRadiusM: 0.0068,
    stemHex: 0x5c8a3a,
    filamentHex: 0xf2e6e0,
  },
} satisfies Record<string, TrumpetStyle>;

export interface LilyOptions {
  paletteHex: readonly number[];
  stemCount: number;
  seed: number;
  vaseRimYM: number;
  vaseNeckRadiusM: number;
  vaseBaseRadiusM: number;
}

/** Large six-tepal blooms with prominent stamens. */
function createGroup(opts: LilyOptions, style: TrumpetStyle): THREE.Group {
  const stems = layoutBouquet(opts);
  const group = new THREE.Group();
  const stemGroups: THREE.Group[] = [];

  const stemMaterial = new THREE.MeshStandardMaterial({ color: style.stemHex, roughness: 0.75 });
  const petalGeometry = gridToGeometry(
    petalGrid({ lengthM: 1, segmentsU: 9, segmentsV: 6, ...style.petal }),
    0xd4d2ca,
    0xffffff,
  );
  const petalMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.5,
    side: THREE.DoubleSide,
  });
  const leafGeometry = gridToGeometry(
    petalGrid({ lengthM: 1, widthM: 0.28, segmentsU: 7, segmentsV: 4, cupM: -0.03, bendM: 0.25 }),
    0x33541f,
    0x4a7229,
  );
  const leafMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.68,
    side: THREE.DoubleSide,
  });
  const filamentGeometry = new THREE.CylinderGeometry(0.015, 0.015, 1, 5);
  filamentGeometry.translate(0, 0.5, 0);
  const filamentMaterial = new THREE.MeshStandardMaterial({ color: style.filamentHex, roughness: 0.6 });
  const antherGeometry = new THREE.SphereGeometry(1, 6, 5);
  const antherMaterial = new THREE.MeshStandardMaterial({ color: 0x8a5a24, roughness: 0.7 });

  const matrix = new THREE.Matrix4();
  const dir = new THREE.Vector3();
  const side = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const rand = mulberry32(opts.seed + 601);
  const bloomElements: BloomElement[] = [];

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

    for (const leaf of style.leafless ? [] : stem.leaves) {
      const mesh = new THREE.Mesh(leafGeometry, leafMaterial);
      mesh.castShadow = true;
      mesh.position.copy(curve.getPointAt(leaf.t));
      mesh.scale.setScalar(leaf.lengthM);
      const az = (leaf.azimuthDeg * Math.PI) / 180;
      const d = new THREE.Vector3(Math.cos(az) * 0.85, -0.15, Math.sin(az) * 0.85).normalize();
      const s = new THREE.Vector3().crossVectors(UP, d).normalize();
      const n = new THREE.Vector3().crossVectors(s, d);
      mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(s, d, n));
      stemGroup.add(mesh);
      const openScale = mesh.scale.clone();
      bloomElements.push(
        scaleBloom(mesh, openScale.clone().multiplyScalar(LEAF_BUD_FRAC), openScale, rand()),
      );
    }

    const R = stem.headRadiusM * style.headScale;
    const tint = new THREE.Color(
      opts.paletteHex[Math.floor(stem.colorSeed * opts.paletteHex.length)] ?? 0xf6f3ec,
    );
    const [dx, dy, dz] = stem.headDirection;
    const tipPoint = curve.getPointAt(1);

    for (const yawDeg of style.bloomYawsDeg) {
      // Blooms face outward, barely nodding; an umbel fans its blooms
      // around the stem tip, each a short neck out along its own direction.
      const yaw = (yawDeg * Math.PI) / 180;
      const facing = new THREE.Vector3(
        dx * Math.cos(yaw) - dz * Math.sin(yaw),
        dy * style.nodScale + style.upLift,
        dx * Math.sin(yaw) + dz * Math.cos(yaw),
      ).normalize();
      const head = new THREE.Group();
      if (style.bloomYawsDeg.length === 1) head.position.set(...stem.headPosition);
      else head.position.copy(tipPoint).addScaledVector(facing, 0.012);
      head.quaternion.setFromUnitVectors(UP, facing);

      // Two offset triads make the classic six-tepal star.
      bloomElements.push(
        addAnimatedRadialRing(head, petalGeometry, petalMaterial, {
          count: 3,
          ringRadius: R * 0.12,
          ringY: 0,
          tiltDeg: style.tiltDeg.outer,
          lengthM: R,
          angleOffsetRad: 0,
          tint,
          rand,
        }),
      );
      bloomElements.push(
        addAnimatedRadialRing(head, petalGeometry, petalMaterial, {
          count: 3,
          ringRadius: R * 0.12,
          ringY: -0.004,
          tiltDeg: style.tiltDeg.inner,
          lengthM: R * 0.96,
          angleOffsetRad: Math.PI / 3,
          tint: tint.clone().multiplyScalar(0.97),
          rand,
        }),
      );

      // Six stamens splaying from the throat, brown anthers on the tips.
      const filaments = new THREE.InstancedMesh(filamentGeometry, filamentMaterial, 6);
      const anthers = new THREE.InstancedMesh(antherGeometry, antherMaterial, 6);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + 0.3;
        dir
          .set(Math.cos(a) * 0.45, 1, Math.sin(a) * 0.45)
          .normalize();
        side.crossVectors(UP, dir).normalize();
        normal.crossVectors(side, dir);
        const len = R * 0.55;
        matrix.makeBasis(side, dir, normal);
        matrix.scale(new THREE.Vector3(len, len, len));
        matrix.setPosition(0, 0.004, 0);
        filaments.setMatrixAt(k, matrix);
        const tip = dir.clone().multiplyScalar(len).add(new THREE.Vector3(0, 0.004, 0));
        const s = R * 0.05;
        matrix.makeScale(s, s * 1.8, s);
        matrix.setPosition(tip.x, tip.y, tip.z);
        anthers.setMatrixAt(k, matrix);
      }
      filaments.instanceMatrix.needsUpdate = true;
      anthers.instanceMatrix.needsUpdate = true;
      head.add(filaments, anthers);
      stemGroup.add(head);
    }

    group.add(stemGroup);
    stemGroups.push(stemGroup);
  }

  const avgHeadRadiusM = stems.reduce((sum, s) => sum + s.headRadiusM, 0) / stems.length;
  bloomElements.push(
    addFloorDebris(group, {
      geometry: petalGeometry,
      material: petalMaterial,
      count: Math.min(MAX_DEBRIS_INSTANCES, stems.length * 20),
      sizeM: avgHeadRadiusM * style.headScale * 0.5,
      radiusM: { min: opts.vaseBaseRadiusM * 1.15, max: opts.vaseBaseRadiusM * 2.4 },
      rand,
      tint: new THREE.Color(opts.paletteHex[0] ?? 0xf6f3ec),
    }),
  );
  if (!style.leafless) {
    bloomElements.push(
      addFloorDebris(group, {
        geometry: leafGeometry,
        material: leafMaterial,
        count: Math.min(MAX_DEBRIS_INSTANCES, stems.length * 6),
        sizeM: 0.07,
        radiusM: { min: opts.vaseBaseRadiusM * 1.15, max: opts.vaseBaseRadiusM * 2.4 },
        rand,
      }),
    );
  }

  attachBreeze(group, stemGroups);
  attachBloomCycle(group, bloomElements);
  return group;
}

export const createLilyGroup = (o: LilyOptions): THREE.Group => createGroup(o, STYLES.lily);
export const createAmaryllisGroup = (o: LilyOptions): THREE.Group => createGroup(o, STYLES.amaryllis);
