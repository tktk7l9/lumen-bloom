import * as THREE from "three";
import type { RenderContext } from "./renderer";

export interface SceneRig {
  update(dtSec: number): void;
}

/**
 * Placeholder tabletop scene: a lit sphere + shadow-catching ground disc.
 * The sphere stands in for the procedural vase+flowers (added once the
 * geometry engine lands), and the fixed key light stands in for the real
 * sun rig (added once geolocation + solar position are wired in).
 */
export function createSceneRig(ctx: RenderContext): SceneRig {
  const ambient = new THREE.AmbientLight(0x445066, 0.5);
  ctx.scene.add(ambient);

  const key = new THREE.DirectionalLight(0xfff2dd, 1.2);
  key.position.set(1.5, 2, 1);
  key.castShadow = true;
  key.shadow.camera.left = -0.4;
  key.shadow.camera.right = 0.4;
  key.shadow.camera.top = 0.4;
  key.shadow.camera.bottom = -0.4;
  key.shadow.camera.near = 0.1;
  key.shadow.camera.far = 2;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -5e-4;
  key.shadow.normalBias = 0.005;
  ctx.scene.add(key, key.target);

  const placeholder = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 32, 32),
    new THREE.MeshStandardMaterial({ color: 0x8fc6e8, roughness: 0.3, metalness: 0.1 }),
  );
  placeholder.position.y = 0.12;
  placeholder.castShadow = true;
  placeholder.receiveShadow = true;
  ctx.scene.add(placeholder);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(0.8, 48),
    new THREE.ShadowMaterial({ opacity: 0.45 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ctx.scene.add(ground);

  return {
    update(dtSec: number): void {
      placeholder.rotation.y += dtSec * 0.2;
    },
  };
}
