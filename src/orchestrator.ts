// Weather + real Geolocation wiring land here in later phases. For now the
// sun uses a fixed provisional location; the render loop recomputes its
// real-time position on a slow cadence since it barely moves frame to frame.

import { sunPosition } from "./engine/astro/solar";
import type { GeoLocation } from "./engine/astro/types";
import { deriveSunLighting } from "./engine/scene-state/sunLighting";
import { createRenderContext } from "./scene/renderer";
import { createSceneRig } from "./scene/scene";

// Provisional fixed location (Tokyo) — replaced by real Geolocation wiring next.
const DEFAULT_LOCATION: GeoLocation = { lat: 35.6762, lng: 139.6503 };

const SUN_UPDATE_INTERVAL_SEC = 1;

export function startApp(): void {
  const canvas = document.querySelector<HTMLCanvasElement>("#scene");
  if (!canvas) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ctx = createRenderContext(canvas);
  const rig = createSceneRig(ctx);

  function updateSun(): void {
    const sun = sunPosition(new Date(), DEFAULT_LOCATION);
    rig.applySunLighting(deriveSunLighting(sun));
  }

  function renderFrame(): void {
    ctx.resize();
    ctx.render();
  }

  updateSun();
  window.addEventListener("resize", renderFrame);
  renderFrame();

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
