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
const LEAF_BUD_FRAC = 0.4;

interface HeadStyle {
  /** Florets over the upper hemisphere (mophead) or the whole ball (allium). */
  shape: "dome" | "sphere";
  floretsPerHead: number;
  /** Head radius × the layout's head radius. */
  headScale: number;
  /** Floret petal length × head radius: min + up to `jitter` more. */
  petalLen: { min: number; jitter: number };
  petalSegments: { u: number; v: number };
  leafScale: number;
  /** Allium scapes carry no leaves at all. */
  leafless: boolean;
  /** How hard the head is pulled upright (added to the layout's nod). */
  upBias: number;
  stemRadiusM: number;
  stemHex: number;
  droopScale: number;
  freeLengthScale: number;
}

// One machine, three heads: a hydrangea mophead is a broad dome of
// four-petal florets over big leaves; rapeseed (nanohana) is a small
// upturned cluster of yellow crosses on a leafy, straighter stem; allium is a
// full ball of tiny stars on a tall bare scape.
const STYLES = {
  hydrangea: {
    shape: "dome",
    floretsPerHead: 42,
    headScale: 0.62,
    petalLen: { min: 0.32, jitter: 0.08 },
    petalSegments: { u: 5, v: 4 },
    leafScale: 1.15,
    leafless: false,
    upBias: 0.8,
    stemRadiusM: 0.005,
    stemHex: 0x44652c,
    droopScale: 1,
    freeLengthScale: 1,
  },
  nanohana: {
    shape: "dome",
    floretsPerHead: 26,
    headScale: 0.3,
    petalLen: { min: 0.42, jitter: 0.1 },
    petalSegments: { u: 4, v: 3 },
    leafScale: 0.7,
    leafless: false,
    upBias: 1.2,
    stemRadiusM: 0.003,
    stemHex: 0x5f8a3c,
    droopScale: 0.3,
    freeLengthScale: 1.25,
  },
  allium: {
    shape: "sphere",
    floretsPerHead: 84,
    headScale: 0.5,
    petalLen: { min: 0.19, jitter: 0.04 },
    petalSegments: { u: 3, v: 2 },
    leafScale: 1,
    leafless: true,
    upBias: 2,
    stemRadiusM: 0.0034,
    stemHex: 0x6f8f4e,
    droopScale: 0,
    freeLengthScale: 1.5,
  },
} satisfies Record<string, HeadStyle>;

/** Unit normals of the floret spots: a disc lifted to a dome, or a Fibonacci sphere. */
function floretNormals(style: HeadStyle): THREE.Vector3[] {
  if (style.shape === "dome") {
    return phyllotaxis(style.floretsPerHead, 1).map(([px, pz]) => {
      const rr = Math.min(0.98, Math.hypot(px, pz));
      return new THREE.Vector3(px, Math.sqrt(Math.max(0, 1 - rr * rr)), pz).normalize();
    });
  }
  const golden = Math.PI * (3 - Math.sqrt(5));
  const normals: THREE.Vector3[] = [];
  for (let i = 0; i < style.floretsPerHead; i++) {
    const y = 1 - (2 * (i + 0.5)) / style.floretsPerHead;
    const r = Math.sqrt(1 - y * y);
    normals.push(new THREE.Vector3(Math.cos(i * golden) * r, y, Math.sin(i * golden) * r));
  }
  return normals;
}
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

/** Heads of dozens of little four-petal florets. */
function createGroup(opts: HydrangeaOptions, style: HeadStyle): THREE.Group {
  const stems = layoutBouquet({
    ...opts,
    droopScale: style.droopScale,
    freeLengthScale: style.freeLengthScale,
  });
  const group = new THREE.Group();
  const stemGroups: THREE.Group[] = [];
  const rand = mulberry32(opts.seed + 101);

  const stemMaterial = new THREE.MeshStandardMaterial({ color: style.stemHex, roughness: 0.75 });
  const petalGeometry = gridToGeometry(
    petalGrid({
      lengthM: 1,
      widthM: 0.78,
      segmentsU: style.petalSegments.u,
      segmentsV: style.petalSegments.v,
      cupM: 0.08,
      bendM: 0,
    }),
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
      new THREE.TubeGeometry(curve, 20, style.stemRadiusM, 8, false),
      stemMaterial,
    );
    stemMesh.castShadow = true;
    stemGroup.add(stemMesh);

    for (const leaf of style.leafless ? [] : stem.leaves) {
      const mesh = new THREE.Mesh(leafGeometry, leafMaterial);
      mesh.castShadow = true;
      mesh.position.copy(curve.getPointAt(leaf.t));
      mesh.scale.setScalar(leaf.lengthM * style.leafScale);
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
      new THREE.Vector3(hx * 0.6, Math.max(hy, 0) + style.upBias, hz * 0.6).normalize(),
    );

    const R = stem.headRadiusM * style.headScale;
    const headTint = new THREE.Color(
      opts.paletteHex[Math.floor(stem.colorSeed * opts.paletteHex.length)] ?? 0x7d8fd1,
    );

    // Florets over the head surface (phyllotaxis on the unit disc lifted to
    // the dome, or a Fibonacci sphere), four petals splayed around each
    // floret's surface normal.
    const florets = new THREE.InstancedMesh(
      petalGeometry,
      petalMaterial,
      style.floretsPerHead * 4,
    );
    florets.castShadow = true;
    let instance = 0;
    const openPoses: InstancePose[] = [];
    const budPoses: InstancePose[] = [];
    const shedAt = new Float32Array(style.floretsPerHead * 4);
    for (const n of floretNormals(style)) {
      const center = n.clone().multiplyScalar(R);
      const u = new THREE.Vector3()
        .crossVectors(Math.abs(n.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : UP, n)
        .normalize();
      const v = new THREE.Vector3().crossVectors(n, u);
      const spin = rand() * Math.PI;
      const petalLen = R * (style.petalLen.min + rand() * style.petalLen.jitter);
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
      sizeM: avgHeadRadiusM * style.headScale * style.petalLen.min,
      radiusM: { min: opts.vaseBaseRadiusM * 1.15, max: opts.vaseBaseRadiusM * 2.4 },
      rand,
      tint: new THREE.Color(opts.paletteHex[0] ?? 0x7d8fd1),
    }),
  );
  if (!style.leafless) {
    bloomElements.push(
      addFloorDebris(group, {
        geometry: leafGeometry,
        material: leafMaterial,
        count: Math.min(MAX_DEBRIS_INSTANCES, stems.length * 6),
        sizeM: 0.09 * style.leafScale / STYLES.hydrangea.leafScale,
        radiusM: { min: opts.vaseBaseRadiusM * 1.15, max: opts.vaseBaseRadiusM * 2.4 },
        rand,
      }),
    );
  }

  attachBreeze(group, stemGroups);
  attachBloomCycle(group, bloomElements);
  return group;
}

export const createHydrangeaGroup = (o: HydrangeaOptions): THREE.Group =>
  createGroup(o, STYLES.hydrangea);
export const createNanohanaGroup = (o: HydrangeaOptions): THREE.Group =>
  createGroup(o, STYLES.nanohana);
export const createAlliumGroup = (o: HydrangeaOptions): THREE.Group => createGroup(o, STYLES.allium);
