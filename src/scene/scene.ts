import * as THREE from "three";
import { neutralMood } from "../engine/weather/mapping";
import type { WeatherMood } from "../engine/weather/types";
import type { SceneState } from "../engine/scene-state/sceneState";
import { applyProceduralEnvironment } from "./environment";
import { createMoonLightRig } from "./lighting/moonLight";
import { createSunLightRig } from "./lighting/sunLight";
import { BASE_FLOOR_COLOR, createRoom, SNOW_FLOOR_COLOR } from "./objects/room";
import { getSceneObject } from "./objects/registry";
import "./objects/tulipFactory"; // registers the tulip centerpiece
import { VASE_OBJECT_ID } from "./objects/vaseFactory"; // also registers it as a side effect
import type { RenderContext } from "./renderer";
import { createWeatherEffects } from "./weatherFx";

export interface SceneRig {
  update(dtSec: number): void;
  applySceneState(state: SceneState): void;
}

// The "clear sky" baseline that mood.fogDensityMultiplier scales from.
// Lower than the old open-void value: the back wall sits ~2m from the
// camera, and denser fog washed it toward the sky tint like a haze indoors.
const BASE_FOG_DENSITY = 0.3;

// Exponential-smoothing time constant for lighting changes. The first real
// weather fetch lands a few hundred ms after the clear-sky first paint, and
// snapping the whole scene to the new mood in one frame reads as a glitch —
// this eases every lighting quantity there over a couple of seconds instead.
const TRANSITION_TAU_SEC = 2;

const GLASS_ROUGHNESS = 0.04;
const FROSTED_GLASS_ROUGHNESS = 0.4;

interface Lighting {
  dirEnu: readonly [number, number, number];
  sunIntensity: number;
  colorTempK: number;
  moonDirEnu: readonly [number, number, number];
  moonIntensity: number;
  ambientLevel: number;
  environmentLevel: number;
  fogDensity: number;
  glassRoughness: number;
  ambientTint: THREE.Color;
  backdrop: THREE.Color;
  floorColor: THREE.Color;
}

function lightingFrom(state: SceneState): Lighting {
  return {
    dirEnu: state.sun.directionEnu,
    sunIntensity: state.sun.intensity,
    colorTempK: state.sun.colorTempK,
    moonDirEnu: state.moon.directionEnu,
    moonIntensity: state.moon.intensity,
    ambientLevel: state.sun.ambientLevel,
    environmentLevel: state.sun.environmentLevel,
    fogDensity: BASE_FOG_DENSITY * state.mood.fogDensityMultiplier,
    glassRoughness:
      state.temperatureC !== null && state.temperatureC <= 0
        ? FROSTED_GLASS_ROUGHNESS
        : GLASS_ROUGHNESS,
    ambientTint: new THREE.Color(state.mood.ambientTintHex),
    backdrop: new THREE.Color(state.backdropHex),
    floorColor: new THREE.Color(
      state.mood.particle === "snow" ? SNOW_FLOOR_COLOR : BASE_FLOOR_COLOR,
    ),
  };
}

function cloneLighting(l: Lighting): Lighting {
  return {
    ...l,
    ambientTint: l.ambientTint.clone(),
    backdrop: l.backdrop.clone(),
    floorColor: l.floorColor.clone(),
  };
}

