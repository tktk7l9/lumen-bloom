import * as THREE from "three";
import { neutralMood } from "../engine/weather/mapping";
import type { WeatherMood } from "../engine/weather/types";
import type { SceneState } from "../engine/scene-state/sceneState";
import { applyProceduralEnvironment } from "./environment";
import { createSunLightRig } from "./lighting/sunLight";
import { createPedestal } from "./objects/pedestal";
import { getSceneObject } from "./objects/registry";
import { VASE_OBJECT_ID } from "./objects/vaseFactory"; // also registers it as a side effect
import type { RenderContext } from "./renderer";
import { createWeatherEffects } from "./weatherFx";

export interface SceneRig {
  update(dtSec: number): void;
  applySceneState(state: SceneState): void;
}

// Matches renderer.ts's initial FogExp2 density — the "clear sky" baseline
// that mood.fogDensityMultiplier scales from.
const BASE_FOG_DENSITY = 0.5;

/** Assembles the pedestal + centerpiece object under the real sun light rig + weather mood. */
export function createSceneRig(ctx: RenderContext, reducedMotion = false): SceneRig {
  applyProceduralEnvironment(ctx.renderer, ctx.scene);

  const ambient = new THREE.AmbientLight(0x445066, 0.5);
  ctx.scene.add(ambient);

  const sunRig = createSunLightRig();
  ctx.scene.add(sunRig.light, sunRig.light.target);

  ctx.scene.add(createPedestal());

  const factory = getSceneObject(VASE_OBJECT_ID);
  if (factory) ctx.scene.add(factory.create());

  const weatherEffects = createWeatherEffects(reducedMotion);
  ctx.scene.add(weatherEffects.group);

  let currentMood: WeatherMood = neutralMood();

  return {
    update(dtSec: number): void {
      weatherEffects.update(currentMood, dtSec);
    },
    applySceneState(state: SceneState): void {
      sunRig.update(state.sun.directionEnu, state.sun.intensity, state.sun.colorTempK);
      ambient.intensity = state.sun.ambientLevel;

      currentMood = state.mood;
      ctx.fog.density = BASE_FOG_DENSITY * state.mood.fogDensityMultiplier;
      ambient.color.setHex(state.mood.ambientTintHex);
    },
  };
}
