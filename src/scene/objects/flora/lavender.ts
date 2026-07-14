import * as THREE from "three";
import { layoutBouquet } from "../../../engine/geometry/flowerLayout";
import { mulberry32 } from "../../../engine/geometry/prng";
import { petalGrid } from "../../../engine/geometry/petalGrid";
import { attachBreeze, gridToGeometry } from "../flowers";

const UP = new THREE.Vector3(0, 1, 0);
const BUDS_PER_SPIKE = 22;

export interface LavenderOptions {
  paletteHex: readonly number[];
  stemCount: number;
  seed: number;
  vaseRimYM: number;
  vaseNeckRadiusM: number;
}

/** Slender stems ending in spikes of tiny purple buds. */
export function createLavenderGroup(opts: LavenderOptions): THREE.Group {
  const stems = layoutBouquet(opts);
  const group = new THREE.Group();
  const stemGroups: THREE.Group[] = [];
  const rand = mulberry32(opts.seed + 51);

  const stemMaterial = new THREE.MeshStandardMaterial({ color: 0x5f7a52, roughness: 0.75 });
  const budGeometry = new THREE.SphereGeometry(1, 6, 5);
  const budMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.65 });
  const leafGeometry = gridToGeometry(
    petalGrid({ lengthM: 1, widthM: 0.1, segmentsU: 6, segmentsV: 3, cupM: 0, bendM: 0.15 }),
    0x5b7355,
    0x779370,
  );
  const leafMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.7,
    side: THREE.DoubleSide,
  });

  const matrix = new THREE.Matrix4();
  const color = new THREE.Color();

  for (const stem of stems) {
    const stemGroup = new THREE.Group();
    const curve = new THREE.CatmullRomCurve3(
      stem.controlPoints.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    );
    const stemMesh = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 20, 0.0016, 5, false),
      stemMaterial,
    );
    stemMesh.castShadow = true;
    stemGroup.add(stemMesh);

    for (const leaf of stem.leaves) {
      const mesh = new THREE.Mesh(leafGeometry, leafMaterial);
      mesh.castShadow = true;
      mesh.position.copy(curve.getPointAt(leaf.t));
      mesh.scale.setScalar(leaf.lengthM * 0.55);
      const az = (leaf.azimuthDeg * Math.PI) / 180;
      const dir = new THREE.Vector3(Math.cos(az) * 0.6, 0.5, Math.sin(az) * 0.6).normalize();
      const side = new THREE.Vector3().crossVectors(UP, dir).normalize();
      const normal = new THREE.Vector3().crossVectors(side, dir);
      mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(side, dir, normal));
      stemGroup.add(mesh);
    }

    // The spike rides the last stretch of the stem and a little beyond it.
    const tint = new THREE.Color(
      opts.paletteHex[Math.floor(stem.colorSeed * opts.paletteHex.length)] ?? 0x8a76c9,
    );
    const buds = new THREE.InstancedMesh(budGeometry, budMaterial, BUDS_PER_SPIKE);
    buds.castShadow = true;
    const tip = curve.getPointAt(1);
    const tangent = curve.getTangentAt(0.98).normalize();
    for (let k = 0; k < BUDS_PER_SPIKE; k++) {
      const along = (k / BUDS_PER_SPIKE) * 0.05 - 0.012;
      const jitterR = 0.0022 + rand() * 0.0012;
      const a = rand() * Math.PI * 2;
      const s = 0.0022 + rand() * 0.0008;
      matrix.makeScale(s, s * 1.5, s);
      matrix.setPosition(
        tip.x + tangent.x * along + Math.cos(a) * jitterR,
        tip.y + tangent.y * along + (rand() - 0.5) * 0.002,
        tip.z + tangent.z * along + Math.sin(a) * jitterR,
      );
      buds.setMatrixAt(k, matrix);
      color.copy(tint).offsetHSL(0, 0, (rand() - 0.5) * 0.08);
      buds.setColorAt(k, color);
    }
    buds.instanceMatrix.needsUpdate = true;
    if (buds.instanceColor) buds.instanceColor.needsUpdate = true;
    stemGroup.add(buds);

    group.add(stemGroup);
    stemGroups.push(stemGroup);
  }

  attachBreeze(group, stemGroups);
  return group;
}
