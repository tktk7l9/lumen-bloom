import * as THREE from "three";
import { type BouquetOptions, type StemLayout, layoutBouquet } from "../../engine/geometry/flowerLayout";

// Local space of the petal geometry spans y=[0,2] (base at the origin,
// pointing toward the tip along +Y before instancing rotates/scales it).
const PETAL_LOCAL_LENGTH = 2;
const UP = new THREE.Vector3(0, 1, 0);
const RIGHT_FALLBACK = new THREE.Vector3(1, 0, 0);

function buildPetalGeometry(): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(1, 10, 8);
  geo.scale(0.32, 1, 0.14);
  geo.translate(0, 1, 0);
  return geo;
}

/** The stem's local up/right/forward basis at its flower head, for fanning petals. */
function headBasis(stem: StemLayout): {
  origin: THREE.Vector3;
  up: THREE.Vector3;
  right: THREE.Vector3;
  forward: THREE.Vector3;
} {
  const pts = stem.controlPoints;
  const origin = new THREE.Vector3(...stem.headPosition);
  const prev = new THREE.Vector3(...pts[pts.length - 2]);
  const up = origin.clone().sub(prev).normalize();
  const arbitrary = Math.abs(up.y) > 0.9 ? RIGHT_FALLBACK : UP;
  const right = new THREE.Vector3().crossVectors(up, arbitrary).normalize();
  const forward = new THREE.Vector3().crossVectors(right, up).normalize();
  return { origin, up, right, forward };
}

/** Procedural bouquet: tube-geometry stems + an instanced-mesh petal fan per head. */
export function createFlowersGroup(opts?: Partial<BouquetOptions>): THREE.Group {
  const stems = layoutBouquet(opts);
  const group = new THREE.Group();

  const stemMaterial = new THREE.MeshStandardMaterial({ color: 0x3f7d4a, roughness: 0.6 });
  const centerMaterial = new THREE.MeshStandardMaterial({ color: 0xf6c944, roughness: 0.5 });
  const petalMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45, side: THREE.DoubleSide });

  const totalPetals = stems.reduce((sum, s) => sum + s.petalCount, 0);
  const petals = new THREE.InstancedMesh(buildPetalGeometry(), petalMaterial, totalPetals);
  petals.castShadow = true;

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  let instanceIndex = 0;

  for (const stem of stems) {
    const curve = new THREE.CatmullRomCurve3(stem.controlPoints.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
    const stemMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.003, 6, false), stemMaterial);
    stemMesh.castShadow = true;
    group.add(stemMesh);

    const { origin, up, right, forward } = headBasis(stem);

    const center = new THREE.Mesh(new THREE.SphereGeometry(0.006, 10, 8), centerMaterial);
    center.position.copy(origin);
    center.castShadow = true;
    group.add(center);

    for (let p = 0; p < stem.petalCount; p++) {
      const angle = (p / stem.petalCount) * Math.PI * 2;
      const dir = right.clone().multiplyScalar(Math.cos(angle)).add(forward.clone().multiplyScalar(Math.sin(angle)));
      const petalAxis = dir.multiplyScalar(0.75).add(up.clone().multiplyScalar(0.35)).normalize();

      dummy.position.copy(origin);
      dummy.quaternion.setFromUnitVectors(UP, petalAxis);
      dummy.scale.setScalar(stem.petalLengthM / PETAL_LOCAL_LENGTH);
      dummy.updateMatrix();
      petals.setMatrixAt(instanceIndex, dummy.matrix);

      color.setHSL(0.95 - stem.colorSeed * 0.15, 0.55, 0.68);
      petals.setColorAt(instanceIndex, color);
      instanceIndex++;
    }
  }

  petals.instanceMatrix.needsUpdate = true;
  if (petals.instanceColor) petals.instanceColor.needsUpdate = true;
  group.add(petals);

  return group;
}
