import * as THREE from "three";
import { lobedLeaf } from "../../../engine/geometry/floraMeshes";
import { layoutBouquet } from "../../../engine/geometry/flowerLayout";
import { petalGrid } from "../../../engine/geometry/petalGrid";
import { mulberry32 } from "../../../engine/geometry/prng";
import { sprayLayout } from "../../../engine/geometry/spray";
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
import { meshDataToGeometry, mergeIndexed } from "./meshData";

const UP = new THREE.Vector3(0, 1, 0);

const STEM_RADIUS_M = 0.0028;
const PEDICEL_RADIUS_M = 0.0014;
const STEM_HEX = 0x4f7a34;
// Spray: six side shoots around the terminal flower, the top two still in bud.
const SPRAY = {
  shoots: 6,
  spanM: 0.05,
  reachM: 0.036,
  sagM: 0.014,
  headRadiusM: { min: 0.014, max: 0.018 },
  budFraction: 0.3,
};
// Two offset rows of short, blunt rays around a small domed disc.
const RAY_ROWS = [
  { count: 18, tiltDeg: 10, length: 1, shade: 1 },
  { count: 14, tiltDeg: 32, length: 0.78, shade: 0.93 },
] as const;
const RAY_LENGTH_FRAC = 0.74;
const DISC_FRAC = 0.32;
const BUD_FRAC = 0.36;
const LEAVES_PER_STEM = 6;
const LEAF_GREEN = new THREE.Color(0x2f4f1f);
const LEAF_LIGHT = new THREE.Color(0x56803c);
const BUD_GREEN = new THREE.Color(0x5a8a30);

export interface KogikuOptions {
  /** Ray colors — one per stem (a spray is a single color), picked by the layout's color seed. */
  paletteHex: readonly number[];
  stemCount: number;
  seed: number;
  vaseRimYM: number;
  vaseNeckRadiusM: number;
  vaseBaseRadiusM: number;
}

/** A point at arc length `s` along the curve, clamped to its ends. */
function pointAtArc(curve: THREE.CatmullRomCurve3, s: number): THREE.Vector3 {
  return curve.getPointAt(THREE.MathUtils.clamp(s / curve.getLength(), 0, 1));
}

/**
 * Spray chrysanthemums (kogiku): each stiff, leafy stem branches at the top
 * into a domed spray of small single flowers — two rows of short, blunt rays
 * around a little yellow disc — with the youngest shoots still in round
 * green bud. Leaves are pinnately lobed, alternate up the stem.
 */
