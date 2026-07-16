import * as THREE from "three";
import type { BloomStage } from "../../engine/bloomCycle";

/** A pose an InstancedMesh instance can be lerped toward/from by openness. */
export interface InstancePose {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  /** Non-uniform scale is common (e.g. a bud swelling more along its length axis). */
  scale: THREE.Vector3;
}

/** Something that reacts to the week's current bloom/shed stage. */
export interface BloomElement {
  applyStage(stage: BloomStage): void;
}

/** Species-agnostic cap on how many floor-debris instances any one arrangement spawns. */
export const MAX_DEBRIS_INSTANCES = 80;

const scratchMatrix = new THREE.Matrix4();
const scratchPosition = new THREE.Vector3();
const scratchQuaternion = new THREE.Quaternion();
const scratchScale = new THREE.Vector3();

/**
 * Shared core for every InstancedMesh-based bloom/shed effect: each instance
 * lerps bud→open by `stage.openness`, and is hidden (zero-scale) once its
 * own seeded shed threshold has been passed by `stage.shedProgress` — order
 * is per-instance/random, not index-truncated, since real shedding doesn't
 * happen in ring order. Pass `openPoses` again as `budPoses` for elements
 * that don't animate open (shed-only), and an all-above-1 `shedAt` for
 * elements that never shed (open-only). Defaults to a fully open, unshed
 * look immediately, so a species still renders correctly even before its
 * first `applyStage` call from the bloom-cycle driver.
 */
