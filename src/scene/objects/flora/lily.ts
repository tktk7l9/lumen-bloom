import * as THREE from "three";
import { layoutBouquet } from "../../../engine/geometry/flowerLayout";
import { petalGrid } from "../../../engine/geometry/petalGrid";
import { addRadialRing, attachBreeze, gridToGeometry } from "../flowers";

const UP = new THREE.Vector3(0, 1, 0);

export interface LilyOptions {
  paletteHex: readonly number[];
  stemCount: number;
  seed: number;
  vaseRimYM: number;
  vaseNeckRadiusM: number;
}

/** Large recurved six-petal blooms with prominent stamens. */
export function createLilyGroup(opts: LilyOptions): THREE.Group {
  const stems = layoutBouquet(opts);
  const group = new THREE.Group();
  const stemGroups: THREE.Group[] = [];

  const stemMaterial = new THREE.MeshStandardMaterial({ color: 0x46672f, roughness: 0.75 });
  // Long petal with a strong backward curl — the lily's signature recurve.
  const petalGeometry = gridToGeometry(
    petalGrid({ lengthM: 1, widthM: 0.42, segmentsU: 9, segmentsV: 6, cupM: 0.1, bendM: 0.5 }),
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
  const filamentMaterial = new THREE.MeshStandardMaterial({ color: 0xe6e2d2, roughness: 0.6 });
  const antherGeometry = new THREE.SphereGeometry(1, 6, 5);
  const antherMaterial = new THREE.MeshStandardMaterial({ color: 0x8a5a24, roughness: 0.7 });

  const matrix = new THREE.Matrix4();
  const dir = new THREE.Vector3();
  const side = new THREE.Vector3();
  const normal = new THREE.Vector3();

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
      const d = new THREE.Vector3(Math.cos(az) * 0.85, -0.15, Math.sin(az) * 0.85).normalize();
      const s = new THREE.Vector3().crossVectors(UP, d).normalize();
      const n = new THREE.Vector3().crossVectors(s, d);
      mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(s, d, n));
      stemGroup.add(mesh);
    }

    // Lilies face outward, barely nodding.
    const head = new THREE.Group();
    head.position.set(...stem.headPosition);
    const [dx, dy, dz] = stem.headDirection;
    head.quaternion.setFromUnitVectors(
      UP,
      new THREE.Vector3(dx, dy * 0.4 + 0.35, dz).normalize(),
    );

    const R = stem.headRadiusM * 0.62;
    const tint = new THREE.Color(
      opts.paletteHex[Math.floor(stem.colorSeed * opts.paletteHex.length)] ?? 0xf6f3ec,
    );

    // Two offset triads make the classic six-tepal star.
    addRadialRing(head, petalGeometry, petalMaterial, {
      count: 3,
      ringRadius: R * 0.12,
      ringY: 0,
      tiltDeg: 38,
      lengthM: R,
      angleOffsetRad: 0,
      tint,
    });
    addRadialRing(head, petalGeometry, petalMaterial, {
      count: 3,
      ringRadius: R * 0.12,
      ringY: -0.004,
      tiltDeg: 30,
      lengthM: R * 0.96,
      angleOffsetRad: Math.PI / 3,
      tint: tint.clone().multiplyScalar(0.97),
    });

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
    group.add(stemGroup);
    stemGroups.push(stemGroup);
  }

  attachBreeze(group, stemGroups);
  return group;
}
