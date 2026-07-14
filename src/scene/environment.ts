import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

/**
 * A fully procedural (box geometry + point lights, no external images) IBL
 * environment, so the vase's glass transmission/reflections work without
 * pulling in any external asset or relaxing the CSP's img-src.
 */
export function applyProceduralEnvironment(renderer: THREE.WebGLRenderer, scene: THREE.Scene): void {
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
}
