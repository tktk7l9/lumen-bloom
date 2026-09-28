# About this repository (for AI/Claude)

"Lumen Bloom": a 3D wallpaper of a procedural sunflower vase that mirrors the sun's and moon's position at the current location and the weather, in real time.
A water-filled glass vase with sunflowers sits in a room corner (floor + two walls). Real sunlight through a window-shaped gobo and moonlight at night cast its shadows, and the real weather (clear/cloudy/fog/rain/snow/thunderstorm) is reflected in the sky color, ambient light, fog, particles, lightning, snow cover and frost. It is meant to be left running as a wallpaper.

## Development conventions

- **Vanilla Vite + TypeScript**. No framework. The UI is built directly in the DOM (`src/ui/`).
- **The lib (engine) layer = pure functions only, with no Three.js dependency** (`src/engine/**`). The scene layer (`src/scene/**`) only assembles Three.js and stays limited to drawing whatever the engine layer outputs. Procedural generation of vases and flowers follows the same principle, split into "profile computation (engine)" and "geometry assembly (scene)".
- **Objects are generated procedurally**. External 3D assets (GLTF etc.) are not used (to keep the CSP self-contained and avoid licensing). Seasonal arrangements are the catalog in `src/engine/arrangements.ts` (pure data, including the weekly selection logic, 100% tested) + `src/scene/objects/arrangementFactory.ts` (catalog → Three.js group) + the per-kind builders in `objects/flora/`. When adding a new flower, touch this set of three (catalog entry → flora builder → the factory's switch). `?obj=` pins one.
- **A strict CSP is assumed** (`vercel.json`). No inline script/style. The only external resource is the weather API (only `https://api.open-meteo.com` is added to `connect-src`). The glass's environment map is `three/examples/jsm/environments/RoomEnvironment.js` (fully procedural); the window-lattice gobo and rain/snow sprites are also generated as CanvasTextures, and no external images are used at all.
- **Permissions-Policy is `geolocation=(self), screen-wake-lock=(self)`**. Do not revert it to the template's deny-all (`geolocation=()`) (getting the current location is a core feature). camera stays `()`.
- **Rendering pitfalls (confirmed by measurement)**: ① the IBL of `scene.environment` lights the scene 24 hours a day regardless of the sun, so `environmentIntensity` must always be tied to the day/night curve ② alpha transparency (the water) inside transmission glass disappears when the glass does depthWrite → the glass uses `depthWrite: false` ③ walls must not castShadow (the whole screen turns black in the hours when the sun goes behind a wall) ④ the window gobo disables colorWrite/depthWrite and uses alphaTest so it only contributes to the shadow map.
- **Dynamic import for heavy work**: `src/orchestrator.ts` and everything after it is loaded from `src/main.ts` via `import()`. However, because this app is a wallpaper that needs 3D rendering right after startup, the principle used in other apps ("defer until click") does not apply as is.

## Testing policy (lib 100%)

- `src/engine/**` has a 100% coverage gate (`vitest.config.ts`). `src/scene/**` and `src/ui/**` are excluded as the Three.js/DOM layers.
- Sun position calculation (`src/engine/astro/**`, ported from skydial) is checked against fixtures (`__fixtures__/ephemeris.ts`, source comments required): NOAA Solar Calculator, USNO, JPL Horizons. Tolerance ±1 min / ±0.1°.
- Weather mapping (`src/engine/weather/mapping.ts`) is tested table-driven over every WMO weather code category plus the unknown-code fallback.
- The weather client (`src/engine/weather/client.ts`) takes `fetchImpl` via DI and covers the four paths success / HTTP error / network exception / JSON parse failure with mocks. Verify the real Open-Meteo response shape once against the live API during development (mocks alone can't catch drift).
- Procedural generation (`src/engine/geometry/**`) is tested for determinism (same seed → same output), invariants (radius > 0 etc.) and boundary values.

## Sources for the astronomy

- Sun: Meeus "Astronomical Algorithms" ch.25 low-precision formulas (error ~0.01°). Moon: Meeus ch.47 truncated (~0.05°) + ch.48 (moon age, illuminated fraction), ported from skydial. Coordinate transforms and atmospheric refraction (Sæmundsson) live in `src/engine/astro/coords.ts`. Azimuth convention is N=0°, clockwise.
- The sun direction vector `sunDirection(azDeg, altDeg)` is the ENU unit vector `[sin(az)cos(alt), sin(alt), -cos(az)cos(alt)]`, which matches Three.js's Y-up / -Z = north coordinate system as is (no conversion needed).
- The staging light curve (`src/engine/scene-state/sunLighting.ts`, continuously interpolating through civil twilight) is a staging mapping, not an astronomical fact, so it is not checked against fixtures. It is covered by boundary-value and monotonicity tests.

## Weather source

- [Open-Meteo](https://open-meteo.com/) `current` API (free, no API key, CORS enabled). Clear/cloudy/fog/rain/snow/thunderstorm is decided from the WMO weather code.
- On a fetch failure the last good value is kept (`shouldKeepStale`). Only when no fetch has ever succeeded does it fall back to a neutral mood, so the wallpaper doesn't break even if the weather API is completely down.

## Commit granularity

Commit once a phase comes together (astronomy engine port / Three.js skeleton / vase & flowers / sunlight wiring / Geolocation wiring / weather client / weather effects / finishing touches), together with its tests.
Keep tsc green / tests green / build green before committing.

## Notes

- **public** (since 2026-07-14). It is a public repository, so do not put personal information or real data in code/tests.
- The sun/moon positions and the weather are all approximations (not for navigation, surveying or disaster prevention). The window lattice is a stylized effect that follows the sun direction (not a simulation of a real window's orientation).
