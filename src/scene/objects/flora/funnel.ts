import * as THREE from "three";
import { layoutBouquet } from "../../../engine/geometry/flowerLayout";
import { petalGrid } from "../../../engine/geometry/petalGrid";
import { mulberry32 } from "../../../engine/geometry/prng";
import {
  type BloomElement,
  MAX_DEBRIS_INSTANCES,
  addFloorDebris,
  attachBloomCycle,
  orientedPose,
  scaleBloom,
} from "../bloomRig";
import { attachBreeze, gridToGeometry } from "../flowers";

const UP = new THREE.Vector3(0, 1, 0);
const LEAF_BUD_FRAC = 0.4;
const FUNNEL_BUD_FRAC = 0.3;
const FUNNEL_SEGMENTS = 20;

interface FunnelStyle {
  /** Rim lobes: five for a morning glory, six for a gladiolus. */
  lobes: number;
  /** How far the rim bulges out at each lobe (0 = perfectly round). */
  lobeDepth: number;
  /** Pale rays running out along the lobe midribs (the morning glory's "曜"). */
  rays: boolean;
  throatHex: number;
  /** Funnel height × the layout's head radius. */
  sizeScale: number;
  /** Rim width relative to height (1 = the morning glory's wide saucer; less = a deeper cup). */
  flare: number;
  /** Flowers per stem: one at the tip, or a one-sided spike along the upper stem. */
  spike: { count: number; fromT: number } | null;
  leaf: { widthM: number; cupM: number; bendM: number; scale: number } | null;
  /** Upright sword blades from the vase floor (gladiolus) instead of stem leaves. */
  blades: boolean;
  stemRadiusM: number;
  stemHex: number;
  droopScale: number;
  freeLengthScale: number;
}

// One machine, two flowers: a morning glory is one wide five-lobed funnel
// with white rays at the end of a drooping vine with broad leaves; a
// gladiolus stacks six-lobed funnels up one side of a rigid spike between
// sword leaves.
const STYLES = {
  asagao: {
    lobes: 5,
    lobeDepth: 0.07,
    rays: true,
    throatHex: 0xfbf8f2,
    sizeScale: 0.62,
    flare: 1,
    spike: null,
    leaf: { widthM: 1.05, cupM: -0.05, bendM: 0.15, scale: 1.0 },
    blades: false,
    stemRadiusM: 0.0022,
    stemHex: 0x5a8a3a,
    droopScale: 1.3,
    freeLengthScale: 1.05,
  },
  gladiolus: {
    lobes: 6,
    lobeDepth: 0.05,
    rays: false,
    throatHex: 0xf6ecd2,
    sizeScale: 0.3,
    flare: 0.7,
    spike: { count: 8, fromT: 0.1 },
    leaf: null,
    blades: true,
    stemRadiusM: 0.0036,
    stemHex: 0x5f8a3c,
    droopScale: 0.08,
    freeLengthScale: 1.9,
  },
} satisfies Record<string, FunnelStyle>;

export interface FunnelOptions {
  /** Rim colors — one per stem, picked by the layout's color seed. */
  paletteHex: readonly number[];
  stemCount: number;
  seed: number;
  vaseRimYM: number;
  vaseNeckRadiusM: number;
  vaseBaseRadiusM: number;
}

// Funnel silhouette: a narrow tube that flares out into a shallow dish.
const PROFILE: ReadonlyArray<readonly [r: number, y: number]> = [
  [0.07, 0],
  [0.09, 0.3],
  [0.13, 0.52],
  [0.24, 0.68],
  [0.46, 0.8],
  [0.74, 0.88],
  [1.0, 0.92],
];

/**
 * A unit-height funnel opening along +Y, built as a surface of revolution
 * whose rim swells at each lobe, with the throat-to-rim color gradient and
 * the optional midrib rays baked into vertex colors (the rim color itself
 * comes from the mesh's instance/material tint).
 */
