import * as THREE from "three";
import type { SunLightingState } from "../engine/scene-state/sunLighting";
import { applyProceduralEnvironment } from "./environment";
import { createSunLightRig } from "./lighting/sunLight";
import { createPedestal } from "./objects/pedestal";
import { getSceneObject } from "./objects/registry";
import { VASE_OBJECT_ID } from "./objects/vaseFactory"; // also registers it as a side effect
import type { RenderContext } from "./renderer";

export interface SceneRig {
  update(dtSec: number): void;
  applySunLighting(state: SunLightingState): void;
}

/** Assembles the pedestal + centerpiece object under the real sun light rig. */
export function createSceneRig(ctx: RenderContext): SceneRig {
  applyProceduralEnvironment(ctx.renderer, ctx.scene);

  const ambient = new THREE.AmbientLight(0x445066, 0.5);
  ctx.scene.add(ambient);

  const sunRig = createSunLightRig();
  ctx.scene.add(sunRig.light, sunRig.light.target);

  ctx.scene.add(createPedestal());

  const factory = getSceneObject(VASE_OBJECT_ID);
  if (factory) ctx.scene.add(factory.create());

  return {
    update(_dtSec: number): void {
      // Weather-driven fog/particle updates land here (Task 8).
    },
    applySunLighting(state: SunLightingState): void {
      sunRig.update(state.directionEnu, state.intensity, state.colorTempK);
      ambient.intensity = state.ambientLevel;
    },
  };
}
