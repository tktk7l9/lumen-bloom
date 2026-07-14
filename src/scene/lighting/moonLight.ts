import * as THREE from "three";

export interface MoonLightRig {
  light: THREE.DirectionalLight;
  update(dirEnu: readonly [number, number, number], intensity: number): void;
}

const MOON_DISTANCE_M = 2.2;
const SHADOW_HALF_EXTENT_M = 1.6;
const TARGET = new THREE.Vector3(0, 0.16, 0);

/** Cool secondary key light for the night — casts its own soft shadows. */
export function createMoonLightRig(): MoonLightRig {
  const light = new THREE.DirectionalLight(0xa9bdd9, 0);
  light.castShadow = true;
  light.shadow.camera.left = -SHADOW_HALF_EXTENT_M;
  light.shadow.camera.right = SHADOW_HALF_EXTENT_M;
  light.shadow.camera.top = SHADOW_HALF_EXTENT_M;
  light.shadow.camera.bottom = -SHADOW_HALF_EXTENT_M;
  light.shadow.camera.near = 0.1;
  light.shadow.camera.far = 5;
  light.shadow.mapSize.set(1024, 1024);
  light.shadow.bias = -5e-4;
  light.shadow.normalBias = 0.005;
  light.target.position.copy(TARGET);

  function update(dirEnu: readonly [number, number, number], intensity: number): void {
    light.position.set(
      TARGET.x + dirEnu[0] * MOON_DISTANCE_M,
      TARGET.y + dirEnu[1] * MOON_DISTANCE_M,
      TARGET.z + dirEnu[2] * MOON_DISTANCE_M,
    );
    light.intensity = intensity;
  }

  return { light, update };
}
