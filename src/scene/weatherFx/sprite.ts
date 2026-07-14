import * as THREE from "three";

// Fully procedural canvas sprites — no external image, so the CSP's
// img-src 'self' never needs relaxing for weather particles.

/** Soft round sprite for snow. */
export function createDotSprite(size = 32): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");

  const r = size / 2;
  const gradient = ctx.createRadialGradient(r, r, 0, r, r, r);
  gradient.addColorStop(0, "rgba(255,255,255,0.95)");
  gradient.addColorStop(0.6, "rgba(255,255,255,0.4)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/** Soft vertical streak sprite for rain. */
export function createStreakSprite(width = 16, height = 64): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");

  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "rgba(255,255,255,0)");
  gradient.addColorStop(0.5, "rgba(255,255,255,0.55)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;

  const cx = width / 2;
  ctx.beginPath();
  ctx.moveTo(cx - width * 0.12, 0);
  ctx.lineTo(cx + width * 0.12, 0);
  ctx.lineTo(cx + width * 0.04, height);
  ctx.lineTo(cx - width * 0.04, height);
  ctx.closePath();
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}
