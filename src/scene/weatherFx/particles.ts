import * as THREE from "three";

export interface ParticleSystem {
  points: THREE.Points;
  /** 0..1 — also drives visibility (hidden below a negligible threshold). */
  setIntensity(v: number): void;
  update(dtSec: number): void;
  dispose(): void;
}

export interface FallingParticleOptions {
  count: number;
  volumeRadiusM: number;
  volumeHeightM: number;
  /** Ground level — particles recycle back to the top once they fall below this. */
  baseY: number;
  fallSpeedM: readonly [min: number, max: number];
  /** Horizontal sway magnitude in m/s; 0 disables sway (plain rain). */
  swayAmplitudeM: number;
  swayFrequencyHz: number;
  sprite: THREE.CanvasTexture;
  sizeM: number;
  color: number;
  baseOpacity: number;
  /** Reduced motion: particles render as a static field, never animated. */
  reducedMotion: boolean;
}

/** A recycling cylindrical volume of falling sprites — the shared core of rain and snow. */
export function createFallingParticleSystem(opts: FallingParticleOptions): ParticleSystem {
  const { count } = opts;
  const positions = new Float32Array(count * 3);
  const speeds = new Float32Array(count);
  const swayPhase = new Float32Array(count);

  function resetParticle(i: number, initialY: boolean): void {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * opts.volumeRadiusM;
    positions[i * 3] = Math.cos(angle) * r;
    positions[i * 3 + 1] = initialY
      ? opts.baseY + Math.random() * opts.volumeHeightM
      : opts.baseY + opts.volumeHeightM;
    positions[i * 3 + 2] = Math.sin(angle) * r;
    speeds[i] = opts.fallSpeedM[0] + Math.random() * (opts.fallSpeedM[1] - opts.fallSpeedM[0]);
    swayPhase[i] = Math.random() * Math.PI * 2;
  }

  for (let i = 0; i < count; i++) resetParticle(i, true);

  const geometry = new THREE.BufferGeometry();
  const positionAttr = new THREE.BufferAttribute(positions, 3);
  geometry.setAttribute("position", positionAttr);

  const material = new THREE.PointsMaterial({
    size: opts.sizeM,
    map: opts.sprite,
    transparent: true,
    depthWrite: false,
    color: opts.color,
    opacity: 0,
    sizeAttenuation: true,
  });

  const points = new THREE.Points(geometry, material);
  points.visible = false;
  points.frustumCulled = false;

  let intensity = 0;
  let elapsedSec = 0;

  return {
    points,
    setIntensity(v: number): void {
      intensity = Math.min(1, Math.max(0, v));
      points.visible = intensity > 0.001;
      material.opacity = opts.baseOpacity * intensity;
    },
    update(dtSec: number): void {
      if (opts.reducedMotion || intensity <= 0.001) return;
      elapsedSec += dtSec;
      for (let i = 0; i < count; i++) {
        if (opts.swayAmplitudeM > 0) {
          positions[i * 3] +=
            Math.sin(elapsedSec * opts.swayFrequencyHz + swayPhase[i]) * opts.swayAmplitudeM * dtSec;
        }
        const nextY = positions[i * 3 + 1] - speeds[i] * dtSec;
        if (nextY < opts.baseY) {
          resetParticle(i, false);
        } else {
          positions[i * 3 + 1] = nextY;
        }
      }
      positionAttr.needsUpdate = true;
    },
    dispose(): void {
      geometry.dispose();
      material.dispose();
      opts.sprite.dispose();
    },
  };
}
