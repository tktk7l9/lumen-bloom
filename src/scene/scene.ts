import * as THREE from "three";
import { applyProceduralEnvironment } from "./environment";
import { createPedestal } from "./objects/pedestal";
import { getSceneObject } from "./objects/registry";
import { VASE_OBJECT_ID } from "./objects/vaseFactory"; // also registers it as a side effect
import type { RenderContext } from "./renderer";

export interface SceneRig {
  update(dtSec: number): void;
}

/**
 * Assembles the pedestal + centerpiece object under a temporary fixed key
 * light. The key light stands in for the real sun rig, added once
 * geolocation + solar position are wired in.
 */
export function createSceneRig(ctx: RenderContext): SceneRig {
  applyProceduralEnvironment(ctx.renderer, ctx.scene);

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

  ctx.scene.add(createPedestal());

  const factory = getSceneObject(VASE_OBJECT_ID);
  if (factory) ctx.scene.add(factory.create());

  return {
    update(_dtSec: number): void {
      // Sun/weather-driven updates land here once wired in (Tasks 5-8).
    },
  };
}
