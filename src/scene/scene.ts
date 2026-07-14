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

// Exponential-smoothing time constant for lighting changes. The first real
// weather fetch lands a few hundred ms after the clear-sky first paint, and
// snapping the whole scene to the new mood in one frame reads as a glitch —
// this eases every lighting quantity there over a couple of seconds instead.
const TRANSITION_TAU_SEC = 2;

interface Lighting {
  dirEnu: readonly [number, number, number];
  sunIntensity: number;
  colorTempK: number;
  ambientLevel: number;
  environmentLevel: number;
  fogDensity: number;
  ambientTint: THREE.Color;
  backdrop: THREE.Color;
}

function lightingFrom(state: SceneState): Lighting {
  return {
    dirEnu: state.sun.directionEnu,
    sunIntensity: state.sun.intensity,
    colorTempK: state.sun.colorTempK,
    ambientLevel: state.sun.ambientLevel,
    environmentLevel: state.sun.environmentLevel,
    fogDensity: BASE_FOG_DENSITY * state.mood.fogDensityMultiplier,
    ambientTint: new THREE.Color(state.mood.ambientTintHex),
    backdrop: new THREE.Color(state.backdropHex),
  };
}

function cloneLighting(l: Lighting): Lighting {
  return { ...l, ambientTint: l.ambientTint.clone(), backdrop: l.backdrop.clone() };
}

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
  let current: Lighting | null = null;
  let target: Lighting | null = null;

  function applyCurrent(): void {
    if (!current) return;
    sunRig.update(current.dirEnu, current.sunIntensity, current.colorTempK);
    ambient.intensity = current.ambientLevel;
    ambient.color.copy(current.ambientTint);
    ctx.scene.environmentIntensity = current.environmentLevel;
    ctx.fog.density = current.fogDensity;
    ctx.fog.color.copy(current.backdrop);
    // Backdrop + fog track the real-world brightness at the viewer's
    // location: the mood's daylight sky tint faded toward black at night.
    ctx.renderer.setClearColor(current.backdrop, 1);
  }

  return {
    update(dtSec: number): void {
      if (current && target) {
        const k = 1 - Math.exp(-dtSec / TRANSITION_TAU_SEC);
        current.dirEnu = target.dirEnu; // continuous already — no easing needed
        current.sunIntensity += (target.sunIntensity - current.sunIntensity) * k;
        current.colorTempK += (target.colorTempK - current.colorTempK) * k;
        current.ambientLevel += (target.ambientLevel - current.ambientLevel) * k;
        current.environmentLevel += (target.environmentLevel - current.environmentLevel) * k;
        current.fogDensity += (target.fogDensity - current.fogDensity) * k;
        current.ambientTint.lerp(target.ambientTint, k);
        current.backdrop.lerp(target.backdrop, k);
        applyCurrent();
      }
      weatherEffects.update(currentMood, dtSec);
    },
    applySceneState(state: SceneState): void {
      target = lightingFrom(state);
      currentMood = state.mood;
      // First paint and reduced motion snap directly — there is either
      // nothing on screen yet to transition from, or no frame loop to
      // animate the transition with.
      if (current === null || reducedMotion) {
        current = cloneLighting(target);
        applyCurrent();
      }
      // Apply particle visibility/intensity immediately: under reduced
      // motion, update(dtSec) is never called on a timer, so without this a
      // mood change (e.g. clear → rain) would never actually show any
      // particles — just a static frame with none, which is wrong.
      weatherEffects.update(currentMood, 0);
    },
  };
}