export function createKogikuGroup(opts: KogikuOptions): THREE.Group {
  const stems = layoutBouquet({ ...opts, droopScale: 0.5, freeLengthScale: 0.9 });
  const group = new THREE.Group();
  const stemGroups: THREE.Group[] = [];
  const rand = mulberry32(opts.seed + 211);
  const bloomElements: BloomElement[] = [];

  const stemMaterial = new THREE.MeshStandardMaterial({ color: STEM_HEX, roughness: 0.75 });
  const rayGeometry = gridToGeometry(
    petalGrid({ lengthM: 1, widthM: 0.5, segmentsU: 3, segmentsV: 2, cupM: 0.08, bendM: 0, widthExponent: 0.35 }),
    0xcfc6b4,
    0xffffff,
  );
  const rayMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.6,
    side: THREE.DoubleSide,
  });
  // Domed disc: deeper and greener at the crown, golden at the rim.
  const discGeometry = new THREE.SphereGeometry(1, 9, 3, 0, Math.PI * 2, 0, Math.PI / 2);
  const crown = new THREE.Color(0xa99a2a);
  const rim = new THREE.Color(0xe6bf3c);
  const discPositions = discGeometry.getAttribute("position");
  const discColors = new Float32Array(discPositions.count * 3);
  for (let i = 0; i < discPositions.count; i++) {
    const c = rim.clone().lerp(crown, discPositions.getY(i));
    discColors.set([c.r, c.g, c.b], i * 3);
  }
  discGeometry.setAttribute("color", new THREE.BufferAttribute(discColors, 3));
  const discMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
  const budGeometry = new THREE.SphereGeometry(1, 6, 4);
  const budMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 });
  // Shades run 0.65 (petiole) … 1 (midrib): dark blade, paler veins.
  const leafGeometry = meshDataToGeometry(lobedLeaf(), (shade) =>
    LEAF_GREEN.clone().lerp(LEAF_LIGHT, (shade - 0.65) / 0.35),
  );
  const leafMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.72,
    side: THREE.DoubleSide,
  });

  const usedTints: THREE.Color[] = [];

  stems.forEach((stem, stemIndex) => {
    const stemGroup = new THREE.Group();
    const curve = new THREE.CatmullRomCurve3(
      stem.controlPoints.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    );
    const stemLength = curve.getLength();
    const tint = new THREE.Color(
      opts.paletteHex[Math.floor(stem.colorSeed * opts.paletteHex.length)] ?? 0xf2d24a,
    );
    usedTints.push(tint);

    // The spray in the frame of the stem's tip, turned onto the real stem.
    const tipTangent = curve.getTangentAt(1);
    const frame = new THREE.Quaternion().setFromUnitVectors(UP, tipTangent);
    const heads = sprayLayout({ ...SPRAY, seed: opts.seed * 17 + stemIndex });
    const tubes: THREE.BufferGeometry[] = [new THREE.TubeGeometry(curve, 20, STEM_RADIUS_M, 6, false)];

    const rayOpen: InstancePose[] = [];
    const rayBud: InstancePose[] = [];
    const rayShed: number[] = [];
    const rayColors: THREE.Color[] = [];
    const discOpen: InstancePose[] = [];
    const discBud: InstancePose[] = [];
    const budOpen: InstancePose[] = [];
    const budBud: InstancePose[] = [];
    const budColor = BUD_GREEN.clone().lerp(tint, 0.15);
    const [, , , , stemTip] = stem.controlPoints;
    const outward = new THREE.Vector3(stemTip[0], 0, stemTip[2]).normalize();

    for (const head of heads) {
      const attach = pointAtArc(curve, stemLength - head.dropM);
      const toStem = ([x, y, z]: readonly number[]): THREE.Vector3 =>
        new THREE.Vector3(x, y + head.dropM, z).applyQuaternion(frame).add(attach);
      const path = head.pedicel.map(toStem);
      if (head.dropM > 0) {
        tubes.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(path), 6, PEDICEL_RADIUS_M, 4, false));
      }
      const center = path[path.length - 1];
      // Heads turn outward with the stem's lean and up toward the light.
      const facing = new THREE.Vector3(...head.facing)
        .applyQuaternion(frame)
        .addScaledVector(outward, 0.55)
        .addScaledVector(UP, 0.15)
        .normalize();
      const quaternion = new THREE.Quaternion().setFromUnitVectors(UP, facing);
      const R = head.headRadiusM;

      if (head.bud) {
        const r = R * BUD_FRAC;
        const pose = {
          position: center.clone().addScaledVector(facing, r * 0.6),
          quaternion,
          scale: new THREE.Vector3(r, r * 0.85, r),
        };
        budOpen.push(pose);
        budBud.push({ ...pose, scale: pose.scale.clone().multiplyScalar(0.6) });
        continue;
      }

      const discR = R * DISC_FRAC;
      const discPose = {
        position: center.clone(),
        quaternion,
        scale: new THREE.Vector3(discR, discR * 0.55, discR),
      };
      discOpen.push(discPose);
      discBud.push({ ...discPose, scale: discPose.scale.clone().multiplyScalar(0.7) });

      const spin = rand() * Math.PI;
      RAY_ROWS.forEach((row, r) => {
        const length = R * RAY_LENGTH_FRAC * row.length;
        const offset = spin + (r * Math.PI) / row.count;
        for (let k = 0; k < row.count; k++) {
          const ringY = r * discR * 0.12;
          rayOpen.push(
            composePose(center, quaternion, ringPose(k, row.count, discR * 0.9, ringY, row.tiltDeg, length, offset)),
          );
          // Folded up over the disc, short, like a bud about to open.
          rayBud.push(
            composePose(center, quaternion, ringPose(k, row.count, discR * 0.35, ringY, 84, length * 0.42, offset)),
          );
          rayShed.push(rand());
          rayColors.push(tint.clone().multiplyScalar(row.shade).offsetHSL(0, 0, (rand() - 0.5) * 0.05));
        }
      });
    }

    // Alternate lobed leaves up the free stretch of the stem, below the spray.
    const [, rimPoint] = stem.controlPoints;
    const rimArc = Math.hypot(
      rimPoint[0] - stem.controlPoints[0][0],
      rimPoint[1] - stem.controlPoints[0][1],
      rimPoint[2] - stem.controlPoints[0][2],
    );
    const leafOpen: InstancePose[] = [];
    const leafBud: InstancePose[] = [];
    const leafShed: number[] = [];
    const phase = rand() * Math.PI * 2;
    const sprayBase = stemLength - SPRAY.spanM;
    for (let k = 0; k < LEAVES_PER_STEM; k++) {
      const s = rimArc + 0.004 + (Math.max(0.02, sprayBase - rimArc) * (k + 0.3 * rand())) / LEAVES_PER_STEM;
      const at = pointAtArc(curve, s);
      const az = phase + k * 2.4;
      const dir = new THREE.Vector3(Math.cos(az) * 0.85, -0.15 + rand() * 0.2, Math.sin(az) * 0.85).normalize();
      const size = 0.045 + rand() * 0.015;
      const pose = orientedPose(at, dir, UP, size);
      leafOpen.push(pose);
      leafBud.push({ ...pose, scale: pose.scale.clone().multiplyScalar(0.4) });
      leafShed.push(0.45 + rand() * 0.55);
    }

    const stemMesh = new THREE.Mesh(mergeIndexed(tubes), stemMaterial);
    stemMesh.castShadow = true;
    for (const tube of tubes) tube.dispose();
    stemGroup.add(stemMesh);

    const leaves = new THREE.InstancedMesh(leafGeometry, leafMaterial, leafOpen.length);
    leaves.name = "kogiku-leaves";
    leaves.castShadow = true;
    stemGroup.add(leaves);
    bloomElements.push(addAnimatedInstances(leaves, leafOpen, leafBud, leafShed));

    const rays = new THREE.InstancedMesh(rayGeometry, rayMaterial, rayOpen.length);
    rays.name = "kogiku-rays";
    rays.castShadow = true;
    rayColors.forEach((c, i) => rays.setColorAt(i, c));
    if (rays.instanceColor) rays.instanceColor.needsUpdate = true;
    stemGroup.add(rays);
    bloomElements.push(addAnimatedInstances(rays, rayOpen, rayBud, rayShed));

    // The disc and the buds stay on the stem as the rays drop.
    const discs = new THREE.InstancedMesh(discGeometry, discMaterial, discOpen.length);
    discs.name = "kogiku-discs";
    discs.castShadow = true;
    stemGroup.add(discs);
    bloomElements.push(addAnimatedInstances(discs, discOpen, discBud, new Float32Array(discOpen.length).fill(2)));

    const buds = new THREE.InstancedMesh(budGeometry, budMaterial, budOpen.length);
    buds.name = "kogiku-buds";
    buds.castShadow = true;
    for (let i = 0; i < budOpen.length; i++) buds.setColorAt(i, budColor);
    if (buds.instanceColor) buds.instanceColor.needsUpdate = true;
    stemGroup.add(buds);
    bloomElements.push(addAnimatedInstances(buds, budOpen, budBud, new Float32Array(budOpen.length).fill(2)));

    group.add(stemGroup);
    stemGroups.push(stemGroup);
  });

  const debrisRadiusM = { min: opts.vaseBaseRadiusM * 1.15, max: opts.vaseBaseRadiusM * 2.4 };
  bloomElements.push(
    addFloorDebris(group, {
      geometry: rayGeometry,
      material: rayMaterial,
      count: Math.min(MAX_DEBRIS_INSTANCES, stems.length * 12),
      sizeM: SPRAY.headRadiusM.max * RAY_LENGTH_FRAC,
      radiusM: debrisRadiusM,
      rand,
      tints: usedTints,
    }),
  );
  bloomElements.push(
    addFloorDebris(group, {
      geometry: leafGeometry,
      material: leafMaterial,
      count: Math.min(MAX_DEBRIS_INSTANCES, stems.length * 3),
      sizeM: 0.04,
      radiusM: debrisRadiusM,
      rand,
    }),
  );

  attachBreeze(group, stemGroups);
  attachBloomCycle(group, bloomElements);
  return group;
}
