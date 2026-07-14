// Geolocation → sun position → weather → scene wiring lands here in later
// phases. For now this drives just the Three.js render/resize loop.

import { createRenderContext } from "./scene/renderer";
import { createSceneRig } from "./scene/scene";

export function startApp(): void {
  const canvas = document.querySelector<HTMLCanvasElement>("#scene");
  if (!canvas) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ctx = createRenderContext(canvas);
  const rig = createSceneRig(ctx);

  function renderFrame(): void {
    ctx.resize();
    ctx.render();
  }

  window.addEventListener("resize", renderFrame);
  renderFrame();

  if (reducedMotion) return;

  let last = performance.now();
  function tick(now: number): void {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    rig.update(dt);
    ctx.render();
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
