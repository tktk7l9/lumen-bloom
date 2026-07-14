// Weather wiring lands in a later phase. The sun uses the device's real
// location when available (falling back to Tokyo otherwise); the render
// loop recomputes its position on a slow cadence since it barely moves
// frame to frame.

import { sunPosition } from "./engine/astro/solar";
import type { GeoLocation } from "./engine/astro/types";
import { loadSavedLocation, requestLocation, saveLocation } from "./engine/geolocation/geolocation";
import { deriveSunLighting } from "./engine/scene-state/sunLighting";
import { createRenderContext } from "./scene/renderer";
import { createSceneRig } from "./scene/scene";
import { createPermissionPrompt } from "./ui/permissionPrompt";

// Used until a real GPS fix lands (or forever, if the user denies it).
const FALLBACK_LOCATION: GeoLocation = { lat: 35.6762, lng: 139.6503 }; // Tokyo

const SUN_UPDATE_INTERVAL_SEC = 1;

export function startApp(): void {
  const canvas = document.querySelector<HTMLCanvasElement>("#scene");
  const appMount = document.querySelector<HTMLDivElement>("#app");
  if (!canvas || !appMount) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ctx = createRenderContext(canvas);
  const rig = createSceneRig(ctx);

  let currentLocation: GeoLocation = loadSavedLocation(localStorage) ?? FALLBACK_LOCATION;

  function updateSun(): void {
    const sun = sunPosition(new Date(), currentLocation);
    rig.applySunLighting(deriveSunLighting(sun));
  }

  function renderFrame(): void {
    ctx.resize();
    ctx.render();
  }

  // Render immediately with the fallback/saved location — the GPS fix (or
  // its denial) resolves asynchronously below and never blocks first paint.
  updateSun();
  window.addEventListener("resize", renderFrame);
  renderFrame();

  const prompt = createPermissionPrompt(appMount);
  function tryGeolocate(): void {
    void requestLocation(navigator.geolocation).then((loc) => {
      if (loc) {
        currentLocation = loc;
        saveLocation(localStorage, loc);
        prompt.hide();
        updateSun();
        renderFrame();
      } else {
        prompt.showDenied(tryGeolocate);
      }
    });
  }
  tryGeolocate();

  if (reducedMotion) return;

  let last = performance.now();
  let sunAccumulatorSec = 0;
  function tick(now: number): void {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;

    sunAccumulatorSec += dt;
    if (sunAccumulatorSec >= SUN_UPDATE_INTERVAL_SEC) {
      sunAccumulatorSec = 0;
      updateSun();
    }

    rig.update(dt);
    ctx.render();
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
