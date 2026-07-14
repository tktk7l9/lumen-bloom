import * as THREE from "three";

export const BACKDROP = 0x03040a;

export interface RenderContext {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  fog: THREE.FogExp2;
  resize(): void;
  render(): void;
}

/**
 * Dark-space wallpaper stage: a tight camera on a small tabletop scene, with
 * fog fading the pedestal into the surrounding darkness. No bloom pass —
 * UnrealBloomPass's fixed 5-mip blur pyramid washes the whole frame with a
 * visible tint at smaller/narrower viewport sizes (its blur radius doesn't
 * scale down with the output resolution), which a wallpaper running at an
 * arbitrary window/screen size can't risk. MeshPhysicalMaterial's specular
 * highlights read fine without it.
 */
export function createRenderContext(canvas: HTMLCanvasElement): RenderContext {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(BACKDROP, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const fog = new THREE.FogExp2(BACKDROP, 0.5);
  scene.fog = fog;

  const camera = new THREE.PerspectiveCamera(
    35,
    window.innerWidth / window.innerHeight,
    0.05,
    20,
  );
  camera.position.set(0, 0.35, 1.1);
  camera.lookAt(0, 0.15, 0);

  function resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
  }

  function render(): void {
    renderer.render(scene, camera);
  }

  return { renderer, scene, camera, fog, resize, render };
}
