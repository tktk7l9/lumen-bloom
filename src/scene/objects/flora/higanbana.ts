import * as THREE from "three";
import { layoutBouquet } from "../../../engine/geometry/flowerLayout";
import { petalGrid } from "../../../engine/geometry/petalGrid";
import { mulberry32 } from "../../../engine/geometry/prng";
import {
  type BloomElement,
  type InstancePose,
  MAX_DEBRIS_INSTANCES,
  addAnimatedInstances,
  addFloorDebris,
  attachBloomCycle,
  orientedPose,
} from "../bloomRig";
import { attachBreeze, gridToGeometry } from "../flowers";

const UP = new THREE.Vector3(0, 1, 0);
const FLORETS_PER_UMBEL = 6;
const TEPALS_PER_FLORET = 6;
// Six stamens plus the style — all long, all arching up past the tepals.
const FILAMENTS_PER_FLORET = 7;
const TEPAL_BUD_FRAC = 0.45;
const FILAMENT_BUD_FRAC = 0.3;

export interface HiganbanaOptions {
  /** Tepal colors — one per stem, picked by the layout's color seed. */
  paletteHex: readonly number[];
  stemCount: number;
  seed: number;
  vaseRimYM: number;
  vaseNeckRadiusM: number;
  vaseBaseRadiusM: number;
}

/** A filament that leaves the throat straight, then sweeps upward (local +Z). */
function createFilamentGeometry(): THREE.TubeGeometry {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0.45, 0.03),
    new THREE.Vector3(0, 0.8, 0.14),
    new THREE.Vector3(0, 1, 0.3),
  ]);
  return new THREE.TubeGeometry(curve, 6, 0.012, 3, false);
}

/**
 * Red spider lily (higanbana): a bare green scape topped by an umbel of
 * six florets, each a ring of narrow, strongly recurved tepals with long
 * stamens curving up and out past them — the "fireworks" silhouette.
 */
