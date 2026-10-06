import * as THREE from "three";
import { mulberry32 } from "../../../engine/geometry/prng";
import { petalGrid } from "../../../engine/geometry/petalGrid";
import {
  type BloomElement,
  type InstancePose,
  MAX_DEBRIS_INSTANCES,
  addAnimatedInstances,
  addFloorDebris,
  attachBloomCycle,
} from "../bloomRig";
import { attachBreeze, gridToGeometry } from "../flowers";

const UP = new THREE.Vector3(0, 1, 0);
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
  | { type: "blossom"; petalHex: number; centerHex: number }
  | { type: "leaf"; leafHexes: readonly number[] }
  | {
      type: "berry";
      berryHex: number;
      leafHex: number;
      /** Tiny flower clusters (osmanthus) instead of nanten-sized berries. */
      berryRadiusM?: number;
      berriesPerCluster?: number;
      /** Fraction of spots that carry leaves rather than clusters (default 1/3). */
      leafy?: boolean;
    }
  /**
   * Camellia family: a few large single blooms with a stamen column among
   * glossy evergreen leaves. `cup` is tsubaki (petals rise around the
   * stamens, and the whole flower drops at once — petals and stamens are
   * fused at the base); `flat` is sazanka (opens wide, sheds petal by petal).
   */
  | { type: "camellia"; petalHex: number; stamenHex: number; leafHex: number; form: "cup" | "flat" };

const CAMELLIA_FORMS = {
  cup: { petalCount: 6, splay: 0.62, axis: 0.78, stamenHeight: 1, stamenWidth: 1, shedWhole: true },
  flat: { petalCount: 7, splay: 0.86, axis: 0.5, stamenHeight: 0.7, stamenWidth: 1.4, shedWhole: false },
} as const;
const CAMELLIA_BUD_LENGTH_FRAC = 0.45;
const CAMELLIA_STAMEN_BUD_FRAC = 0.3;

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

/**
 * Cut branches (ume plum, sakura cherry, momiji maple, nanten, camellia): a leaning main branch with two side
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
  const berry = opts.adorn.type === "berry" ? opts.adorn : null;
  // Tiny flower clusters (osmanthus) are many and small: a coarser sphere
  // keeps the triangle count in line with the other kinds.
  const berryGeometry =
    berry && (berry.berryRadiusM ?? 0.0034) < 0.0025 ? new THREE.SphereGeometry(1, 5, 4) : sphereGeometry;
  const camelliaPetalGeometry = camellia
    ? gridToGeometry(
        petalGrid({ lengthM: 1, widthM: 0.95, segmentsU: 6, segmentsV: 5, cupM: 0.22, bendM: -0.08 }),
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

    const riseM = 0.26 + rand() * 0.12;
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

    // Two side shoots off the upper half of the main branch.
    const curves: THREE.CatmullRomCurve3[] = [main];
    for (const shootT of [0.58, 0.8]) {
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
        .addScaledVector(tangent, 1.2)
        .addScaledVector(UP, 0.4)
        .normalize();
      const len = 0.09 + rand() * 0.06;
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
    const spots: AdornSpot[] = [
      ...spotsAlong(main, 11, 0.55, rand),
      ...spotsAlong(curves[1], 6, 0.15, rand),
      ...spotsAlong(curves[2], 6, 0.15, rand),
    ];

    if (opts.adorn.type === "blossom") {
      const blossoms = new THREE.InstancedMesh(petalGeometry, petalMaterial, spots.length * 5);
      blossoms.castShadow = true;
      const centers = new THREE.InstancedMesh(sphereGeometry, centerMaterial as THREE.Material, spots.length);
      color.setHex(opts.adorn.petalHex);
      let instance = 0;
      const openPoses: InstancePose[] = [];
      const budPoses: InstancePose[] = [];
      const shedAt = new Float32Array(spots.length * 5);
      spots.forEach((spot, si) => {
        const u = new THREE.Vector3()
          .crossVectors(Math.abs(spot.normal.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : UP, spot.normal)
          .normalize();
        const v = new THREE.Vector3().crossVectors(spot.normal, u);
        const spin = rand() * Math.PI;
        const size = 0.009 + rand() * 0.004;
        for (let k = 0; k < 5; k++) {
          const a = spin + (k / 5) * Math.PI * 2;
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
        const cs = size * 0.22;
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
    } else if (camellia) {
      const form = CAMELLIA_FORMS[camellia.form];
      // Four blooms per branch (two on the main, one per shoot), leaves on
      // most of the remaining spots.
      const flowerSpots = spots.filter((_, i) => i % 6 === 3);
      const leafSpots = spots.filter((_, i) => i % 6 !== 3 && i % 2 === 0);

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
        const size = 0.026 + rand() * 0.006;
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
      const leafy = berry.leafy ?? false;
      const clusterSpots = spots.filter((_, i) => (leafy ? i % 2 === 0 : i % 3 === 0));
      const berriesPerCluster = berry.berriesPerCluster ?? 9;
      const berryRadiusM = berry.berryRadiusM ?? 0.0034;
      const spreadM = berryRadiusM * 4;
      const berries = new THREE.InstancedMesh(
        berryGeometry,
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

      const leafSpots = spots.filter((_, i) => (leafy ? i % 2 === 1 : i % 3 === 1));
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
        const size = (leafy ? 0.03 : 0.02) + rand() * 0.008;
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
  if (opts.adorn.type === "blossom") {
    bloomElements.push(
      addFloorDebris(group, {
        geometry: petalGeometry,
        material: petalMaterial,
        count: debrisCount,
        sizeM: 0.011,
        radiusM: debrisRadiusM,
        rand,
        tint: new THREE.Color(opts.adorn.petalHex),
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
        geometry: berryGeometry,
        material: berryMaterial as THREE.Material,
        count: debrisCount,
        sizeM: (berry.berryRadiusM ?? 0.0034) * 1.75,
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
