import * as THREE from "three";
import { layoutBouquet } from "../../../engine/geometry/flowerLayout";
import { petalGrid } from "../../../engine/geometry/petalGrid";
import { phyllotaxis } from "../../../engine/geometry/phyllotaxis";
import { addRadialRing, attachBreeze, gridToGeometry } from "../flowers";

const UP = new THREE.Vector3(0, 1, 0);

export interface CosmosOptions {
  paletteHex: readonly number[];
  stemCount: number;
  seed: number;
  vaseRimYM: number;
  vaseNeckRadiusM: number;
}

/** Airy single-ring daisies on thin stems — pink/white/crimson per stem. */
export function createCosmosGroup(opts: CosmosOptions): THREE.Group {
  const stems = layoutBouquet(opts);
  const group = new THREE.Group();
  const stemGroups: THREE.Group[] = [];

  const stemMaterial = new THREE.MeshStandardMaterial({ color: 0x4c7030, roughness: 0.75 });
  // Rounded, slightly notched-feeling petal; near-white gradient tinted per stem.
  const petalGeometry = gridToGeometry(
    petalGrid({ lengthM: 1, widthM: 0.52, segmentsU: 6, segmentsV: 5, cupM: 0.05, bendM: 0.04 }),
    0xc9c9c9,
    0xffffff,
  );
  const petalMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.55,
    side: THREE.DoubleSide,
  });
  // Cosmos leaves are feathery — suggest that with narrow little blades.
  const leafGeometry = gridToGeometry(
    petalGrid({ lengthM: 1, widthM: 0.16, segmentsU: 6, segmentsV: 3, cupM: 0, bendM: 0.25 }),
    0x3d5c26,
    0x527a33,
  );
  const leafMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.7,
    side: THREE.DoubleSide,
  });
  const floretGeometry = new THREE.SphereGeometry(1, 6, 5);
  const floretMaterial = new THREE.MeshStandardMaterial({ color: 0xe8b83a, roughness: 0.85 });

  for (const stem of stems) {
    const stemGroup = new THREE.Group();
    const curve = new THREE.CatmullRomCurve3(
      stem.controlPoints.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    );
    const stemMesh = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 20, 0.0026, 6, false),
      stemMaterial,
    );
    stemMesh.castShadow = true;
    stemGroup.add(stemMesh);

    for (const leaf of stem.leaves) {
      const mesh = new THREE.Mesh(leafGeometry, leafMaterial);
      mesh.castShadow = true;
      mesh.position.copy(curve.getPointAt(leaf.t));
      mesh.scale.setScalar(leaf.lengthM * 0.8);
      const az = (leaf.azimuthDeg * Math.PI) / 180;
      const dir = new THREE.Vector3(Math.cos(az) * 0.8, -0.2, Math.sin(az) * 0.8).normalize();
      const side = new THREE.Vector3().crossVectors(UP, dir).normalize();
      const normal = new THREE.Vector3().crossVectors(side, dir);
      mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(side, dir, normal));
      stemGroup.add(mesh);
    }

    const head = new THREE.Group();
    head.position.set(...stem.headPosition);
    head.quaternion.setFromUnitVectors(UP, new THREE.Vector3(...stem.headDirection));

    const discR = stem.headRadiusM * 0.13;
    const petalLen = stem.headRadiusM * 0.42;
    const tint = new THREE.Color(
      opts.paletteHex[Math.floor(stem.colorSeed * opts.paletteHex.length)] ?? 0xe973a8,
    );

    // Tiny yellow center disc.
    const florets = new THREE.InstancedMesh(floretGeometry, floretMaterial, 24);
    const matrix = new THREE.Matrix4();
    phyllotaxis(24, discR * 0.9).forEach(([x, z], i) => {
      const s = discR * 0.22;
      matrix.makeScale(s, s * 0.7, s);
      matrix.setPosition(x, 0.0012, z);
      florets.setMatrixAt(i, matrix);
    });
    florets.instanceMatrix.needsUpdate = true;
    head.add(florets);

    // A single wide ring of eight petals, nearly flat.
    addRadialRing(head, petalGeometry, petalMaterial, {
      count: 8,
      ringRadius: discR * 0.9,
      ringY: 0,
      tiltDeg: 10,
      lengthM: petalLen,
      angleOffsetRad: stem.colorSeed * Math.PI,
      tint,
    });

    stemGroup.add(head);
    group.add(stemGroup);
    stemGroups.push(stemGroup);
  }

  attachBreeze(group, stemGroups);
  return group;
}
