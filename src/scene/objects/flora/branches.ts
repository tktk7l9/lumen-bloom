import * as THREE from "three";
import { furledBud } from "../../../engine/geometry/floraMeshes";
import { mulberry32 } from "../../../engine/geometry/prng";
import { type PetalGrid, petalGrid } from "../../../engine/geometry/petalGrid";
import { spiralBloom } from "../../../engine/geometry/spiralBloom";
import {
  type BloomElement,
  type InstancePose,
  MAX_DEBRIS_INSTANCES,
  addAnimatedInstances,
  addFloorDebris,
  attachBloomCycle,
  composePose,
  orientedPose,
  ringPose,
} from "../bloomRig";
import { attachBreeze, gridToGeometry } from "../flowers";
import { meshDataToGeometry } from "./meshData";

const UP = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);
// Blossom petals splay open around the adornment spot's own outward normal —
// same u/v/normal mixing as the built shape, weighted differently for a
// folded bud vs the flat splayed-open look.
const BUD_SPLAY_WEIGHT = 0.2;
const BUD_AXIS_WEIGHT = 0.98;
const OPEN_SPLAY_WEIGHT = 0.85;
const OPEN_AXIS_WEIGHT = 0.55;
const BUD_LENGTH_FRAC = 0.4;
// Berries have no petal to open — they ripen in place (small → full size).
const BERRY_BUD_FRAC = 0.35;
// The berry cluster's own accompanying leaves unfurl and wilt the same way
// as a flower species' stem leaves — linked to the same weekly cycle.
const LEAF_BUD_FRAC = 0.4;

export type BranchAdornment =
  /**
   * Small five-petalled blossoms (ume, sakura, momo, roubai). `petalCount`,
   * `size` and `density` reshape it into the dogwood's four big bracts
   * around a green button, spaced further apart.
   */
  | {
      type: "blossom";
      petalHex: number;
      centerHex: number;
      petalCount?: number;
      size?: { min: number; jitter: number };
      density?: number;
    }
  | { type: "leaf"; leafHexes: readonly number[] }
  | { type: "berry"; berryHex: number; leafHex: number }
  /**
   * Kinmokusei (fragrant olive): glossy elliptic evergreen leaves in
   * opposite, decussate pairs at close nodes, with a tuft of tiny
   * four-petalled flowers packed into each leaf axil.
   */
  | { type: "osmanthus"; flowerHex: number; leafHex: number }
  /**
   * Camellia family: a few large single blooms with a stamen column among
   * glossy evergreen leaves. `cup` is tsubaki (petals rise around the
   * stamens, and the whole flower drops at once — petals and stamens are
   * fused at the base); `flat` is sazanka (opens wide, sheds petal by petal);
   * `magnolia` is the mokuren's tall narrow-petalled cup on a bare branch.
   */
  | {
      type: "camellia";
      petalHex: number;
      stamenHex: number;
      leafHex: number;
      form: "cup" | "flat" | "magnolia";
      leafless?: boolean;
    }
  /**
   * Wisteria: pendent racemes of small pea flowers hanging from the
   * branches, each raceme opening from the top and tapering to budded
   * tips, with a few pinnate leaves between them.
   */
  | { type: "raceme"; flowerHex: number; tipHex: number; leafHex: number }
  /** Pine: tufts of long needles along every twig — evergreen, nothing opens or falls. */
  | { type: "needle"; needleHex: number }
  /**
   * Gardenia (kuchinashi): big glossy leaves in opposite pairs crowding up
   * to the shoot tips, a double bloom of thick, creamy petals spiralling in
   * at the tip of most twigs and a long twisted bud on the rest. The petals
   * yellow as the flower ages and drop one by one.
   */
  | { type: "gardenia"; petalHex: number; throatHex: number; leafHex: number };

const CAMELLIA_FORMS = {
  cup: {
    petalCount: 6,
    splay: 0.62,
    axis: 0.78,
    stamenHeight: 1,
    stamenWidth: 1,
    shedWhole: true,
    petal: { widthM: 0.95, cupM: 0.22, bendM: -0.08 },
    size: { min: 0.026, jitter: 0.006 },
    bloomEvery: 6,
  },
  flat: {
    petalCount: 7,
    splay: 0.86,
    axis: 0.5,
    stamenHeight: 0.7,
    stamenWidth: 1.4,
    shedWhole: false,
    petal: { widthM: 0.95, cupM: 0.22, bendM: -0.08 },
    size: { min: 0.026, jitter: 0.006 },
    bloomEvery: 6,
  },
  magnolia: {
    petalCount: 6,
    splay: 0.48,
    axis: 0.88,
    stamenHeight: 0.9,
    stamenWidth: 0.5,
    shedWhole: false,
    petal: { widthM: 0.6, cupM: 0.2, bendM: -0.16 },
    size: { min: 0.032, jitter: 0.008 },
    bloomEvery: 4,
  },
} as const;
const CAMELLIA_BUD_LENGTH_FRAC = 0.45;
const CAMELLIA_STAMEN_BUD_FRAC = 0.3;

const RACEME_FLOWER_SPACING_M = 0.0038;
const RACEME_FLOWER_M = 0.0105;
const RACEME_BUD_FRAC = 0.35;
const NEEDLES_PER_TUFT = 16;

/**
 * One small pea flower facing +Z: a rounded standard petal fanning up
 * (+Y), two wings hanging down and forward, and a short keel between them.
 * Shades are baked as brightness so the instance color supplies the hue.
 */
function peaFlowerGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const push = (shade: number, ...pts: number[][]): void => {
    for (const p of pts) {
      positions.push(...p);
      colors.push(shade, shade, shade);
    }
  };
  // Standard: a fan of three triangles from just above the origin.
  const fan = [30, 70, 110, 150].map((deg) => {
    const a = (deg * Math.PI) / 180;
    return [Math.cos(a) * 0.5, 0.05 + Math.sin(a) * 0.5, -0.1];
  });
  for (let i = 0; i < 3; i++) push(1, [0, 0.05, 0], fan[i], fan[i + 1]);
  // Wings, deeper in tone, and a pale keel.
  push(0.78, [0, 0.02, 0], [-0.3, -0.42, 0.15], [-0.08, -0.5, 0.25]);
  push(0.78, [0, 0.02, 0], [0.08, -0.5, 0.25], [0.3, -0.42, 0.15]);
  push(0.92, [0, 0, 0], [-0.06, -0.45, 0.28], [0.06, -0.45, 0.28]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

// Gardenia: shorter, leafier stems than the other cut branches, leaf pairs
// only on the upper stretch, one double bloom per twig tip.
const GARDENIA_RISE_SCALE = 0.86;
const GARDENIA_NODE_SPACING_M = 0.034;
const GARDENIA_PETALS = 22;
const GARDENIA_PETAL_M = { min: 0.038, jitter: 0.008 };
const GARDENIA_BUD_M = 0.032;
const GARDENIA_CALYX_HEX = 0x6d8f45;
/** Fresh white petals turn this ivory-yellow as the flower ages. */
const GARDENIA_AGED_HEX = 0xe8cf86;
const GARDENIA_AGE_WEIGHT = 0.75;

/**
 * Leaf blade with the base→tip gradient plus a pale midrib down the center
 * column — on big glossy leaves (gardenia) the vein is what reads as "leaf"
 * rather than "green paddle".
 */
function midribLeafGeometry(grid: PetalGrid, baseHex: number, tipHex: number, midribHex: number): THREE.BufferGeometry {
  const geometry = gridToGeometry(grid, baseHex, tipHex);
  const colors = geometry.getAttribute("color") as THREE.BufferAttribute;
  const midrib = new THREE.Color(midribHex);
  const scratch = new THREE.Color();
  const center = Math.floor(grid.cols / 2);
  for (let iu = 0; iu < grid.rows - 1; iu++) {
    const i = iu * grid.cols + center;
    scratch.setRGB(colors.getX(i), colors.getY(i), colors.getZ(i)).lerp(midrib, 0.6);
    colors.setXYZ(i, scratch.r, scratch.g, scratch.b);
  }
  colors.needsUpdate = true;
  return geometry;
}

export interface BranchOptions {
  branchCount: number;
  seed: number;
  branchHex: number;
  adorn: BranchAdornment;
  vaseRimYM: number;
  vaseNeckRadiusM: number;
  vaseBaseRadiusM: number;
}

interface AdornSpot {
  position: THREE.Vector3;
  /** Outward-ish direction away from the branch. */
  normal: THREE.Vector3;
  /** Branch direction at the spot (leaves lean along it). */
  tangent: THREE.Vector3;
}

/** Sample adornment spots along the upper portion of a curve. */
function spotsAlong(
  curve: THREE.CatmullRomCurve3,
  count: number,
  fromT: number,
  rand: () => number,
): AdornSpot[] {
  const spots: AdornSpot[] = [];
  for (let i = 0; i < count; i++) {
    const t = fromT + (1 - fromT) * ((i + rand() * 0.8) / count);
    const position = curve.getPointAt(Math.min(t, 0.995));
    const tangent = curve.getTangentAt(Math.min(t, 0.995));
    const around = rand() * Math.PI * 2;
    const u = new THREE.Vector3()
      .crossVectors(Math.abs(tangent.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : UP, tangent)
      .normalize();
    const v = new THREE.Vector3().crossVectors(tangent, u);
    const normal = u
      .clone()
      .multiplyScalar(Math.cos(around))
      .addScaledVector(v, Math.sin(around))
      .addScaledVector(UP, 0.35)
      .normalize();
    spots.push({ position, normal, tangent: tangent.clone() });
  }
  return spots;
}

interface LeafNode {
  position: THREE.Vector3;
  tangent: THREE.Vector3;
  /** Unit direction of the node's first leaf, perpendicular to the branch; its partner sits opposite. */
  out: THREE.Vector3;
  /** The youngest pair at the twig tip — leaves only, no flowers. */
  tip: boolean;
}

/**
 * Evenly spaced nodes with opposite, decussate leaf pairs (each pair turned
 * 90° from the one below), as on osmanthus and other Oleaceae twigs.
 */
function decussateNodes(
  curve: THREE.CatmullRomCurve3,
  fromT: number,
  spacingM: number,
  rand: () => number,
): LeafNode[] {
  const span = curve.getLength() * (1 - fromT);
  const count = Math.max(2, Math.round(span / spacingM));
  const phase = rand() * Math.PI;
  const nodes: LeafNode[] = [];
  for (let i = 0; i < count; i++) {
    const t = Math.min(fromT + (1 - fromT) * ((i + 0.3 + rand() * 0.25) / count), 0.985);
    const position = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t);
    const u = new THREE.Vector3()
      .crossVectors(Math.abs(tangent.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : UP, tangent)
      .normalize();
    const v = new THREE.Vector3().crossVectors(tangent, u);
    const angle = phase + i * (Math.PI / 2) + (rand() - 0.5) * 0.3;
    const out = u.multiplyScalar(Math.cos(angle)).addScaledVector(v, Math.sin(angle)).normalize();
    nodes.push({ position, tangent, out, tip: i === count - 1 });
  }
  return nodes;
}

/**
 * One tiny four-petalled osmanthus flower lying in the XY plane, facing +Z:
 * four rounded diamond petals cupped slightly toward the face, colored
 * deeper at the throat (instance color supplies the hue).
 */
function osmanthusFlowerGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const throat = 0.72;
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const at = (along: number, across: number, z: number): number[] => [
      c * along - s * across,
      s * along + c * across,
      z,
    ];
    const center = at(0, 0, -0.05);
    const left = at(0.5, -0.32, 0.12);
    const tip = at(1, 0, 0.3);
    const right = at(0.5, 0.32, 0.12);
    positions.push(...center, ...left, ...tip, ...center, ...tip, ...right);
    for (const shade of [throat, 1, 1, throat, 1, 1]) colors.push(shade, shade * 0.97, shade * 0.92);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

const OSMANTHUS_NODE_SPACING_M = 0.022;
const OSMANTHUS_FLOWERS_PER_AXIL = 6;
const OSMANTHUS_FLOWER_M = 0.0047;
const OSMANTHUS_BUD_FRAC = 0.4;

/**
 * Cut branches (ume plum, sakura cherry, momiji maple, nanten, camellia, osmanthus, gardenia): a leaning main branch with two side
 * shoots per stem, adorned with instanced blossoms, leaves, or berry
 * clusters along the upper reaches.
 */
export function createBranchesGroup(opts: BranchOptions): THREE.Group {
  const group = new THREE.Group();
  const stemGroups: THREE.Group[] = [];
  const rand = mulberry32(opts.seed);

  const barkMaterial = new THREE.MeshStandardMaterial({ color: opts.branchHex, roughness: 0.85 });

  // Shared adornment geometries/materials.
  const petalGeometry = gridToGeometry(
    petalGrid({ lengthM: 1, widthM: 0.7, segmentsU: 4, segmentsV: 3, cupM: 0.14, bendM: 0.03 }),
    0xc9c9c9,
    0xffffff,
  );
  const petalMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.55,
    side: THREE.DoubleSide,
  });
  const leafGeometry = gridToGeometry(
    petalGrid({ lengthM: 1, widthM: 0.8, segmentsU: 6, segmentsV: 5, cupM: -0.06, bendM: 0.18 }),
    0xc0c0c0,
    0xffffff,
  );
  const leafMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.62,
    side: THREE.DoubleSide,
  });
  const sphereGeometry = new THREE.SphereGeometry(1, 8, 6);
  // Camellia-only assets: broad rounded petals and glossy elliptic leaves.
  const camellia = opts.adorn.type === "camellia" ? opts.adorn : null;
  const camelliaForm = camellia ? CAMELLIA_FORMS[camellia.form] : null;
  const berry = opts.adorn.type === "berry" ? opts.adorn : null;
  const osmanthus = opts.adorn.type === "osmanthus" ? opts.adorn : null;
  const blossom = opts.adorn.type === "blossom" ? opts.adorn : null;
  const raceme = opts.adorn.type === "raceme" ? opts.adorn : null;
  const needle = opts.adorn.type === "needle" ? opts.adorn : null;
  const blossomPetalCount = blossom?.petalCount ?? 5;
  const blossomSize = blossom?.size ?? { min: 0.009, jitter: 0.004 };
  const spotDensity = blossom?.density ?? (needle ? 1.4 : 1);
  // Wisteria and pine assets: the pea flower shared by the racemes and the
  // fallen carpet, and a thin two-tone needle blade.
  const peaGeometry = raceme ? peaFlowerGeometry() : petalGeometry;
  const needleGeometry = needle
    ? gridToGeometry(
        petalGrid({ lengthM: 1, widthM: 0.035, segmentsU: 2, segmentsV: 1, cupM: 0, bendM: 0.06 }),
        new THREE.Color(needle.needleHex).multiplyScalar(0.55).getHex(),
        needle.needleHex,
      )
    : leafGeometry;
  const rachisMaterial = new THREE.MeshStandardMaterial({ color: 0x8a9a6a, roughness: 0.8 });
  // Osmanthus: narrow elliptic leaves, dark at the midrib base, and the
  // tiny flower shared by the axil tufts and the fallen carpet on the floor.
  const osmanthusLeafGeometry = osmanthus
    ? gridToGeometry(
        petalGrid({ lengthM: 1, widthM: 0.5, segmentsU: 4, segmentsV: 2, cupM: 0.03, bendM: -0.06 }),
        new THREE.Color(osmanthus.leafHex).multiplyScalar(0.6).getHex(),
        osmanthus.leafHex,
      )
    : leafGeometry;
  const osmanthusFlowerGeometryShared = osmanthus ? osmanthusFlowerGeometry() : petalGeometry;
  const camelliaPetalGeometry = camelliaForm
    ? gridToGeometry(
        petalGrid({ lengthM: 1, segmentsU: 6, segmentsV: 5, ...camelliaForm.petal }),
        0xbdbdbd,
        0xffffff,
      )
    : petalGeometry;
  const camelliaLeafGeometry = camellia
    ? gridToGeometry(
        petalGrid({ lengthM: 1, widthM: 0.5, segmentsU: 6, segmentsV: 4, cupM: 0.05, bendM: -0.1 }),
        new THREE.Color(camellia.leafHex).multiplyScalar(0.55).getHex(),
        camellia.leafHex,
      )
    : leafGeometry;
  const camelliaLeafMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.3,
    side: THREE.DoubleSide,
  });
  // Gardenia-only assets: rounded, cupped waxy petals (cream at the base),
  // big glossy leaves with a pale midrib, and the twisted bud.
  const gardenia = opts.adorn.type === "gardenia" ? opts.adorn : null;
  const gardeniaPetalGeometry = gardenia
    ? gridToGeometry(
        petalGrid({ lengthM: 1, widthM: 0.7, segmentsU: 6, segmentsV: 4, cupM: 0.15, bendM: 0.05, widthExponent: 0.35 }),
        new THREE.Color(0xffffff).lerp(new THREE.Color(gardenia.throatHex), 0.6).getHex(),
        0xffffff,
      )
    : petalGeometry;
  const gardeniaPetalMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.4,
    side: THREE.DoubleSide,
  });
  const gardeniaLeafGeometry = gardenia
    ? midribLeafGeometry(
        petalGrid({ lengthM: 1, widthM: 0.5, segmentsU: 6, segmentsV: 4, cupM: -0.05, bendM: 0.06, widthExponent: 0.75 }),
        new THREE.Color(gardenia.leafHex).multiplyScalar(0.55).getHex(),
        gardenia.leafHex,
        new THREE.Color(gardenia.leafHex).lerp(new THREE.Color(0xa9c784), 0.5).getHex(),
      )
    : leafGeometry;
  const budGreen = new THREE.Color(0x7d9c55);
  const budCream = new THREE.Color(0xf1ecd8);
  const gardeniaBudGeometry = gardenia
    ? meshDataToGeometry(furledBud(), (shade, [, y]) =>
        budGreen.clone().lerp(budCream, THREE.MathUtils.smoothstep(y, 0.2, 0.75)).multiplyScalar(shade),
      )
    : sphereGeometry;
  const gardeniaBudMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 });
  const calyxMaterial = new THREE.MeshStandardMaterial({ color: GARDENIA_CALYX_HEX, roughness: 0.7 });
  const stamenGeometry = new THREE.CylinderGeometry(0.2, 0.26, 0.55, 8);
  stamenGeometry.translate(0, 0.275, 0);
  const stamenMaterial = camellia
    ? new THREE.MeshStandardMaterial({ color: camellia.stamenHex, roughness: 0.75 })
    : null;
  const centerMaterial =
    opts.adorn.type === "blossom"
      ? new THREE.MeshStandardMaterial({ color: opts.adorn.centerHex, roughness: 0.8 })
      : null;
  const berryMaterial =
    opts.adorn.type === "berry"
      ? new THREE.MeshStandardMaterial({ color: opts.adorn.berryHex, roughness: 0.35 })
      : null;

  const matrix = new THREE.Matrix4();
  const dir = new THREE.Vector3();
  const side = new THREE.Vector3();
  const pnormal = new THREE.Vector3();
  const color = new THREE.Color();
  const bloomElements: BloomElement[] = [];

  function petalPose(
    u: THREE.Vector3,
    v: THREE.Vector3,
    n: THREE.Vector3,
    a: number,
    splay: number,
    axis: number,
    length: number,
    center: THREE.Vector3,
  ): InstancePose {
    dir
      .copy(u)
      .multiplyScalar(Math.cos(a))
      .addScaledVector(v, Math.sin(a))
      .multiplyScalar(splay)
      .addScaledVector(n, axis)
      .normalize();
    side.crossVectors(n, dir).normalize();
    pnormal.crossVectors(side, dir);
    matrix.makeBasis(side, dir, pnormal);
    return {
      position: center.clone(),
      quaternion: new THREE.Quaternion().setFromRotationMatrix(matrix),
      scale: new THREE.Vector3(length, length, length),
    };
  }

  for (let b = 0; b < Math.max(1, opts.branchCount); b++) {
    const stemGroup = new THREE.Group();
    const az = ((b / opts.branchCount) * 360 + (rand() - 0.5) * 70) * (Math.PI / 180);
    const cos = Math.cos(az);
    const sin = Math.sin(az);

    // Vase statics: the cut end rests against the base interior on the far
    // side of the lean, the branch pivots on the near rim edge, and rises
    // stiffly at that pivot angle (branches barely droop, unlike stems).
    const footR = opts.vaseBaseRadiusM * 0.6 * (0.4 + rand() * 0.6);
    const rimR = opts.vaseNeckRadiusM * (0.82 + rand() * 0.1);
    const rimY = opts.vaseRimYM - 0.008;
    const leanRad = Math.atan2(rimR + footR, rimY - 0.045);
    const out = Math.sin(leanRad);
    const up = Math.cos(leanRad);

    const riseM = (0.26 + rand() * 0.12) * (gardenia ? GARDENIA_RISE_SCALE : 1);
    const wiggle = (rand() - 0.5) * 0.05;

    const along = (dist: number, w: number): THREE.Vector3 =>
      new THREE.Vector3(
        cos * (rimR + out * dist) - sin * w,
        rimY + up * dist,
        sin * (rimR + out * dist) + cos * w,
      );

    const main = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-cos * footR, 0.045, -sin * footR),
      new THREE.Vector3(cos * rimR, rimY, sin * rimR),
      along(riseM * 0.4, wiggle),
      along(riseM * 0.75, -wiggle),
      along(riseM, wiggle * 0.4),
    ]);
    const mainMesh = new THREE.Mesh(new THREE.TubeGeometry(main, 24, 0.0038, 7, false), barkMaterial);
    mainMesh.castShadow = true;
    stemGroup.add(mainMesh);

    // Side shoots off the upper half of the main branch (osmanthus twigs
    // are bushier: three).
    const curves: THREE.CatmullRomCurve3[] = [main];
    for (const shootT of osmanthus ? [0.5, 0.66, 0.82] : [0.58, 0.8]) {
      const start = main.getPointAt(shootT);
      const tangent = main.getTangentAt(shootT);
      const spread = rand() * Math.PI * 2;
      const u = new THREE.Vector3()
        .crossVectors(Math.abs(tangent.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : UP, tangent)
        .normalize();
      const v = new THREE.Vector3().crossVectors(tangent, u);
      const out = u
        .clone()
        .multiplyScalar(Math.cos(spread))
        .addScaledVector(v, Math.sin(spread))
        .addScaledVector(tangent, osmanthus ? 0.75 : 1.2)
        .addScaledVector(UP, 0.4)
        .normalize();
      const len = (osmanthus ? 0.11 : 0.09) + rand() * 0.06;
      const child = new THREE.CatmullRomCurve3([
        start,
        start.clone().addScaledVector(out, len * 0.5).addScaledVector(UP, len * 0.08),
        start.clone().addScaledVector(out, len).addScaledVector(UP, len * 0.22),
      ]);
      const childMesh = new THREE.Mesh(
        new THREE.TubeGeometry(child, 12, 0.0022, 6, false),
        barkMaterial,
      );
      childMesh.castShadow = true;
      stemGroup.add(childMesh);
      curves.push(child);
    }

    // Adornments along the main (upper 45%) and each shoot (whole length).
    const spots: AdornSpot[] = osmanthus
      ? []
      : [
          ...spotsAlong(main, Math.round(11 * spotDensity), 0.55, rand),
          ...spotsAlong(curves[1], Math.round(6 * spotDensity), 0.15, rand),
          ...spotsAlong(curves[2], Math.round(6 * spotDensity), 0.15, rand),
        ];

    if (raceme) {
      // Racemes hang from every third spot; the spots between carry a leaf.
      const racemeSpots = spots.filter((_, i) => i % 3 === 0);
      const leafSpots = spots.filter((_, i) => i % 3 !== 0);
      const flowerOpen: InstancePose[] = [];
      const flowerBud: InstancePose[] = [];
      const flowerShed: number[] = [];
      const flowerColors: THREE.Color[] = [];
      const open = new THREE.Color(raceme.flowerHex);
      const tipColor = new THREE.Color(raceme.tipHex);
      const drift = new THREE.Vector3();
      const radial = new THREE.Vector3();
      for (const spot of racemeSpots) {
        // The rachis hangs straight down with a little outward drift, as a
        // thin green cord; the flowers spiral around it.
        const length = 0.11 + rand() * 0.06;
        drift.set(spot.normal.x, 0, spot.normal.z).normalize();
        const rachis = new THREE.CatmullRomCurve3([
          spot.position.clone(),
          spot.position.clone().addScaledVector(drift, 0.012).addScaledVector(UP, -length * 0.5),
          spot.position.clone().addScaledVector(drift, 0.02).addScaledVector(UP, -length),
        ]);
        const rachisMesh = new THREE.Mesh(new THREE.TubeGeometry(rachis, 6, 0.0007, 4, false), rachisMaterial);
        stemGroup.add(rachisMesh);
        const count = Math.round(length / RACEME_FLOWER_SPACING_M);
        const spin = rand() * Math.PI * 2;
        for (let k = 0; k < count; k++) {
          const t = (k + 0.5) / count;
          const on = rachis.getPointAt(t);
          // Two flowers per level, opposite each other, spiralling down.
          for (const half of [0, Math.PI]) {
            const a = spin + k * 2.399963 + half;
            radial.set(Math.cos(a), 0, Math.sin(a));
            const position = on.clone().addScaledVector(radial, 0.004);
            const s = RACEME_FLOWER_M * (1 - 0.35 * t) * (0.9 + rand() * 0.2);
            flowerOpen.push(orientedPose(position, UP, radial, s));
            flowerBud.push(orientedPose(on.clone().addScaledVector(radial, 0.0012), UP, radial, s * RACEME_BUD_FRAC));
            // The top of the raceme opens (and drops) first.
            flowerShed.push(0.25 + rand() * 0.45 + t * 0.3);
            flowerColors.push(
              open
                .clone()
                .lerp(tipColor, THREE.MathUtils.smoothstep(t, 0.55, 1))
                .offsetHSL(0, 0, (rand() - 0.5) * 0.06),
            );
          }
        }
      }
      const flowers = new THREE.InstancedMesh(peaGeometry, petalMaterial, flowerOpen.length);
      flowers.castShadow = true;
      flowerColors.forEach((c, i) => flowers.setColorAt(i, c));
      if (flowers.instanceColor) flowers.instanceColor.needsUpdate = true;
      stemGroup.add(flowers);
      bloomElements.push(addAnimatedInstances(flowers, flowerOpen, flowerBud, flowerShed));

      const leaves = new THREE.InstancedMesh(leafGeometry, leafMaterial, leafSpots.length);
      leaves.castShadow = true;
      color.setHex(raceme.leafHex);
      const leafPoses: InstancePose[] = [];
      leafSpots.forEach((spot, i) => {
        dir.copy(spot.normal).addScaledVector(spot.tangent, 0.5).addScaledVector(UP, -0.25).normalize();
        leafPoses.push(orientedPose(spot.position, dir, UP, new THREE.Vector3(0.028, 0.04 + rand() * 0.012, 0.03)));
        leaves.setColorAt(i, color);
      });
      if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
      stemGroup.add(leaves);
      bloomElements.push(addAnimatedInstances(leaves, leafPoses, leafPoses, new Float32Array(leafPoses.length).fill(2)));
    } else if (needle) {
      // A fascicle of needles at every spot, all leaning forward along the
      // twig and fanning around it.
      const poses: InstancePose[] = [];
      const u = new THREE.Vector3();
      const v = new THREE.Vector3();
      for (const spot of spots) {
        u.crossVectors(Math.abs(spot.tangent.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : UP, spot.tangent).normalize();
        v.crossVectors(spot.tangent, u);
        for (let k = 0; k < NEEDLES_PER_TUFT; k++) {
          const a = rand() * Math.PI * 2;
          const fan = 0.3 + rand() * 0.4;
          dir
            .copy(spot.tangent)
            .multiplyScalar(0.7)
            .addScaledVector(u, Math.cos(a) * fan)
            .addScaledVector(v, Math.sin(a) * fan)
            .addScaledVector(UP, 0.08)
            .normalize();
          const length = 0.034 + rand() * 0.018;
          poses.push(orientedPose(spot.position, dir, UP, length));
        }
      }
      const needles = new THREE.InstancedMesh(needleGeometry, leafMaterial, poses.length);
      needles.castShadow = true;
      stemGroup.add(needles);
      // Evergreen: needles neither open nor fall within the week.
      bloomElements.push(addAnimatedInstances(needles, poses, poses, new Float32Array(poses.length).fill(2)));
    } else if (osmanthus) {
      const nodes = [
        ...decussateNodes(main, 0.5, OSMANTHUS_NODE_SPACING_M, rand),
        ...curves.slice(1).flatMap((c) => decussateNodes(c, 0.12, OSMANTHUS_NODE_SPACING_M, rand)),
      ];
      // Every node holds a leaf pair; all but the youngest (tip) pair of
      // each twig carry a tuft of flowers in both axils.
      const leafPoses: InstancePose[] = [];
      const flowerOpen: InstancePose[] = [];
      const flowerBud: InstancePose[] = [];
      const flowerShed: number[] = [];
      const flowerColors: THREE.Color[] = [];
      const tuftAxis = new THREE.Vector3();
      const flowerNormal = new THREE.Vector3();
      const tint = new THREE.Color(osmanthus.flowerHex);
      for (const node of nodes) {
        for (const sign of [1, -1]) {
          const out = node.out.clone().multiplyScalar(sign);
          // Leaves angle up and out along the twig, the tip drooping a touch.
          dir.copy(out).multiplyScalar(0.85).addScaledVector(node.tangent, 0.52).addScaledVector(UP, -0.08).normalize();
          const size = (node.tip ? 0.026 : 0.04) + rand() * 0.012;
          const base = node.position.clone().addScaledVector(out, 0.0015);
          leafPoses.push(orientedPose(base, dir, UP, size));
          if (node.tip) continue;
          // The tuft sits in the axil — between the leaf base and the twig.
          tuftAxis.copy(out).multiplyScalar(0.7).addScaledVector(node.tangent, 0.7).normalize();
          const tuftCenter = node.position.clone().addScaledVector(tuftAxis, 0.0055);
          for (let k = 0; k < OSMANTHUS_FLOWERS_PER_AXIL; k++) {
            const jitter = new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5);
            const position = tuftCenter.clone().addScaledVector(jitter, 0.009);
            flowerNormal.copy(tuftAxis).addScaledVector(jitter, 1.6).normalize();
            const quaternion = new THREE.Quaternion().setFromUnitVectors(Z_AXIS, flowerNormal);
            quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(Z_AXIS, rand() * Math.PI));
            const s = OSMANTHUS_FLOWER_M * (0.85 + rand() * 0.3);
            flowerOpen.push({ position, quaternion, scale: new THREE.Vector3(s, s, s) });
            flowerBud.push({
              position: position.clone().lerp(tuftCenter, 0.5),
              quaternion,
              scale: new THREE.Vector3(s, s, s).multiplyScalar(OSMANTHUS_BUD_FRAC),
            });
            flowerShed.push(rand());
            flowerColors.push(tint.clone().offsetHSL((rand() - 0.5) * 0.02, 0, (rand() - 0.5) * 0.08));
          }
        }
      }

      // Evergreen: the leaves neither unfurl nor fall within the week.
      const leaves = new THREE.InstancedMesh(osmanthusLeafGeometry, camelliaLeafMaterial, leafPoses.length);
      leaves.castShadow = true;
      stemGroup.add(leaves);
      bloomElements.push(
        addAnimatedInstances(leaves, leafPoses, leafPoses, new Float32Array(leafPoses.length).fill(2)),
      );

      const flowers = new THREE.InstancedMesh(osmanthusFlowerGeometryShared, petalMaterial, flowerOpen.length);
      flowers.castShadow = true;
      flowerColors.forEach((c, i) => flowers.setColorAt(i, c));
      if (flowers.instanceColor) flowers.instanceColor.needsUpdate = true;
      stemGroup.add(flowers);
      bloomElements.push(addAnimatedInstances(flowers, flowerOpen, flowerBud, flowerShed));
    } else if (blossom) {
      const blossoms = new THREE.InstancedMesh(petalGeometry, petalMaterial, spots.length * blossomPetalCount);
      blossoms.castShadow = true;
      const centers = new THREE.InstancedMesh(sphereGeometry, centerMaterial as THREE.Material, spots.length);
      color.setHex(blossom.petalHex);
      let instance = 0;
      const openPoses: InstancePose[] = [];
      const budPoses: InstancePose[] = [];
      const shedAt = new Float32Array(spots.length * blossomPetalCount);
      spots.forEach((spot, si) => {
        const u = new THREE.Vector3()
          .crossVectors(Math.abs(spot.normal.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : UP, spot.normal)
          .normalize();
        const v = new THREE.Vector3().crossVectors(spot.normal, u);
        const spin = rand() * Math.PI;
        const size = blossomSize.min + rand() * blossomSize.jitter;
        for (let k = 0; k < blossomPetalCount; k++) {
          const a = spin + (k / blossomPetalCount) * Math.PI * 2;
          openPoses.push(
            petalPose(u, v, spot.normal, a, OPEN_SPLAY_WEIGHT, OPEN_AXIS_WEIGHT, size, spot.position),
          );
          budPoses.push(
            petalPose(
              u,
              v,
              spot.normal,
              a,
              BUD_SPLAY_WEIGHT,
              BUD_AXIS_WEIGHT,
              size * BUD_LENGTH_FRAC,
              spot.position,
            ),
          );
          shedAt[instance] = rand();
          blossoms.setColorAt(instance, color);
          instance++;
        }
        const cs = size * (blossomPetalCount === 5 ? 0.22 : 0.36);
        matrix.makeScale(cs, cs, cs);
        matrix.setPosition(
          spot.position.x + spot.normal.x * 0.001,
          spot.position.y + spot.normal.y * 0.001,
          spot.position.z + spot.normal.z * 0.001,
        );
        centers.setMatrixAt(si, matrix);
      });
      if (blossoms.instanceColor) blossoms.instanceColor.needsUpdate = true;
      centers.instanceMatrix.needsUpdate = true;
      stemGroup.add(blossoms, centers);
      bloomElements.push(addAnimatedInstances(blossoms, openPoses, budPoses, shedAt));
    } else if (gardenia) {
      // Opposite leaf pairs on the upper stretch of the main stem and along
      // each shoot; the youngest pair makes a collar under the bloom.
      const nodes = [
        ...decussateNodes(main, 0.62, GARDENIA_NODE_SPACING_M, rand),
        ...curves.slice(1).flatMap((c) => decussateNodes(c, 0.25, GARDENIA_NODE_SPACING_M, rand)),
      ];
      const leafPoses: InstancePose[] = [];
      for (const node of nodes) {
        for (const sign of [1, -1]) {
          const out = node.out.clone().multiplyScalar(sign);
          dir.copy(out).multiplyScalar(0.9).addScaledVector(node.tangent, 0.4).addScaledVector(UP, -0.04).normalize();
          const size = (node.tip ? 0.048 : 0.056) + rand() * 0.014;
          leafPoses.push(orientedPose(node.position.clone().addScaledVector(out, 0.002), dir, UP, size));
        }
      }
      // Evergreen: the leaves neither unfurl nor fall within the week.
      const leaves = new THREE.InstancedMesh(gardeniaLeafGeometry, camelliaLeafMaterial, leafPoses.length);
      leaves.name = "gardenia-leaves";
      leaves.castShadow = true;
      stemGroup.add(leaves);
      bloomElements.push(
        addAnimatedInstances(leaves, leafPoses, leafPoses, new Float32Array(leafPoses.length).fill(2)),
      );

      // Every twig tip carries a double bloom except one, still a twisted bud.
      const budTwig = Math.floor(rand() * curves.length);
      const petalOpen: InstancePose[] = [];
      const petalBud: InstancePose[] = [];
      const petalShed: number[] = [];
      const fresh: THREE.Color[] = [];
      const calyxOpen: InstancePose[] = [];
      const calyxBud: InstancePose[] = [];
      const budOpen: InstancePose[] = [];
      const budBud: InstancePose[] = [];
      const petalColor = new THREE.Color(gardenia.petalHex);
      curves.forEach((twig, ti) => {
        const tip = twig.getPointAt(1);
        const facing = twig.getTangentAt(1).addScaledVector(UP, 0.9).normalize();
        const quaternion = new THREE.Quaternion().setFromUnitVectors(UP, facing);
        if (ti === budTwig) {
          const s = GARDENIA_BUD_M * (0.9 + rand() * 0.2);
          budOpen.push({ position: tip.clone(), quaternion, scale: new THREE.Vector3(s, s, s) });
          budBud.push({ position: tip.clone(), quaternion, scale: new THREE.Vector3(s, s, s).multiplyScalar(0.6) });
          return;
        }
        const L = GARDENIA_PETAL_M.min + rand() * GARDENIA_PETAL_M.jitter;
        const center = tip.clone().addScaledVector(facing, L * 0.1);
        const spiral = spiralBloom({
          petals: GARDENIA_PETALS,
          seed: opts.seed * 13 + b * 3 + ti,
          tiltDeg: { outer: -8, inner: 76 },
          innerLength: 0.48,
          radius: { outer: 0.13, inner: 0.02 },
          innerLift: 0.2,
        });
        for (const p of spiral) {
          const open = ringPose(0, 1, p.radius * L, p.lift * L, p.tiltDeg, p.length * L, p.azimuthRad);
          // Furled: every petal stands up around the axis, short, wrapped tight.
          const furled = ringPose(0, 1, p.radius * L * 0.3, p.lift * L * 0.4, 84, p.length * L * 0.5, p.azimuthRad);
          petalOpen.push(composePose(center, quaternion, open));
          petalBud.push(composePose(center, quaternion, furled));
          petalShed.push(0.05 + rand() * 0.9);
          fresh.push(petalColor.clone().offsetHSL(0, 0, (rand() - 0.5) * 0.04));
        }
        // The stamen column's cylinder doubles as the green calyx cup under each bloom.
        const calyx = { position: tip.clone(), quaternion, scale: new THREE.Vector3(L * 0.42, L * 0.5, L * 0.42) };
        calyxOpen.push(calyx);
        calyxBud.push({ ...calyx, scale: calyx.scale.clone().multiplyScalar(0.7) });
      });

      const petals = new THREE.InstancedMesh(gardeniaPetalGeometry, gardeniaPetalMaterial, petalOpen.length);
      petals.name = "gardenia-petals";
      petals.castShadow = true;
      fresh.forEach((c, i) => petals.setColorAt(i, c));
      if (petals.instanceColor) petals.instanceColor.needsUpdate = true;
      stemGroup.add(petals);
      bloomElements.push(addAnimatedInstances(petals, petalOpen, petalBud, petalShed));
      // The petals yellow as the flower ages, toward the end of the week
      // (re-uploaded only when the tone actually changes).
      const aged = new THREE.Color(GARDENIA_AGED_HEX);
      let agedBy = 0;
      bloomElements.push({
        applyStage(stage) {
          const k = GARDENIA_AGE_WEIGHT * stage.shedProgress;
          if (k === agedBy) return;
          agedBy = k;
          fresh.forEach((c, i) => petals.setColorAt(i, color.copy(c).lerp(aged, k)));
          if (petals.instanceColor) petals.instanceColor.needsUpdate = true;
        },
      });

      const calyxes = new THREE.InstancedMesh(stamenGeometry, calyxMaterial, calyxOpen.length);
      calyxes.name = "gardenia-calyxes";
      stemGroup.add(calyxes);
      bloomElements.push(addAnimatedInstances(calyxes, calyxOpen, calyxBud, new Float32Array(calyxOpen.length).fill(2)));

      const buds = new THREE.InstancedMesh(gardeniaBudGeometry, gardeniaBudMaterial, budOpen.length);
      buds.name = "gardenia-buds";
      buds.castShadow = true;
      stemGroup.add(buds);
      bloomElements.push(addAnimatedInstances(buds, budOpen, budBud, new Float32Array(budOpen.length).fill(2)));
    } else if (camellia && camelliaForm) {
      const form = camelliaForm;
      // Four blooms per branch (two on the main, one per shoot; six for a
      // magnolia), leaves on most of the remaining spots unless the branch
      // flowers bare.
      const mid = Math.floor(form.bloomEvery / 2);
      const flowerSpots = spots.filter((_, i) => i % form.bloomEvery === mid);
      const leafSpots = camellia.leafless
        ? []
        : spots.filter((_, i) => i % form.bloomEvery !== mid && i % 2 === 0);

      const petals = new THREE.InstancedMesh(
        camelliaPetalGeometry,
        petalMaterial,
        flowerSpots.length * form.petalCount,
      );
      petals.castShadow = true;
      const stamens = new THREE.InstancedMesh(
        stamenGeometry,
        stamenMaterial as THREE.Material,
        flowerSpots.length,
      );
      stamens.castShadow = true;
      color.setHex(camellia.petalHex);
      let instance = 0;
      const openPoses: InstancePose[] = [];
      const budPoses: InstancePose[] = [];
      const shedAt = new Float32Array(flowerSpots.length * form.petalCount);
      const stamenOpen: InstancePose[] = [];
      const stamenBud: InstancePose[] = [];
      const stamenShedAt = new Float32Array(flowerSpots.length);
      flowerSpots.forEach((spot, si) => {
        const u = new THREE.Vector3()
          .crossVectors(Math.abs(spot.normal.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : UP, spot.normal)
          .normalize();
        const v = new THREE.Vector3().crossVectors(spot.normal, u);
        const spin = rand() * Math.PI;
        const size = form.size.min + rand() * form.size.jitter;
        const flowerShed = rand();
        for (let k = 0; k < form.petalCount; k++) {
          const a = spin + (k / form.petalCount) * Math.PI * 2;
          openPoses.push(petalPose(u, v, spot.normal, a, form.splay, form.axis, size, spot.position));
          budPoses.push(
            petalPose(
              u,
              v,
              spot.normal,
              a,
              BUD_SPLAY_WEIGHT,
              BUD_AXIS_WEIGHT,
              size * CAMELLIA_BUD_LENGTH_FRAC,
              spot.position,
            ),
          );
          shedAt[instance] = form.shedWhole ? flowerShed : rand();
          petals.setColorAt(instance, color);
          instance++;
        }
        const quaternion = new THREE.Quaternion().setFromUnitVectors(UP, spot.normal);
        const scale = new THREE.Vector3(
          size * form.stamenWidth,
          size * form.stamenHeight,
          size * form.stamenWidth,
        );
        stamenOpen.push({ position: spot.position.clone(), quaternion, scale });
        stamenBud.push({
          position: spot.position.clone(),
          quaternion,
          scale: scale.clone().multiplyScalar(CAMELLIA_STAMEN_BUD_FRAC),
        });
        // Sazanka keeps its stamens after the petals have gone, like the
        // blossom kinds keep their centers.
        stamenShedAt[si] = form.shedWhole ? flowerShed : 2;
      });
      if (petals.instanceColor) petals.instanceColor.needsUpdate = true;
      stemGroup.add(petals, stamens);
      bloomElements.push(addAnimatedInstances(petals, openPoses, budPoses, shedAt));
      bloomElements.push(addAnimatedInstances(stamens, stamenOpen, stamenBud, stamenShedAt));

      const leaves = new THREE.InstancedMesh(camelliaLeafGeometry, camelliaLeafMaterial, leafSpots.length);
      leaves.castShadow = true;
      const leafOpenPoses: InstancePose[] = [];
      const leafBudPoses: InstancePose[] = [];
      const leafShedAt = new Float32Array(leafSpots.length);
      leafSpots.forEach((spot, i) => {
        // Leaves point outward and forward along the branch, tips drooping a touch.
        dir.copy(spot.normal).multiplyScalar(0.75).addScaledVector(spot.tangent, 0.65).addScaledVector(UP, -0.1).normalize();
        side.crossVectors(UP, dir).normalize();
        pnormal.crossVectors(side, dir);
        const size = 0.042 + rand() * 0.014;
        matrix.makeBasis(side, dir, pnormal);
        const quaternion = new THREE.Quaternion().setFromRotationMatrix(matrix);
        const scale = new THREE.Vector3(size, size, size);
        leafOpenPoses.push({ position: spot.position.clone(), quaternion, scale });
        leafBudPoses.push({
          position: spot.position.clone(),
          quaternion,
          scale: scale.clone().multiplyScalar(LEAF_BUD_FRAC),
        });
        leafShedAt[i] = rand();
      });
      stemGroup.add(leaves);
      bloomElements.push(addAnimatedInstances(leaves, leafOpenPoses, leafBudPoses, leafShedAt));
    } else if (opts.adorn.type === "leaf") {
      const leaves = new THREE.InstancedMesh(leafGeometry, leafMaterial, spots.length);
      leaves.castShadow = true;
      const hexes = opts.adorn.leafHexes;
      // Leaves don't bud open — only the shed window (last 2 days) applies,
      // so bud and open share the same pose and openness has no effect.
      const poses: InstancePose[] = [];
      const shedAt = new Float32Array(spots.length);
      spots.forEach((spot, i) => {
        dir.copy(spot.normal).addScaledVector(UP, -0.3).normalize();
        side.crossVectors(UP, dir).normalize();
        pnormal.crossVectors(side, dir);
        const size = 0.022 + rand() * 0.012;
        matrix.makeBasis(side, dir, pnormal);
        poses.push({
          position: spot.position.clone(),
          quaternion: new THREE.Quaternion().setFromRotationMatrix(matrix),
          scale: new THREE.Vector3(size, size, size),
        });
        shedAt[i] = rand();
        color.setHex(hexes[Math.floor(rand() * hexes.length)] ?? 0xc7472e);
        leaves.setColorAt(i, color);
      });
      if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
      stemGroup.add(leaves);
      bloomElements.push(addAnimatedInstances(leaves, poses, poses, shedAt));
    } else if (berry) {
      // Berries: clusters at a few spots plus a handful of green leaves.
      // Only the berries ripen+shed; the accompanying leaves stay put.
      const clusterSpots = spots.filter((_, i) => i % 3 === 0);
      const berriesPerCluster = 9;
      const berryRadiusM = 0.0034;
      const spreadM = berryRadiusM * 4;
      const berries = new THREE.InstancedMesh(
        sphereGeometry,
        berryMaterial as THREE.Material,
        clusterSpots.length * berriesPerCluster,
      );
      berries.castShadow = true;
      let instance = 0;
      const openPoses: InstancePose[] = [];
      const budPoses: InstancePose[] = [];
      const shedAt = new Float32Array(clusterSpots.length * berriesPerCluster);
      const identity = new THREE.Quaternion();
      for (const spot of clusterSpots) {
        for (let k = 0; k < berriesPerCluster; k++) {
          const r = berryRadiusM * (1 + rand() * 0.3);
          const position = new THREE.Vector3(
            spot.position.x + spot.normal.x * r * 1.8 + (rand() - 0.5) * spreadM,
            spot.position.y + spot.normal.y * r * 1.8 + (rand() - 0.5) * spreadM,
            spot.position.z + spot.normal.z * r * 1.8 + (rand() - 0.5) * spreadM,
          );
          openPoses.push({ position, quaternion: identity, scale: new THREE.Vector3(r, r, r) });
          budPoses.push({
            position,
            quaternion: identity,
            scale: new THREE.Vector3(r, r, r).multiplyScalar(BERRY_BUD_FRAC),
          });
          shedAt[instance] = rand();
          instance++;
        }
      }
      stemGroup.add(berries);
      bloomElements.push(addAnimatedInstances(berries, openPoses, budPoses, shedAt));

      const leafSpots = spots.filter((_, i) => i % 3 === 1);
      const leaves = new THREE.InstancedMesh(leafGeometry, leafMaterial, leafSpots.length);
      leaves.castShadow = true;
      color.setHex(berry.leafHex);
      const leafOpenPoses: InstancePose[] = [];
      const leafBudPoses: InstancePose[] = [];
      const leafShedAt = new Float32Array(leafSpots.length);
      leafSpots.forEach((spot, i) => {
        dir.copy(spot.normal).addScaledVector(UP, -0.2).normalize();
        side.crossVectors(UP, dir).normalize();
        pnormal.crossVectors(side, dir);
        const size = 0.02 + rand() * 0.008;
        matrix.makeBasis(side, dir, pnormal);
        const quaternion = new THREE.Quaternion().setFromRotationMatrix(matrix);
        const scale = new THREE.Vector3(size * 0.5, size, size);
        leafOpenPoses.push({ position: spot.position.clone(), quaternion, scale });
        leafBudPoses.push({
          position: spot.position.clone(),
          quaternion,
          scale: scale.clone().multiplyScalar(LEAF_BUD_FRAC),
        });
        leafShedAt[i] = rand();
        leaves.setColorAt(i, color);
      });
      if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
      stemGroup.add(leaves);
      bloomElements.push(addAnimatedInstances(leaves, leafOpenPoses, leafBudPoses, leafShedAt));
    }

    group.add(stemGroup);
    stemGroups.push(stemGroup);
  }

  const debrisCount = Math.min(MAX_DEBRIS_INSTANCES, Math.max(1, opts.branchCount) * 20);
  const debrisRadiusM = { min: opts.vaseBaseRadiusM * 1.15, max: opts.vaseBaseRadiusM * 2.4 };
  if (blossom) {
    bloomElements.push(
      addFloorDebris(group, {
        geometry: petalGeometry,
        material: petalMaterial,
        count: debrisCount,
        sizeM: blossomSize.min + blossomSize.jitter / 2,
        radiusM: debrisRadiusM,
        rand,
        tint: new THREE.Color(blossom.petalHex),
      }),
    );
  } else if (raceme) {
    bloomElements.push(
      addFloorDebris(group, {
        geometry: peaGeometry,
        material: petalMaterial,
        count: MAX_DEBRIS_INSTANCES,
        sizeM: RACEME_FLOWER_M * 0.9,
        radiusM: debrisRadiusM,
        rand,
        tint: new THREE.Color(raceme.flowerHex),
      }),
    );
  } else if (gardenia) {
    // Spent petals drop already yellowed.
    bloomElements.push(
      addFloorDebris(group, {
        geometry: gardeniaPetalGeometry,
        material: gardeniaPetalMaterial,
        count: debrisCount,
        sizeM: GARDENIA_PETAL_M.min,
        radiusM: debrisRadiusM,
        rand,
        tint: new THREE.Color(gardenia.petalHex).lerp(new THREE.Color(GARDENIA_AGED_HEX), GARDENIA_AGE_WEIGHT),
      }),
    );
  } else if (camellia) {
    bloomElements.push(
      addFloorDebris(group, {
        geometry: camelliaPetalGeometry,
        material: petalMaterial,
        count: debrisCount,
        sizeM: 0.02,
        radiusM: debrisRadiusM,
        rand,
        tint: new THREE.Color(camellia.petalHex),
      }),
    );
    bloomElements.push(
      addFloorDebris(group, {
        geometry: camelliaLeafGeometry,
        material: camelliaLeafMaterial,
        count: Math.min(MAX_DEBRIS_INSTANCES, Math.max(1, opts.branchCount) * 4),
        sizeM: 0.03,
        radiusM: debrisRadiusM,
        rand,
      }),
    );
  } else if (osmanthus) {
    // The fallen flowers famously carpet the ground orange.
    bloomElements.push(
      addFloorDebris(group, {
        geometry: osmanthusFlowerGeometryShared,
        material: petalMaterial,
        count: MAX_DEBRIS_INSTANCES,
        sizeM: OSMANTHUS_FLOWER_M * 1.1,
        radiusM: debrisRadiusM,
        rand,
        tint: new THREE.Color(osmanthus.flowerHex),
      }),
    );
  } else if (opts.adorn.type === "leaf") {
    bloomElements.push(
      addFloorDebris(group, {
        geometry: leafGeometry,
        material: leafMaterial,
        count: debrisCount,
        sizeM: 0.02,
        radiusM: debrisRadiusM,
        rand,
        tint: new THREE.Color(opts.adorn.leafHexes[0] ?? 0xc7472e),
      }),
    );
  } else if (berry) {
    // Berry material is already the correct color (unlike the neutral
    // petal/leaf gradients), so no extra tint is needed here.
    bloomElements.push(
      addFloorDebris(group, {
        geometry: sphereGeometry,
        material: berryMaterial as THREE.Material,
        count: debrisCount,
        sizeM: 0.0034 * 1.75,
        radiusM: debrisRadiusM,
        rand,
      }),
    );
    bloomElements.push(
      addFloorDebris(group, {
        geometry: leafGeometry,
        material: leafMaterial,
        count: Math.min(MAX_DEBRIS_INSTANCES, Math.max(1, opts.branchCount) * 6),
        sizeM: 0.014,
        radiusM: debrisRadiusM,
        rand,
        tint: new THREE.Color(berry.leafHex),
      }),
    );
  }

  attachBreeze(group, stemGroups);
  attachBloomCycle(group, bloomElements);
  return group;
}
