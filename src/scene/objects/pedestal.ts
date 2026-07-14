import * as THREE from "three";

/** Small tabletop pedestal + a shadow-catching ground disc beneath it. */
export function createPedestal(): THREE.Group {
  const group = new THREE.Group();

  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.14, 0.04, 32),
    new THREE.MeshStandardMaterial({ color: 0x11151f, roughness: 0.55, metalness: 0.05 }),
  );
  pedestal.position.y = -0.02;
  pedestal.castShadow = true;
  pedestal.receiveShadow = true;
  group.add(pedestal);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(0.9, 48),
    new THREE.ShadowMaterial({ opacity: 0.45 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.04;
  ground.receiveShadow = true;
  group.add(ground);

  return group;
}
