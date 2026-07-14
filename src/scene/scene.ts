import * as THREE from "three";
import { neutralMood } from "../engine/weather/mapping";
import type { WeatherMood } from "../engine/weather/types";
import type { SceneState } from "../engine/scene-state/sceneState";
import { applyProceduralEnvironment } from "./environment";
import { createSunLightRig } from "./lighting/sunLight";
import { createGround } from "./objects/ground";
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

/** Assembles the ground + centerpiece object under the real sun light rig + weather mood. */
export function createSceneRig(ctx: RenderContext, reducedMotion = false): SceneRig {
  applyProceduralEnvironment(ctx.renderer, ctx.scene);

  const ambient = new THREE.AmbientLight(0x445066, 0.5);
  ctx.scene.add(ambient);

  const sunRig = createSunLightRig();
  ctx.scene.add(sunRig.light, sunRig.light.target);

  ctx.scene.add(createGround());

  const factory = getSceneObject(VASE_OBJECT_ID);
  if (factory) {
    const centerpiece = factory.create();
    centerpiece.scale.setScalar(0.8); // one size smaller in frame; still standing on y=0
    ctx.scene.add(centerpiece);
  }

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
      ctx.scene.environmentIntensity = state.sun.environmentLevel;

      currentMood = state.mood;
      ctx.fog.density = BASE_FOG_DENSITY * state.mood.fogDensityMultiplier;
      ambient.color.setHex(state.mood.ambientTintHex);
      // Backdrop + fog track the real-world brightness at the viewer's
      // location: the mood's daylight sky tint faded toward black at night.
      ctx.renderer.setClearColor(state.backdropHex, 1);
      ctx.fog.color.setHex(state.backdropHex);
      // Apply particle visibility/intensity immediately: under reduced
      // motion, update(dtSec) above is never called on a timer, so without
      // this a mood change (e.g. clear → rain) would never actually show
      // any particles — just a static frame with none, which is wrong.
      weatherEffects.update(currentMood, 0);
    },
  };
}