/** Assembles the room + centerpiece object under the sun/moon light rigs + weather mood. */
export function createSceneRig(
  ctx: RenderContext,
  reducedMotion = false,
  objectId: string | null = null,
): SceneRig {
  applyProceduralEnvironment(ctx.renderer, ctx.scene);

  const ambient = new THREE.AmbientLight(0x445066, 0.5);
  ctx.scene.add(ambient);

  const sunRig = createSunLightRig();
  ctx.scene.add(sunRig.light, sunRig.light.target, sunRig.gobo);

  const moonRig = createMoonLightRig();
  ctx.scene.add(moonRig.light, moonRig.light.target);

  // Lightning: a cold ambient burst, driven in update() while a storm mood
  // is active.
  const flashLight = new THREE.AmbientLight(0xd7e2ff, 0);
  ctx.scene.add(flashLight);

  const room = createRoom();
  ctx.scene.add(room.group);

  const factory = getSceneObject(objectId ?? VASE_OBJECT_ID) ?? getSceneObject(VASE_OBJECT_ID);
  let centerpieceUpdate: ((tSec: number) => void) | null = null;
  let glassMaterial: THREE.MeshPhysicalMaterial | null = null;
  if (factory) {
    const centerpiece = factory.create();
    centerpiece.scale.setScalar(0.64); // two sizes smaller in frame; still standing on y=0
    ctx.scene.add(centerpiece);
    centerpieceUpdate = (centerpiece.userData.update as ((t: number) => void) | undefined) ?? null;
    centerpiece.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.name === "vase-glass") {
        glassMaterial = obj.material as THREE.MeshPhysicalMaterial;
      }
    });
  }

  const weatherEffects = createWeatherEffects(reducedMotion);
  ctx.scene.add(weatherEffects.group);

  let currentMood: WeatherMood = neutralMood();
  let current: Lighting | null = null;
  let target: Lighting | null = null;
  let elapsedSec = 0;
  let nextFlashInSec = 8;
  let flashRemainingSec = 0;
  const FLASH_DURATION_SEC = 0.3;

  function applyCurrent(): void {
    if (!current) return;
    sunRig.update(current.dirEnu, current.sunIntensity, current.colorTempK);
    moonRig.update(current.moonDirEnu, current.moonIntensity);
    ambient.intensity = current.ambientLevel;
    ambient.color.copy(current.ambientTint);
    ctx.scene.environmentIntensity = current.environmentLevel;
    ctx.fog.density = current.fogDensity;
    ctx.fog.color.copy(current.backdrop);
    room.floorMaterial.color.copy(current.floorColor);
    if (glassMaterial) glassMaterial.roughness = current.glassRoughness;
    // Backdrop + fog track the real-world brightness at the viewer's
    // location: the mood's daylight sky tint faded toward black at night.
    ctx.renderer.setClearColor(current.backdrop, 1);
  }

  function updateLightning(dtSec: number): void {
    if (currentMood.lightning && !reducedMotion) {
      nextFlashInSec -= dtSec;
      if (nextFlashInSec <= 0) {
        flashRemainingSec = FLASH_DURATION_SEC;
        nextFlashInSec = 6 + Math.random() * 12;
      }
    }
    if (flashRemainingSec > 0) {
      flashRemainingSec = Math.max(0, flashRemainingSec - dtSec);
      const p = flashRemainingSec / FLASH_DURATION_SEC;
      // Two-pulse flicker inside a fast-decaying envelope.
      flashLight.intensity = 2.4 * Math.sin(p * Math.PI) * (0.65 + 0.35 * Math.sin(p * 40));
    } else {
      flashLight.intensity = 0;
    }
  }

  return {
    update(dtSec: number): void {
      elapsedSec += dtSec;
      if (current && target) {
        const k = 1 - Math.exp(-dtSec / TRANSITION_TAU_SEC);
        current.dirEnu = target.dirEnu; // continuous already — no easing needed
        current.moonDirEnu = target.moonDirEnu;
        current.sunIntensity += (target.sunIntensity - current.sunIntensity) * k;
        current.colorTempK += (target.colorTempK - current.colorTempK) * k;
        current.moonIntensity += (target.moonIntensity - current.moonIntensity) * k;
        current.ambientLevel += (target.ambientLevel - current.ambientLevel) * k;
        current.environmentLevel += (target.environmentLevel - current.environmentLevel) * k;
        current.fogDensity += (target.fogDensity - current.fogDensity) * k;
        current.glassRoughness += (target.glassRoughness - current.glassRoughness) * k;
        current.ambientTint.lerp(target.ambientTint, k);
        current.backdrop.lerp(target.backdrop, k);
        current.floorColor.lerp(target.floorColor, k);
        applyCurrent();
      }
      updateLightning(dtSec);
      centerpieceUpdate?.(elapsedSec);
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
