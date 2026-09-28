// The Three.js half of the app, loaded as its own chunk. The orchestrator
// renders the DOM overlays (the page's largest contentful paint) from the
// small chunk and only then needs three, so the ~170 KB (gzip) download no
// longer sits in front of the first meaningful paint.

export { applyProceduralEnvironment } from "./environment";
export { createRenderContext } from "./renderer";
export { createSceneRig } from "./scene";
