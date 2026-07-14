import * as THREE from "three";
import { layoutBouquet } from "../../../engine/geometry/flowerLayout";
import { petalGrid } from "../../../engine/geometry/petalGrid";
import { phyllotaxis } from "../../../engine/geometry/phyllotaxis";
import { addRadialRing, attachBreeze, gridToGeometry } from "../flowers";

const UP = new THREE.Vector3(0, 1, 0);

export interface PeonyOptions {
  paletteHex: readonly number[];
  stemCount: number;
  seed: number;
  vaseRimYM: number;
  vaseNeckRadiusM: number;
}

/** Lush many-layered blooms — four nested petal rings around golden stamens. */
export function createPeonyGroup(opts: PeonyOptions): THREE.Group {
  const stems = layoutBouquet(opts);
  const group = new THREE.Group();
  const stemGroups: THREE.Group[] = [];

  const stemMaterial = new THREE.MeshStandardMaterial({ color: 0x4f6e35, roughness: 0.75 });
  // Broad cupped petal, near-white gradient tinted per stem.
  const petalGeometry = gridToGeometry(
    petalGrid({ lengthM: 1, widthM: 0.62, segmentsU: 7, segmentsV: 6, cupM: 0.18, bendM: -0.05 }),
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
      new THREE.TubeGeometry(curve, 20, 0.0045, 8, false),
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
    // Peonies are heavy — bias the face a little upward from the layout's nod.
    const [dx, dy, dz] = stem.headDirection;
    head.quaternion.setFromUnitVectors(
      UP,
      new THREE.Vector3(dx, Math.max(dy, 0) + 0.7, dz).normalize(),
    );

    const R = stem.headRadiusM * 0.55;
    const tint = new THREE.Color(
      opts.paletteHex[Math.floor(stem.colorSeed * opts.paletteHex.length)] ?? 0xe98cb1,
    );

    // Golden stamens peeking through the innermost cup.
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

    // Nested rings, flattest outside → most upright inside.
    const rings = [
      { count: 9, radius: 0.5, y: 0, tilt: 16, len: 1.0, shade: 1.0 },
      { count: 9, radius: 0.42, y: 0.015, tilt: 36, len: 0.9, shade: 0.96 },
      { count: 7, radius: 0.3, y: 0.03, tilt: 56, len: 0.78, shade: 0.92 },
      { count: 5, radius: 0.18, y: 0.04, tilt: 74, len: 0.6, shade: 0.88 },
    ];
    rings.forEach((ring, i) => {
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
