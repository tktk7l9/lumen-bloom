import * as THREE from "three";
import { mulberry32 } from "../../../engine/geometry/prng";
import { petalGrid } from "../../../engine/geometry/petalGrid";
import { attachBreeze, gridToGeometry } from "../flowers";

const UP = new THREE.Vector3(0, 1, 0);

export type BranchAdornment =
  | { type: "blossom"; petalHex: number; centerHex: number }
  | { type: "leaf"; leafHexes: readonly number[] }
  | { type: "berry"; berryHex: number; leafHex: number };

export interface BranchOptions {
  branchCount: number;
  seed: number;
  branchHex: number;
  adorn: BranchAdornment;
  vaseRimYM: number;
  vaseNeckRadiusM: number;
}

interface AdornSpot {
  position: THREE.Vector3;
  /** Outward-ish direction away from the branch. */
  normal: THREE.Vector3;
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
    spots.push({ position, normal });
  }
  return spots;
}

/**
 * Cut branches (梅・桜・紅葉・南天): a leaning main branch with two side
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

  const matrix = new THREE.Matrix4();
  const dir = new THREE.Vector3();
  const side = new THREE.Vector3();
  const pnormal = new THREE.Vector3();
  const color = new THREE.Color();

  for (let b = 0; b < Math.max(1, opts.branchCount); b++) {
    const stemGroup = new THREE.Group();
    const az = ((b / opts.branchCount) * 360 + (rand() - 0.5) * 40) * (Math.PI / 180);
    const emergeR = opts.vaseNeckRadiusM * (0.25 + rand() * 0.35);
    const cos = Math.cos(az);
    const sin = Math.sin(az);

    const riseM = 0.26 + rand() * 0.12;
    const leanM = Math.sin(((10 + rand() * 14) * Math.PI) / 180) * riseM;
    const wiggle = (rand() - 0.5) * 0.05;
    const baseY = opts.vaseRimYM - 0.03;

    const main = new THREE.CatmullRomCurve3([
      new THREE.Vector3(cos * emergeR * 0.4, 0.04, sin * emergeR * 0.4),
      new THREE.Vector3(cos * emergeR, baseY, sin * emergeR),
      new THREE.Vector3(
        cos * (emergeR + leanM * 0.25) - sin * wiggle,
        baseY + riseM * 0.4,
        sin * (emergeR + leanM * 0.25) + cos * wiggle,
      ),
      new THREE.Vector3(
        cos * (emergeR + leanM * 0.65) + sin * wiggle,
        baseY + riseM * 0.75,
        sin * (emergeR + leanM * 0.65) - cos * wiggle,
      ),
      new THREE.Vector3(cos * (emergeR + leanM), baseY + riseM, sin * (emergeR + leanM)),
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
      const centers = new THREE.InstancedMesh(
        sphereGeometry,
        new THREE.MeshStandardMaterial({ color: opts.adorn.centerHex, roughness: 0.8 }),
        spots.length,
      );
      color.setHex(opts.adorn.petalHex);
      let instance = 0;
      spots.forEach((spot, si) => {
        const u = new THREE.Vector3()
          .crossVectors(Math.abs(spot.normal.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : UP, spot.normal)
          .normalize();
        const v = new THREE.Vector3().crossVectors(spot.normal, u);
        const spin = rand() * Math.PI;
        const size = 0.009 + rand() * 0.004;
        for (let k = 0; k < 5; k++) {
          const a = spin + (k / 5) * Math.PI * 2;
          dir
            .copy(u)
            .multiplyScalar(Math.cos(a))
            .addScaledVector(v, Math.sin(a))
            .multiplyScalar(0.85)
            .addScaledVector(spot.normal, 0.55)
            .normalize();
          side.crossVectors(spot.normal, dir).normalize();
          pnormal.crossVectors(side, dir);
          matrix.makeBasis(side, dir, pnormal);
          matrix.scale(new THREE.Vector3(size, size, size));
          matrix.setPosition(spot.position.x, spot.position.y, spot.position.z);
          blossoms.setMatrixAt(instance, matrix);
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
      blossoms.instanceMatrix.needsUpdate = true;
      if (blossoms.instanceColor) blossoms.instanceColor.needsUpdate = true;
      centers.instanceMatrix.needsUpdate = true;
      stemGroup.add(blossoms, centers);
    } else if (opts.adorn.type === "leaf") {
      const leaves = new THREE.InstancedMesh(leafGeometry, leafMaterial, spots.length);
      leaves.castShadow = true;
      const hexes = opts.adorn.leafHexes;
      spots.forEach((spot, i) => {
        dir.copy(spot.normal).addScaledVector(UP, -0.3).normalize();
        side.crossVectors(UP, dir).normalize();
        pnormal.crossVectors(side, dir);
        const size = 0.022 + rand() * 0.012;
        matrix.makeBasis(side, dir, pnormal);
        matrix.scale(new THREE.Vector3(size, size, size));
        matrix.setPosition(spot.position.x, spot.position.y, spot.position.z);
        leaves.setMatrixAt(i, matrix);
        color.setHex(hexes[Math.floor(rand() * hexes.length)] ?? 0xc7472e);
        leaves.setColorAt(i, color);
      });
      leaves.instanceMatrix.needsUpdate = true;
      if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
      stemGroup.add(leaves);
    } else {
      // Berries: clusters at a few spots plus a handful of green leaves.
      const clusterSpots = spots.filter((_, i) => i % 3 === 0);
      const berriesPerCluster = 9;
      const berries = new THREE.InstancedMesh(
        sphereGeometry,
        new THREE.MeshStandardMaterial({ color: opts.adorn.berryHex, roughness: 0.35 }),
        clusterSpots.length * berriesPerCluster,
      );
      berries.castShadow = true;
      let instance = 0;
      for (const spot of clusterSpots) {
        for (let k = 0; k < berriesPerCluster; k++) {
          const r = 0.0034 + rand() * 0.001;
          matrix.makeScale(r, r, r);
          matrix.setPosition(
            spot.position.x + spot.normal.x * 0.006 + (rand() - 0.5) * 0.014,
            spot.position.y + spot.normal.y * 0.006 + (rand() - 0.5) * 0.014,
            spot.position.z + spot.normal.z * 0.006 + (rand() - 0.5) * 0.014,
          );
          berries.setMatrixAt(instance, matrix);
          instance++;
        }
      }
      berries.instanceMatrix.needsUpdate = true;
      stemGroup.add(berries);

      const leafSpots = spots.filter((_, i) => i % 3 === 1);
      const leaves = new THREE.InstancedMesh(leafGeometry, leafMaterial, leafSpots.length);
      leaves.castShadow = true;
      color.setHex(opts.adorn.leafHex);
      leafSpots.forEach((spot, i) => {
        dir.copy(spot.normal).addScaledVector(UP, -0.2).normalize();
        side.crossVectors(UP, dir).normalize();
        pnormal.crossVectors(side, dir);
        const size = 0.02 + rand() * 0.008;
        matrix.makeBasis(side, dir, pnormal);
        matrix.scale(new THREE.Vector3(size * 0.5, size, size));
        matrix.setPosition(spot.position.x, spot.position.y, spot.position.z);
        leaves.setMatrixAt(i, matrix);
        leaves.setColorAt(i, color);
      });
      leaves.instanceMatrix.needsUpdate = true;
      if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
      stemGroup.add(leaves);
    }

    group.add(stemGroup);
    stemGroups.push(stemGroup);
  }

  attachBreeze(group, stemGroups);
  return group;
}
