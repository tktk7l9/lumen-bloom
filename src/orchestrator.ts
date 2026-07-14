// The sun/moon use the device's real location when available (falling back
// to Tokyo otherwise); the render loop recomputes their positions on a slow
// cadence since they barely move frame to frame. Weather polls far less
// often — Open-Meteo's own data updates roughly hourly. URL query params
// can pin the location (?lat=&lng=), shift time (?t=), pick the centerpiece
// (?obj=), or force the HUD (?hud=).

import { moonPosition } from "./engine/astro/lunar";
import { moonPhase } from "./engine/astro/moonphase";
import { sunPosition } from "./engine/astro/solar";
import type { GeoLocation } from "./engine/astro/types";
import { loadSavedLocation, requestLocation, saveLocation } from "./engine/geolocation/geolocation";
import { deriveSceneState } from "./engine/scene-state/sceneState";
import { parseUrlOverrides } from "./engine/urlState";
import { fetchCurrentWeather } from "./engine/weather/client";
import { shouldKeepStale } from "./engine/weather/staleness";
import type { WeatherSnapshot } from "./engine/weather/types";
import { createRenderContext } from "./scene/renderer";
import { createSceneRig } from "./scene/scene";
import { createHud } from "./ui/hud";
import { createPermissionPrompt } from "./ui/permissionPrompt";
import { setupWakeLock } from "./ui/wakeLock";

// Used until a real GPS fix lands (or forever, if the user denies it).
const FALLBACK_LOCATION: GeoLocation = { lat: 35.6762, lng: 139.6503 }; // Tokyo

const SUN_UPDATE_INTERVAL_SEC = 1;
// Under reduced motion there's no per-frame loop at all, so the sun is
// refreshed on a plain timer instead — slower is fine, since a value that
// moves this little is indistinguishable at 1s vs 5min granularity anyway.
const SUN_REDUCED_MOTION_REFRESH_MS = 5 * 60 * 1000;
const HUD_REFRESH_MS = 30 * 1000;
const WEATHER_POLL_MS = 12 * 60 * 1000;
// A fetch failure keeps showing the last good weather for a while (a rain
// scene shouldn't visibly clear up just because one poll failed), but past
// this age an unreachable API falls back to a neutral mood instead.
const WEATHER_MAX_STALE_MS = 30 * 60 * 1000;

export function startApp(): void {
  const canvas = document.querySelector<HTMLCanvasElement>("#scene");
  const appMount = document.querySelector<HTMLDivElement>("#app");
  if (!canvas || !appMount) return;

  const overrides = parseUrlOverrides(window.location.search, Date.now());
  const now = (): Date => new Date(Date.now() + (overrides.timeOffsetMs ?? 0));

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ctx = createRenderContext(canvas);
  const rig = createSceneRig(ctx, reducedMotion, overrides.objectId);
  const hud = createHud(appMount, overrides.hud);
  setupWakeLock();

  let currentLocation: GeoLocation =
    overrides.location ?? loadSavedLocation(localStorage) ?? FALLBACK_LOCATION;
  let currentWeather: WeatherSnapshot | null = null;

  function applyScene(): void {
    const date = now();
    const sun = sunPosition(date, currentLocation);
    const phase = moonPhase(date);
    const moon = {
      position: moonPosition(date, currentLocation),
      illumination: phase.illumination,
    };
    rig.applySceneState(deriveSceneState(sun, currentWeather, moon));
    hud.render({
      now: date,
      weather: currentWeather,
      moonPhaseName: sun.apparentAltitude < -6 ? phase.name : null,
    });
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

  // A URL-pinned location wins over the device's — no GPS request, no prompt.
  if (overrides.location === null) {
    const prompt = createPermissionPrompt(appMount);
    const tryGeolocate = (): void => {
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
    };
    tryGeolocate();
  }

  // --- Periodic updates, paused while the tab/window is hidden (battery/CPU) ---
  let rafId: number | null = null;
  let weatherIntervalId: number | null = null;
  let sunIntervalId: number | null = null;
  let hudIntervalId: number | null = null;
  let last = performance.now();
  let sunAccumulatorSec = 0;

  function tick(nowMs: number): void {
    const dt = Math.min(0.1, (nowMs - last) / 1000);
    last = nowMs;

    sunAccumulatorSec += dt;
    if (sunAccumulatorSec >= SUN_UPDATE_INTERVAL_SEC) {
      sunAccumulatorSec = 0;
      applyScene();
    }

    rig.update(dt);
    ctx.render();
    rafId = requestAnimationFrame(tick);
  }

  function startPeriodicUpdates(): void {
    weatherIntervalId = window.setInterval(() => void refreshWeather(), WEATHER_POLL_MS);
    hudIntervalId = window.setInterval(() => applyScene(), HUD_REFRESH_MS);
    if (reducedMotion) {
      sunIntervalId = window.setInterval(() => {
        applyScene();
        renderFrame();
      }, SUN_REDUCED_MOTION_REFRESH_MS);
    } else {
      last = performance.now();
      sunAccumulatorSec = 0;
      rafId = requestAnimationFrame(tick);
    }
  }

  function stopPeriodicUpdates(): void {
    if (rafId !== null) cancelAnimationFrame(rafId);
    if (weatherIntervalId !== null) window.clearInterval(weatherIntervalId);
    if (sunIntervalId !== null) window.clearInterval(sunIntervalId);
    if (hudIntervalId !== null) window.clearInterval(hudIntervalId);
    rafId = null;
    weatherIntervalId = null;
    sunIntervalId = null;
    hudIntervalId = null;
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopPeriodicUpdates();
    } else {
      applyScene();
      void refreshWeather();
      renderFrame();
      startPeriodicUpdates();
    }
  });

  void refreshWeather();
  startPeriodicUpdates();
}
