import * as THREE from "three";
import type { SurfacePixels } from "../../engine/geometry/surfaceTextures";

function createDataTexture(
  data: Uint8Array,
  surface: SurfacePixels,
  format: THREE.PixelFormat,
  colorSpace: THREE.ColorSpace,
  repeat: readonly [number, number],
  maxAnisotropy: number,
): THREE.DataTexture {
  const texture = new THREE.DataTexture(data, surface.width, surface.height, format);
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat[0], repeat[1]);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = maxAnisotropy;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;
  return texture;
}

export function surfaceMaps(
  surface: SurfacePixels,
  repeat: readonly [number, number],
  maxAnisotropy: number,
): { map: THREE.DataTexture; bumpMap: THREE.DataTexture } {
  return {
    map: createDataTexture(
      surface.albedo,
      surface,
      THREE.RGBAFormat,
      THREE.SRGBColorSpace,
      repeat,
      maxAnisotropy,
    ),
    bumpMap: createDataTexture(
      surface.bump,
      surface,
      THREE.RedFormat,
      THREE.NoColorSpace,
      repeat,
      maxAnisotropy,
    ),
  };
}
