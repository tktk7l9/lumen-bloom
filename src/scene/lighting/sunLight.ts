import * as THREE from "three";
import { kelvinToRgb01 } from "../../engine/scene-state/colorTemp";

export interface SunLightRig {
  light: THREE.DirectionalLight;
  update(dirEnu: readonly [number, number, number], intensity: number, colorTempK: number): void;
}

// Shadow frustum sized to the pedestal's ground disc (0.9m radius, see
// objects/pedestal.ts), not just the vase itself — at low sun altitudes a
// human-scale shadow is many times longer than the object casting it (at
// alt=27° a 0.47m-tall vase already casts a ~0.9m shadow), so the frustum
// must cover the whole disc or the shadow simply doesn't render at all.
const SUN_DISTANCE_M = 0.8;
const SHADOW_HALF_EXTENT_M = 1.1;

export function createSunLightRig(): SunLightRig {
  const light = new THREE.DirectionalLight(0xffffff, 0);
  light.castShadow = true;
  light.shadow.camera.left = -SHADOW_HALF_EXTENT_M;
  light.shadow.camera.right = SHADOW_HALF_EXTENT_M;
  light.shadow.camera.top = SHADOW_HALF_EXTENT_M;
  light.shadow.camera.bottom = -SHADOW_HALF_EXTENT_M;
  light.shadow.camera.near = 0.1;
  light.shadow.camera.far = 3;
  light.shadow.mapSize.set(2048, 2048);
  light.shadow.bias = -5e-4;
  light.shadow.normalBias = 0.005;
  light.target.position.set(0, 0.16, 0); // roughly the (0.64×-scaled) cluster center

  function update(dirEnu: readonly [number, number, number], intensity: number, colorTempK: number): void {
    light.position.set(
      dirEnu[0] * SUN_DISTANCE_M,
      dirEnu[1] * SUN_DISTANCE_M,
      dirEnu[2] * SUN_DISTANCE_M,
    );
    light.intensity = intensity;
    const [r, g, b] = kelvinToRgb01(colorTempK);
    light.color.setRGB(r, g, b);
  }

  return { light, update };
}
