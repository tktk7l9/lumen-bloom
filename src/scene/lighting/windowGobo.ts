import * as THREE from "three";

// A "gobo" plane that rides between the sun and the scene, shaped like a
// window: opaque everywhere except a paned opening. Sunlight therefore
// arrives as a window-shaped patch with muntin-bar shadows — the thing that
// makes the room corner read as an actual room. The plane is invisible to
// the camera (no color/depth writes) but still renders into the shadow map,
// where the depth material honors alphaMap+alphaTest.

const PLANE_SIZE_M = 5;
const CANVAS_PX = 512;

function createWindowAlphaMap(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_PX;
  canvas.height = CANVAS_PX;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");

  const pxPerM = CANVAS_PX / PLANE_SIZE_M;

  // Opaque (white = alpha 1 = casts shadow) everywhere…
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, CANVAS_PX, CANVAS_PX);

  // …except the window opening (black = light passes).
  const openingW = 1.7 * pxPerM;
  const openingH = 2.1 * pxPerM;
  const x0 = (CANVAS_PX - openingW) / 2;
  const y0 = (CANVAS_PX - openingH) / 2;
  ctx.fillStyle = "#000";
  ctx.fillRect(x0, y0, openingW, openingH);

  // Muntin bars: 2×3 panes.
  ctx.fillStyle = "#fff";
  const barPx = 0.07 * pxPerM;
  for (let i = 1; i < 2; i++) {
    ctx.fillRect(x0 + (openingW / 2) * i - barPx / 2, y0, barPx, openingH);
  }
  for (let j = 1; j < 3; j++) {
    ctx.fillRect(x0, y0 + (openingH / 3) * j - barPx / 2, openingW, barPx);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export function createWindowGobo(): THREE.Mesh {
  const material = new THREE.MeshStandardMaterial({
    alphaMap: createWindowAlphaMap(),
    alphaTest: 0.5,
    colorWrite: false,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const gobo = new THREE.Mesh(new THREE.PlaneGeometry(PLANE_SIZE_M, PLANE_SIZE_M), material);
  gobo.castShadow = true;
  return gobo;
}