export function createHiganbanaGroup(opts: HiganbanaOptions): THREE.Group {
  const stems = layoutBouquet({ ...opts, droopScale: 0.12, freeLengthScale: 1.2 });
  const group = new THREE.Group();
  const stemGroups: THREE.Group[] = [];
  const rand = mulberry32(opts.seed + 601);
  const bloomElements: BloomElement[] = [];

  const stemMaterial = new THREE.MeshStandardMaterial({ color: 0x7a9c52, roughness: 0.7 });
  const tepalGeometry = gridToGeometry(
    petalGrid({ lengthM: 1, widthM: 0.13, segmentsU: 8, segmentsV: 2, cupM: 0.015, bendM: 0.8 }),
    0xb4b4b4,
    0xffffff,
  );
  const tepalMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.5,
    side: THREE.DoubleSide,
  });
  const filamentGeometry = createFilamentGeometry();
  const filamentMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
  const hubGeometry = new THREE.SphereGeometry(1, 7, 5);
  const hubMaterial = new THREE.MeshStandardMaterial({ color: 0x6f8a3c, roughness: 0.8 });

  const color = new THREE.Color();
  const radial = new THREE.Vector3();
  const dir = new THREE.Vector3();

  for (const stem of stems) {
    const stemGroup = new THREE.Group();
    const curve = new THREE.CatmullRomCurve3(
      stem.controlPoints.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    );
    const stemMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.0032, 7, false), stemMaterial);
    stemMesh.castShadow = true;
    stemGroup.add(stemMesh);
    // No leaves: the species flowers on a leafless scape.

    const head = new THREE.Group();
    head.position.copy(curve.getPointAt(1));
    const tangent = curve.getTangentAt(1);
    head.quaternion.setFromUnitVectors(UP, tangent.clone().add(UP.clone().multiplyScalar(1.5)).normalize());

    const L = stem.headRadiusM * 0.48;
    const tint = new THREE.Color(
      opts.paletteHex[Math.floor(stem.colorSeed * opts.paletteHex.length)] ?? 0xd8261f,
    );
    const filamentTint = tint.clone().lerp(new THREE.Color(0xffffff), 0.15);

    const hub = new THREE.Mesh(hubGeometry, hubMaterial);
    hub.scale.setScalar(L * 0.1);
    head.add(hub);

    const tepals = new THREE.InstancedMesh(tepalGeometry, tepalMaterial, FLORETS_PER_UMBEL * TEPALS_PER_FLORET);
    tepals.castShadow = true;
    const filaments = new THREE.InstancedMesh(
      filamentGeometry,
      filamentMaterial,
      FLORETS_PER_UMBEL * FILAMENTS_PER_FLORET,
    );
    const tepalOpen: InstancePose[] = [];
    const tepalBud: InstancePose[] = [];
    const tepalShed = new Float32Array(tepals.count);
    const filamentOpen: InstancePose[] = [];
    const filamentBud: InstancePose[] = [];
    const filamentShed = new Float32Array(filaments.count);
    let ti = 0;
    let fi = 0;

    for (let j = 0; j < FLORETS_PER_UMBEL; j++) {
      // Florets radiate sideways from the scape tip, each tilted a little up.
      const az = (j / FLORETS_PER_UMBEL) * Math.PI * 2 + (rand() - 0.5) * 0.5;
      const axis = new THREE.Vector3(Math.cos(az), 0.2 + rand() * 0.15, Math.sin(az)).normalize();
      const origin = axis.clone().multiplyScalar(L * 0.22);
      const u = new THREE.Vector3().crossVectors(UP, axis).normalize();
      const v = new THREE.Vector3().crossVectors(axis, u);
      const floretLen = L * (0.9 + rand() * 0.2);
      const spin = rand() * Math.PI;

      for (let k = 0; k < TEPALS_PER_FLORET; k++) {
        const a = spin + (k / TEPALS_PER_FLORET) * Math.PI * 2;
        radial.copy(u).multiplyScalar(Math.cos(a)).addScaledVector(v, Math.sin(a));
        // Open: splayed ~60° off the axis, recurving back (positive bend,
        // face toward the axis). Bud: all tepals folded along the axis.
        dir.copy(axis).multiplyScalar(0.5).addScaledVector(radial, 0.88);
        tepalOpen.push(orientedPose(origin, dir, axis, floretLen));
        dir.copy(axis).addScaledVector(radial, 0.08);
        tepalBud.push(orientedPose(origin, dir, axis, floretLen * TEPAL_BUD_FRAC));
        tepalShed[ti] = rand();
        color.copy(tint).offsetHSL(0, 0, (rand() - 0.5) * 0.06);
        tepals.setColorAt(ti, color);
        ti++;
      }
      for (let k = 0; k < FILAMENTS_PER_FLORET; k++) {
        const a = spin + 0.4 + (k / FILAMENTS_PER_FLORET) * Math.PI * 2;
        radial.copy(u).multiplyScalar(Math.cos(a)).addScaledVector(v, Math.sin(a));
        dir.copy(axis).addScaledVector(radial, 0.16);
        const len = floretLen * (k === FILAMENTS_PER_FLORET - 1 ? 1.9 : 1.6 + rand() * 0.2);
        filamentOpen.push(orientedPose(origin, dir, UP, len));
        filamentBud.push(orientedPose(origin, axis, UP, len * FILAMENT_BUD_FRAC));
        filamentShed[fi] = rand();
        filaments.setColorAt(fi, filamentTint);
        fi++;
      }
    }
    if (tepals.instanceColor) tepals.instanceColor.needsUpdate = true;
    if (filaments.instanceColor) filaments.instanceColor.needsUpdate = true;
    head.add(tepals, filaments);
    bloomElements.push(addAnimatedInstances(tepals, tepalOpen, tepalBud, tepalShed));
    bloomElements.push(addAnimatedInstances(filaments, filamentOpen, filamentBud, filamentShed));

    stemGroup.add(head);
    group.add(stemGroup);
    stemGroups.push(stemGroup);
  }

  const avgHeadRadiusM = stems.reduce((sum, s) => sum + s.headRadiusM, 0) / stems.length;
  bloomElements.push(
    addFloorDebris(group, {
      geometry: tepalGeometry,
      material: tepalMaterial,
      count: Math.min(MAX_DEBRIS_INSTANCES, stems.length * 16),
      sizeM: avgHeadRadiusM * 0.48 * 0.8,
      radiusM: { min: opts.vaseBaseRadiusM * 1.15, max: opts.vaseBaseRadiusM * 2.4 },
      rand,
      tint: new THREE.Color(opts.paletteHex[0] ?? 0xd8261f),
    }),
  );

  attachBreeze(group, stemGroups);
  attachBloomCycle(group, bloomElements);
  return group;
}
