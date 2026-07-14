import * as THREE from "three";

/**
 * Ground disc the vase stands directly on, its far edge dissolved into the
 * backdrop by the scene fog.
 *
 * A plain lit material, not ShadowMaterial: this scene is often dark, so a
 * shadow that only darkens (assuming a bright default surface) is invisible
 * against a background that's already near-black. A dim surface that
 * brightens where the sun actually hits it — and simply stays dim, not
 * additionally-blackened, where shadowed — reads instead.
 */
export function createGround(): THREE.Mesh {
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(0.9, 48),
    new THREE.MeshStandardMaterial({ color: 0x1b212f, roughness: 0.85 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.0005; // hair below y=0 so the vase base never z-fights
  ground.receiveShadow = true;
  return ground;
}
