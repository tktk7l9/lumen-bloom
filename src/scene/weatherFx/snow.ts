import { createFallingParticleSystem, type ParticleSystem } from "./particles";
import { createDotSprite } from "./sprite";

export function createSnowSystem(reducedMotion: boolean, count = 180): ParticleSystem {
  return createFallingParticleSystem({
    count,
    volumeRadiusM: 1.0,
    volumeHeightM: 1.1,
    baseY: 0,
    fallSpeedM: [0.12, 0.22],
    swayAmplitudeM: 0.05,
    swayFrequencyHz: 0.6,
    sprite: createDotSprite(),
    sizeM: 0.02,
    color: 0xffffff,
    baseOpacity: 0.85,
    reducedMotion,
  });
}