function createFunnelGeometry(style: FunnelStyle, rimHex: number): THREE.BufferGeometry {
  const throat = new THREE.Color(style.throatHex);
  const rim = new THREE.Color(rimHex);
  const ray = rim.clone().lerp(throat, 0.55);
  const scratch = new THREE.Color();
  const positions: number[] = [];
  const colors: number[] = [];
  const index: number[] = [];
  const rows = PROFILE.length;
  for (let i = 0; i < rows; i++) {
    const [baseR, y] = PROFILE[i];
    const t = i / (rows - 1);
    // Lobes only shape the flared part; the tube stays round.
    const flare = Math.max(0, (t - 0.45) / 0.55);
    for (let s = 0; s <= FUNNEL_SEGMENTS; s++) {
      const a = (s / FUNNEL_SEGMENTS) * Math.PI * 2;
      const lobe = Math.cos(a * style.lobes);
      const r = baseR * style.flare * (1 + style.lobeDepth * lobe * flare * flare);
      positions.push(Math.cos(a) * r, y, Math.sin(a) * r);
      const mix = THREE.MathUtils.smoothstep(t, 0.4, 0.8);
      scratch.copy(throat).lerp(rim, mix);
      if (style.rays && lobe > 0.72 && t > 0.5) scratch.lerp(ray, (lobe - 0.72) / 0.28);
      colors.push(scratch.r, scratch.g, scratch.b);
    }
  }
  const cols = FUNNEL_SEGMENTS + 1;
  for (let i = 0; i < rows - 1; i++) {
    for (let s = 0; s < FUNNEL_SEGMENTS; s++) {
      const a = i * cols + s;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      index.push(a, b, c, b, d, c);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}

/** A still-furled bud: a slim twisted cone in the rim color. */
function createBudGeometry(): THREE.ConeGeometry {
  const geometry = new THREE.ConeGeometry(0.16, 1, 5);
  geometry.translate(0, 0.5, 0);
  return geometry;
}

function createGroup(opts: FunnelOptions, style: FunnelStyle): THREE.Group {
  const stems = layoutBouquet({
    ...opts,
    droopScale: style.droopScale,
    freeLengthScale: style.freeLengthScale,
  });
  const group = new THREE.Group();
  const stemGroups: THREE.Group[] = [];
  const rand = mulberry32(opts.seed + 601);
  const bloomElements: BloomElement[] = [];

  const stemMaterial = new THREE.MeshStandardMaterial({ color: style.stemHex, roughness: 0.75 });
  const funnelMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.5,
    side: THREE.DoubleSide,
  });
  const funnelGeometries = new Map<number, THREE.BufferGeometry>();
  const funnelFor = (hex: number): THREE.BufferGeometry => {
    let g = funnelGeometries.get(hex);
    if (!g) {
      g = createFunnelGeometry(style, hex);
      funnelGeometries.set(hex, g);
    }
    return g;
  };
  const budGeometry = createBudGeometry();
  const leafGeometry = style.leaf
    ? gridToGeometry(
        petalGrid({ lengthM: 1, segmentsU: 6, segmentsV: 5, widthM: style.leaf.widthM, cupM: style.leaf.cupM, bendM: style.leaf.bendM }),
        0x3f6b2a,
        0x6aa23c,
      )
    : null;
  const bladeGeometry = style.blades
    ? gridToGeometry(
        petalGrid({ lengthM: 1, widthM: 0.08, segmentsU: 8, segmentsV: 2, cupM: 0.012, bendM: 0.12 }),
        0x3f6b2e,
        0x6a9a48,
      )
    : null;
  const leafMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.66,
    side: THREE.DoubleSide,
  });

  for (const stem of stems) {
    const stemGroup = new THREE.Group();
    const curve = new THREE.CatmullRomCurve3(
      stem.controlPoints.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    );
    const stemMesh = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 20, style.stemRadiusM, 7, false),
      stemMaterial,
    );
    stemMesh.castShadow = true;
    stemGroup.add(stemMesh);

    const rimHex = opts.paletteHex[Math.floor(stem.colorSeed * opts.paletteHex.length)] ?? 0x4a5fc1;
    const budMaterial = new THREE.MeshStandardMaterial({ color: rimHex, roughness: 0.6 });
    const size = stem.headRadiusM * style.sizeScale;

    if (leafGeometry && style.leaf) {
      for (const leaf of stem.leaves) {
        const mesh = new THREE.Mesh(leafGeometry, leafMaterial);
        mesh.castShadow = true;
        mesh.position.copy(curve.getPointAt(leaf.t));
        mesh.scale.setScalar(leaf.lengthM * style.leaf.scale);
        const az = (leaf.azimuthDeg * Math.PI) / 180;
        const dir = new THREE.Vector3(Math.cos(az) * 0.8, -0.3, Math.sin(az) * 0.8).normalize();
        const side = new THREE.Vector3().crossVectors(UP, dir).normalize();
        const normal = new THREE.Vector3().crossVectors(side, dir);
        mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(side, dir, normal));
        stemGroup.add(mesh);
        const openScale = mesh.scale.clone();
        bloomElements.push(
          scaleBloom(mesh, openScale.clone().multiplyScalar(LEAF_BUD_FRAC), openScale, rand()),
        );
      }
    }

    if (bladeGeometry) {
      // Sword leaves: straight blades from the vase floor, through the
      // opening, leaning gently outward above the rim (as on an iris).
      const [foot, rim] = stem.controlPoints;
      const tip = curve.getPointAt(1);
      const az = Math.atan2(rim[2], rim[0]);
      for (let b = 0; b < 2; b++) {
        const spin = az + (rand() - 0.5) * 1.2;
        const base = new THREE.Vector3(foot[0] * 0.5, foot[1] + 0.004, foot[2] * 0.5);
        const through = new THREE.Vector3(
          Math.cos(spin) * opts.vaseNeckRadiusM * 0.45,
          rim[1],
          Math.sin(spin) * opts.vaseNeckRadiusM * 0.45,
        );
        const dir = through.clone().sub(base).normalize();
        const aboveRim = (tip.y - rim[1]) * (0.35 + rand() * 0.3);
        const length = through.distanceTo(base) + Math.max(0.1, aboveRim) / Math.max(0.4, dir.y);
        const outward = new THREE.Vector3(-Math.cos(spin), 0, -Math.sin(spin));
        const pose = orientedPose(base, dir, outward, new THREE.Vector3(0.14, length, length * 0.6));
        const blade = new THREE.Mesh(bladeGeometry, leafMaterial);
        blade.castShadow = true;
        blade.position.copy(pose.position);
        blade.quaternion.copy(pose.quaternion);
        blade.scale.copy(pose.scale);
        stemGroup.add(blade);
        bloomElements.push(scaleBloom(blade, pose.scale, pose.scale, rand()));
      }
    }

    const placeFunnel = (position: THREE.Vector3, facing: THREE.Vector3, scale: number, shedAt: number): void => {
      const funnel = new THREE.Mesh(funnelFor(rimHex), funnelMaterial);
      funnel.castShadow = true;
      funnel.position.copy(position);
      funnel.quaternion.setFromUnitVectors(UP, facing);
      stemGroup.add(funnel);
      bloomElements.push(scaleBloom(funnel, scale * FUNNEL_BUD_FRAC, scale, shedAt));
    };

    if (style.spike) {
      // A one-sided spike: funnels every so far along the stem above the
      // rim, all facing the lean side, shrinking toward the tip where the
      // last are still buds. The curve starts at the vase floor, so the
      // spike's start is measured from where the stem clears the rim.
      const [dx, , dz] = stem.headDirection;
      const outward = new THREE.Vector3(dx, 0, dz).normalize();
      const tangent = curve.getTangentAt(0.9);
      const lateral = new THREE.Vector3().crossVectors(UP, outward).normalize();
      const [foot, rim] = stem.controlPoints;
      const rimU = Math.hypot(rim[0] - foot[0], rim[1] - foot[1], rim[2] - foot[2]) / curve.getLength();
      const fromT = rimU + (1 - rimU) * style.spike.fromT;
      for (let k = 0; k < style.spike.count; k++) {
        const frac = k / (style.spike.count - 1);
        const t = fromT + (1 - fromT) * frac;
        const at = curve.getPointAt(t);
        const sideSign = k % 2 === 0 ? 1 : -1;
        const facing = outward
          .clone()
          .addScaledVector(lateral, sideSign * 0.5)
          .addScaledVector(tangent, 0.6)
          .normalize();
        const scale = size * (1 - 0.25 * frac);
        if (frac > 0.8) {
          const bud = new THREE.Mesh(budGeometry, budMaterial);
          bud.position.copy(at).addScaledVector(facing, scale * 0.1);
          bud.quaternion.setFromUnitVectors(UP, facing.clone().addScaledVector(tangent, 1.2).normalize());
          stemGroup.add(bud);
          bloomElements.push(scaleBloom(bud, scale * 0.5 * 0.4, scale * 0.5));
        } else {
          placeFunnel(at.clone().addScaledVector(facing, scale * 0.12), facing, scale, 0.35 + rand() * 0.65);
        }
      }
    } else {
      const facing = new THREE.Vector3(...stem.headDirection);
      // The open flower sits a little forward of the vine tip; the funnel's
      // own base is its origin, so pull it back by the tube length.
      placeFunnel(
        new THREE.Vector3(...stem.headPosition).addScaledVector(facing, -size * 0.3),
        facing,
        size,
        0.3 + rand() * 0.7,
      );
      // A furled bud beside it, pointing up and out.
      const bud = new THREE.Mesh(budGeometry, budMaterial);
      const budAt = curve.getPointAt(0.86);
      const budDir = facing.clone().multiplyScalar(0.6).addScaledVector(UP, 1).normalize();
      bud.position.copy(budAt);
      bud.quaternion.setFromUnitVectors(UP, budDir);
      stemGroup.add(bud);
      bloomElements.push(scaleBloom(bud, size * 0.55 * 0.4, size * 0.55));
    }

    group.add(stemGroup);
    stemGroups.push(stemGroup);
  }

  const avgHeadRadiusM = stems.reduce((sum, s) => sum + s.headRadiusM, 0) / stems.length;
  // Spent flowers twist shut and drop as slim tubes in their rim color — the
  // furled-bud cone is exactly that shape.
  bloomElements.push(
    addFloorDebris(group, {
      geometry: budGeometry,
      material: new THREE.MeshStandardMaterial({ color: opts.paletteHex[0] ?? 0x4a5fc1, roughness: 0.6 }),
      count: Math.min(MAX_DEBRIS_INSTANCES, stems.length * (style.spike ? 4 : 2)),
      sizeM: avgHeadRadiusM * style.sizeScale * 0.7,
      radiusM: { min: opts.vaseBaseRadiusM * 1.15, max: opts.vaseBaseRadiusM * 2.4 },
      rand,
    }),
  );
  if (leafGeometry) {
    bloomElements.push(
      addFloorDebris(group, {
        geometry: leafGeometry,
        material: leafMaterial,
        count: Math.min(MAX_DEBRIS_INSTANCES, stems.length * 4),
        sizeM: 0.06,
        radiusM: { min: opts.vaseBaseRadiusM * 1.15, max: opts.vaseBaseRadiusM * 2.4 },
        rand,
      }),
    );
  }

  attachBreeze(group, stemGroups);
  attachBloomCycle(group, bloomElements);
  return group;
}

export const createAsagaoGroup = (o: FunnelOptions): THREE.Group => createGroup(o, STYLES.asagao);
export const createGladiolusGroup = (o: FunnelOptions): THREE.Group =>
  createGroup(o, STYLES.gladiolus);
