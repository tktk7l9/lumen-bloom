import { createFallingParticleSystem, type ParticleSystem } from "./particles";
import { createStreakSprite } from "./sprite";

export function createRainSystem(reducedMotion: boolean, count = 260): ParticleSystem {
  return createFallingParticleSystem({
    count,
    volumeRadiusM: 1.0,
    volumeHeightM: 1.1,
    baseY: 0,
    fallSpeedM: [1.6, 2.4],
    swayAmplitudeM: 0,
    swayFrequencyHz: 0,
    sprite: createStreakSprite(),
    sizeM: 0.05,
    color: 0xaecbe8,
    baseOpacity: 0.55,
    reducedMotion,
  });
}
