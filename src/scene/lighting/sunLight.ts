import * as THREE from "three";
import { kelvinToRgb01 } from "../../engine/scene-state/colorTemp";
import { createWindowGobo } from "./windowGobo";

export interface SunLightRig {
  light: THREE.DirectionalLight;
  gobo: THREE.Mesh;
  update(dirEnu: readonly [number, number, number], intensity: number, colorTempK: number): void;
}

// The shadow frustum covers the whole visible floor/wall area — with the
// window gobo in play, "outside the frustum" means "unshadowed = lit", so a
// too-tight frustum would draw a bright ring around a window-lit island.
const SUN_DISTANCE_M = 2.2;
const SHADOW_HALF_EXTENT_M = 2.2;
const GOBO_DISTANCE_M = 1.5;
const TARGET = new THREE.Vector3(0, 0.16, 0); // roughly the (0.64×-scaled) cluster center

export function createSunLightRig(): SunLightRig {
  const light = new THREE.DirectionalLight(0xffffff, 0);
  light.castShadow = true;
  light.shadow.camera.left = -SHADOW_HALF_EXTENT_M;
  light.shadow.camera.right = SHADOW_HALF_EXTENT_M;
  light.shadow.camera.top = SHADOW_HALF_EXTENT_M;
  light.shadow.camera.bottom = -SHADOW_HALF_EXTENT_M;
  light.shadow.camera.near = 0.1;
  light.shadow.camera.far = 5.5;
  light.shadow.mapSize.set(1536, 1536);
  light.shadow.bias = -5e-4;
  light.shadow.normalBias = 0.005;
  light.target.position.copy(TARGET);

  const gobo = createWindowGobo();

  function update(dirEnu: readonly [number, number, number], intensity: number, colorTempK: number): void {
    light.position.set(
      TARGET.x + dirEnu[0] * SUN_DISTANCE_M,
      TARGET.y + dirEnu[1] * SUN_DISTANCE_M,
      TARGET.z + dirEnu[2] * SUN_DISTANCE_M,
    );
    light.intensity = intensity;
    const [r, g, b] = kelvinToRgb01(colorTempK);
    light.color.setRGB(r, g, b);

    // The window rides along the light direction, always facing it, so the
    // paned patch of light lands on the scene from wherever the sun is.
    gobo.position.set(
      TARGET.x + dirEnu[0] * GOBO_DISTANCE_M,
      TARGET.y + dirEnu[1] * GOBO_DISTANCE_M,
      TARGET.z + dirEnu[2] * GOBO_DISTANCE_M,
    );
    gobo.lookAt(light.position);
  }

  return { light, gobo, update };
}
