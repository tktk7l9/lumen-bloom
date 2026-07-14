import * as THREE from "three";
import { type VaseProfileOptions, vaseProfile } from "../../engine/geometry/vaseProfile";

export function createVaseMesh(opts?: Partial<VaseProfileOptions>): THREE.Mesh {
  const profile = vaseProfile(opts).map(([r, y]) => new THREE.Vector2(r, y));
  const geometry = new THREE.LatheGeometry(profile, 48);
  geometry.computeVertexNormals();

  const material = new THREE.MeshPhysicalMaterial({
    color: 0xdff3ff,
    roughness: 0.05,
    transmission: 1.0,
    thickness: 0.02,
    ior: 1.5,
    envMapIntensity: 1.0,
    clearcoat: 0.3,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
