import * as THREE from "three";

export const BACKDROP = 0x03040a;

export interface RenderContext {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  fog: THREE.FogExp2;
  resize(): void;
  render(): void;
  /**
   * Compile the shader programs the first frame will need, without blocking
   * on them (see `precompileScene`). `yieldBetween` ends the current task;
   * it is awaited between the per-program finishing steps.
   */
  precompile(yieldBetween: () => Promise<void>): Promise<void>;
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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(BACKDROP, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  // PCFSoftShadowMap was removed in three r18x: the shadow pass silently
  // swaps it for PCFShadowMap on the first frame, which would change every
  // program's cache key after precompile() and force a relink. Asking for
  // what is actually rendered keeps the look and the precompiled programs.
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const fog = new THREE.FogExp2(BACKDROP, 0.5);
  scene.fog = fog;

  const camera = new THREE.PerspectiveCamera(
    35,
    window.innerWidth / window.innerHeight,
    0.05,
    20,
  );
  // Three-quarter view: orbited ~45° counterclockwise from the old
  // straight-on framing (camera in the southwest, looking northeast into
  // the room corner), pitched a gentle ~15° down at the vase. Matches the
  // 0.64×-scaled centerpiece in scene.ts.
  camera.position.set(-1.02, 0.57, 1.02);
  camera.lookAt(0, 0.18, 0);

  function resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(w, h);
  }

  // Stand-in materials from precompile() keep their programs alive until
  // the first real frame has taken them over (see precompileScene).
  let releaseStandIns: (() => void) | null = null;

  function render(): void {
    renderer.render(scene, camera);
    releaseStandIns?.();
    releaseStandIns = null;
  }

  async function precompile(yieldBetween: () => Promise<void>): Promise<void> {
    releaseStandIns = await precompileScene(renderer, scene, camera, yieldBetween);
  }

  return { renderer, scene, camera, fog, resize, render, precompile };
}

/**
 * Link every program the first frame uses before that frame is drawn. With
 * KHR_parallel_shader_compile the driver links them off the main thread,
 * so the first render() no longer stalls on shader linking in one long task.
 *
 * Three passes, one per family of programs the first frame needs:
 * 1. the on-screen variants;
 * 2. the variants the transmission pass uses — it re-renders the opaque
 *    objects into an offscreen target, which switches every material to
 *    linear output without tone mapping (a separate program per material);
 * 3. the shadow-map depth variants (see `shadowDepthStandIn`).
 * An offscreen target only has to be bound while compile() reads it:
 * program keys depend on a target being set, not on which one.
 *
 * Linking alone is not the whole cost: the first uniform/attribute query
 * on a program (three's getUniforms()/getAttributes(), normally done
 * inside the first render) is a synchronous round trip that waits for the
 * GPU process, and for ~30 programs that added up to one long task. They
 * are issued here one program per task instead.
 *
 * Resolves to a release function: a program is freed as soon as no material
 * uses it, so the pass-3 stand-ins must live until the shadow pass's own
 * depth materials have picked the programs up in the first render.
 */
export async function precompileScene(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  yieldBetween: () => Promise<void>,
): Promise<() => void> {
  await renderer.compileAsync(scene, camera);

  const probe = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
  const standIns: THREE.Material[] = [];
  try {
    await compileOffscreen(renderer, probe, () => renderer.compileAsync(scene, camera));
    if (renderer.shadowMap.enabled) {
      await compileOffscreen(renderer, probe, () =>
        compileShadowDepth(renderer, scene, camera, standIns),
      );
    }
  } finally {
    probe.dispose();
  }
  for (const program of renderer.info.programs ?? []) {
    await yieldBetween();
    program.getUniforms();
    program.getAttributes();
  }
  return () => {
    for (const m of standIns) m.dispose();
  };
}

/** Run the synchronous part of a compileAsync call with `target` bound. */
function compileOffscreen(
  renderer: THREE.WebGLRenderer,
  target: THREE.WebGLRenderTarget,
  start: () => Promise<unknown>,
): Promise<unknown> {
  const previous = renderer.getRenderTarget();
  renderer.setRenderTarget(target);
  try {
    return start();
  } finally {
    renderer.setRenderTarget(previous);
  }
}

// WebGLShadowMap renders the opposite face for single-sided materials.
const SHADOW_SIDE: Record<THREE.Side, THREE.Side> = {
  [THREE.FrontSide]: THREE.BackSide,
  [THREE.BackSide]: THREE.FrontSide,
  [THREE.DoubleSide]: THREE.DoubleSide,
};

/**
 * A MeshDepthMaterial carrying the same program-relevant state that
 * WebGLShadowMap copies from `material` for a (non-VSM) directional-light
 * shadow pass, so compiling it links the very program the shadow pass
 * reuses (programs are shared by cache key across materials).
 */
function shadowDepthStandIn(material: THREE.Material): THREE.MeshDepthMaterial {
  const source = material as THREE.Material & {
    map?: THREE.Texture | null;
    alphaMap?: THREE.Texture | null;
    displacementMap?: THREE.Texture | null;
    displacementScale?: number;
    wireframe?: boolean;
  };
  const standIn = new THREE.MeshDepthMaterial();
  standIn.side = material.shadowSide ?? SHADOW_SIDE[material.side];
  standIn.alphaTest = material.alphaToCoverage ? 0.5 : material.alphaTest;
  standIn.map = source.map ?? null;
  standIn.alphaMap = source.alphaMap ?? null;
  standIn.displacementMap = source.displacementMap ?? null;
  standIn.displacementScale = source.displacementScale ?? 1;
  standIn.wireframe = source.wireframe ?? false;
  standIn.clippingPlanes = material.clippingPlanes;
  standIn.clipShadows = material.clipShadows;
  return standIn;
}

/**
 * Compile the depth programs of every visible shadow caster by briefly
 * swapping in stand-in depth materials on the real objects (so instancing
 * and other per-object program flags match), then restoring them. The
 * swap only lasts for compile()'s synchronous part. The stand-ins are
 * collected into `standIns` for the caller to dispose later.
 */
function compileShadowDepth(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  standIns: THREE.Material[],
): Promise<unknown> {
  const swapped: Array<{ mesh: THREE.Mesh; material: THREE.Mesh["material"] }> = [];
  const toStandIn = (m: THREE.Material): THREE.Material => {
    const standIn = shadowDepthStandIn(m);
    standIn.visible = m.visible;
    standIns.push(standIn);
    return standIn;
  };
  scene.traverseVisible((obj) => {
    if (!(obj instanceof THREE.Mesh) || !obj.castShadow) return;
    swapped.push({ mesh: obj, material: obj.material });
    obj.material = Array.isArray(obj.material)
      ? obj.material.map(toStandIn)
      : toStandIn(obj.material);
  });
  // The shadow pass draws without a scene (no fog), which is part of the
  // program key, so fog is lifted for the duration of the compile too.
  const fog = scene.fog;
  scene.fog = null;
  let pending: Promise<unknown>;
  try {
    pending = renderer.compileAsync(scene, camera);
  } finally {
    scene.fog = fog;
    for (const { mesh, material } of swapped) mesh.material = material;
  }
  return pending;
}