export function addAnimatedInstances(
  mesh: THREE.InstancedMesh,
  openPoses: readonly InstancePose[],
  budPoses: readonly InstancePose[],
  shedAt: ArrayLike<number>,
): BloomElement {
  const handle: BloomElement = {
    applyStage(stage: BloomStage): void {
      for (let i = 0; i < openPoses.length; i++) {
        if (shedAt[i] <= stage.shedProgress) {
          scratchMatrix.makeScale(0, 0, 0);
        } else {
          scratchPosition.lerpVectors(budPoses[i].position, openPoses[i].position, stage.openness);
          scratchQuaternion.slerpQuaternions(
            budPoses[i].quaternion,
            openPoses[i].quaternion,
            stage.openness,
          );
          scratchScale.lerpVectors(budPoses[i].scale, openPoses[i].scale, stage.openness);
          scratchMatrix.compose(scratchPosition, scratchQuaternion, scratchScale);
        }
        mesh.setMatrixAt(i, scratchMatrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
  handle.applyStage({ openness: 1, shedProgress: 0 });
  return handle;
}

const DEFAULT_BUD_RADIUS_FRAC = 0.22;
const DEFAULT_BUD_LENGTH_FRAC = 0.4;
const DEFAULT_BUD_TILT_DEG = 86;

function ringPose(
  k: number,
  count: number,
  ringRadius: number,
  ringY: number,
  tiltDeg: number,
  lengthM: number,
  angleOffsetRad: number,
): InstancePose {
  // Mirrors addRadialRing's own basis math (flowers.ts) exactly, just
  // packaged as a pose instead of an immediately-applied matrix.
  const angle = (k / count) * Math.PI * 2 + angleOffsetRad;
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  const tilt = (tiltDeg * Math.PI) / 180;
  const dir = new THREE.Vector3(cosA * Math.cos(tilt), Math.sin(tilt), sinA * Math.cos(tilt));
  const side = new THREE.Vector3(-sinA, 0, cosA);
  const normal = new THREE.Vector3().crossVectors(side, dir);
  const basis = new THREE.Matrix4().makeBasis(side, dir, normal);
  return {
    position: new THREE.Vector3(cosA * ringRadius, ringY, sinA * ringRadius),
    quaternion: new THREE.Quaternion().setFromRotationMatrix(basis),
    scale: new THREE.Vector3(lengthM, lengthM, lengthM),
  };
}

export interface AnimatedRadialRingOptions {
  count: number;
  ringRadius: number;
  ringY: number;
  tiltDeg: number; // toward the face (+) or behind it (−)
  lengthM: number;
  angleOffsetRad: number;
  tint?: THREE.Color;
  /** Seeded RNG driving this ring's per-petal shed order — same seed → same look every reload. */
  rand: () => number;
  /** Fraction of ringRadius the bud pose sits at (default 0.22 — pulled in near the axis). */
  budRadiusFrac?: number;
  /** Fraction of lengthM the bud pose is scaled to (default 0.4). */
  budLengthFrac?: number;
  /** Tilt of the folded bud pose in degrees (default 86 — nearly upright). */
  budTiltDeg?: number;
}

/**
 * Drop-in replacement for `addRadialRing` (flowers.ts) that returns a
 * `BloomElement` instead of void, so the ring can bud open and shed over
 * the week instead of being built once and left static.
 */
export function addAnimatedRadialRing(
  head: THREE.Group,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  opts: AnimatedRadialRingOptions,
): BloomElement {
  const mesh = new THREE.InstancedMesh(geometry, material, opts.count);
  mesh.castShadow = true;

  const budRadiusFrac = opts.budRadiusFrac ?? DEFAULT_BUD_RADIUS_FRAC;
  const budLengthFrac = opts.budLengthFrac ?? DEFAULT_BUD_LENGTH_FRAC;
  const budTiltDeg = opts.budTiltDeg ?? DEFAULT_BUD_TILT_DEG;

  const openPoses: InstancePose[] = [];
  const budPoses: InstancePose[] = [];
  const shedAt = new Float32Array(opts.count);
  for (let k = 0; k < opts.count; k++) {
    openPoses.push(
      ringPose(k, opts.count, opts.ringRadius, opts.ringY, opts.tiltDeg, opts.lengthM, opts.angleOffsetRad),
    );
    budPoses.push(
      ringPose(
        k,
        opts.count,
        opts.ringRadius * budRadiusFrac,
        opts.ringY,
        budTiltDeg,
        opts.lengthM * budLengthFrac,
        opts.angleOffsetRad,
      ),
    );
    shedAt[k] = opts.rand();
    if (opts.tint) mesh.setColorAt(k, opts.tint);
  }
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  head.add(mesh);
  return addAnimatedInstances(mesh, openPoses, budPoses, shedAt);
}

/**
 * For single, non-instanced meshes (calla's spathe/spadix, narcissus's
 * trumpet, tulip's pistil, a stem leaf) that grow between two sizes.
 * Pass `shedThreshold` (0..1) to also make it fall once `shedProgress`
 * reaches it — a stem leaf hides that way (leaves aren't instanced, so
 * there's no matrix to zero out; toggling `visible` is the equivalent).
 * Omit it for elements that never shed (calla/trumpet/pistil), unchanged.
 */
export function scaleBloom(
  mesh: THREE.Object3D,
  budScale: THREE.Vector3 | number,
  openScale: THREE.Vector3 | number,
  shedThreshold?: number,
): BloomElement {
  const bud = typeof budScale === "number" ? new THREE.Vector3(budScale, budScale, budScale) : budScale;
  const open =
    typeof openScale === "number" ? new THREE.Vector3(openScale, openScale, openScale) : openScale;
  const handle: BloomElement = {
    applyStage(stage: BloomStage): void {
      if (shedThreshold !== undefined && stage.shedProgress >= shedThreshold) {
        mesh.visible = false;
        return;
      }
      mesh.visible = true;
      mesh.scale.lerpVectors(bud, open, stage.openness);
    },
  };
  handle.applyStage({ openness: 1, shedProgress: 0 });
  return handle;
}

export interface FloorDebrisOptions {
  /** Reuse the species' own already-built petal/leaf/bud geometry & material — no new assets. */
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  count: number;
  sizeM: number;
  radiusM: { min: number; max: number };
  /** Resting height in the flora group's local space (default: just above the floor). */
  centerY?: number;
  rand: () => number;
  /**
   * Species whose base geometry gradient is neutral (the real color comes
   * from a per-instance tint on the plant, e.g. every `addRadialRing`-based
   * ring) need that same tint reapplied here, or fallen debris renders
   * gray/white instead of the flower's actual color.
   */
  tint?: THREE.Color;
}

const DEFAULT_DEBRIS_Y = 0.0008;

/**
 * Fallen debris scattered flat on the floor near the vase, revealed by
 * growing `InstancedMesh.count` as `shedProgress` rises — placement is
 * computed once at construction (deterministic per the arrangement's own
 * seed), so no per-frame matrix work is needed, only a cheap count bump.
 * Debris accumulates and stays (monotonic in shedProgress) rather than
 * resetting until the arrangement itself rotates out.
 */
export function addFloorDebris(parent: THREE.Group, opts: FloorDebrisOptions): BloomElement {
  const mesh = new THREE.InstancedMesh(opts.geometry, opts.material, opts.count);
  mesh.castShadow = false; // flat objects resting on the floor casting shadows onto it read as nothing
  mesh.receiveShadow = true;

  const matrix = new THREE.Matrix4();
  const dir = new THREE.Vector3();
  const side = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const color = new THREE.Color();
  const centerY = opts.centerY ?? DEFAULT_DEBRIS_Y;

  for (let i = 0; i < opts.count; i++) {
    // Petal-grid local Y is the length axis, Z is the cup/face normal — lying
    // flat means Y sweeps the horizontal plane and Z points close to +Y (up).
    const lengthAngle = opts.rand() * Math.PI * 2;
    dir.set(Math.cos(lengthAngle), 0, Math.sin(lengthAngle));
    normal.set((opts.rand() - 0.5) * 0.3, 1, (opts.rand() - 0.5) * 0.3).normalize();
    side.crossVectors(normal, dir).normalize();
    normal.crossVectors(side, dir);
    matrix.makeBasis(side, dir, normal);
    const s = opts.sizeM * (0.85 + opts.rand() * 0.3);
    matrix.scale(new THREE.Vector3(s, s, s));
    const placeAngle = opts.rand() * Math.PI * 2;
    const radius = opts.radiusM.min + opts.rand() * (opts.radiusM.max - opts.radiusM.min);
    matrix.setPosition(Math.cos(placeAngle) * radius, centerY, Math.sin(placeAngle) * radius);
    mesh.setMatrixAt(i, matrix);
    if (opts.tint) {
      color.copy(opts.tint).offsetHSL(0, 0, (opts.rand() - 0.5) * 0.08);
      mesh.setColorAt(i, color);
    }
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.count = 0;
  parent.add(mesh);

  return {
    applyStage(stage: BloomStage): void {
      mesh.count = Math.round(opts.count * stage.shedProgress);
    },
  };
}

/** Mirrors attachBreeze's shape (flowers.ts) on an independent userData key, so it never collides. */
export function attachBloomCycle(group: THREE.Group, elements: readonly BloomElement[]): void {
  group.userData.setBloomStage = (stage: BloomStage): void => {
    for (const el of elements) el.applyStage(stage);
  };
}
