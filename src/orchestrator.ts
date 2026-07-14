// The sun uses the device's real location when available (falling back to
// Tokyo otherwise); the render loop recomputes its position on a slow
// cadence since it barely moves frame to frame. Weather polls far less
// often — Open-Meteo's own data updates roughly hourly.

import { sunPosition } from "./engine/astro/solar";
import type { GeoLocation } from "./engine/astro/types";
import { loadSavedLocation, requestLocation, saveLocation } from "./engine/geolocation/geolocation";
import { deriveSceneState } from "./engine/scene-state/sceneState";
import { fetchCurrentWeather } from "./engine/weather/client";
import { shouldKeepStale } from "./engine/weather/staleness";
import type { WeatherSnapshot } from "./engine/weather/types";
import { createRenderContext } from "./scene/renderer";
import { createSceneRig } from "./scene/scene";
import { createPermissionPrompt } from "./ui/permissionPrompt";

// Used until a real GPS fix lands (or forever, if the user denies it).
const FALLBACK_LOCATION: GeoLocation = { lat: 35.6762, lng: 139.6503 }; // Tokyo

const SUN_UPDATE_INTERVAL_SEC = 1;
const WEATHER_POLL_MS = 12 * 60 * 1000;
// A fetch failure keeps showing the last good weather for a while (a rain
// scene shouldn't visibly clear up just because one poll failed), but past
// this age an unreachable API falls back to a neutral mood instead.
const WEATHER_MAX_STALE_MS = 30 * 60 * 1000;

export function startApp(): void {
  const canvas = document.querySelector<HTMLCanvasElement>("#scene");
  const appMount = document.querySelector<HTMLDivElement>("#app");
  if (!canvas || !appMount) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ctx = createRenderContext(canvas);
  const rig = createSceneRig(ctx, reducedMotion);

  let currentLocation: GeoLocation = loadSavedLocation(localStorage) ?? FALLBACK_LOCATION;
  let currentWeather: WeatherSnapshot | null = null;

  function applyScene(): void {
    const sun = sunPosition(new Date(), currentLocation);
    rig.applySceneState(deriveSceneState(sun, currentWeather));
  }

  function renderFrame(): void {
    ctx.resize();
    ctx.render();
  }

  async function refreshWeather(): Promise<void> {
    const result = await fetchCurrentWeather(currentLocation);
    if (result.ok) {
      currentWeather = result.snapshot;
    } else if (!shouldKeepStale(currentWeather, Date.now(), WEATHER_MAX_STALE_MS)) {
      currentWeather = null;
    }
    applyScene();
    renderFrame();
  }

  // Render immediately with the fallback/saved location and no weather yet
  // — the GPS fix and the weather fetch both resolve asynchronously below
  // and never block first paint.
  applyScene();
  window.addEventListener("resize", renderFrame);
  renderFrame();

  const prompt = createPermissionPrompt(appMount);
  function tryGeolocate(): void {
    void requestLocation(navigator.geolocation).then((loc) => {
      if (loc) {
        currentLocation = loc;
        saveLocation(localStorage, loc);
        prompt.hide();
        applyScene();
        renderFrame();
        void refreshWeather(); // the previous fetch (if any) was for the old location
      } else {
        prompt.showDenied(tryGeolocate);
      }
    });
  }
  tryGeolocate();

  void refreshWeather();
  window.setInterval(() => void refreshWeather(), WEATHER_POLL_MS);

  if (reducedMotion) return;

  let last = performance.now();
  let sunAccumulatorSec = 0;
  function tick(now: number): void {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;

    sunAccumulatorSec += dt;
    if (sunAccumulatorSec >= SUN_UPDATE_INTERVAL_SEC) {
      sunAccumulatorSec = 0;
      applyScene();
    }

    rig.update(dt);
    ctx.render();
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
