import * as THREE from "three";
import {
  type BouquetOptions,
  type StemLayout,
  layoutBouquet,
} from "../../engine/geometry/flowerLayout";
import { type PetalGrid, petalGrid } from "../../engine/geometry/petalGrid";
import { phyllotaxis } from "../../engine/geometry/phyllotaxis";

const UP = new THREE.Vector3(0, 1, 0);

/** Indexed BufferGeometry from a petal grid, with a base→tip vertex-color gradient. */
export function gridToGeometry(grid: PetalGrid, baseHex: number, tipHex: number): THREE.BufferGeometry {
  const base = new THREE.Color(baseHex);
  const tip = new THREE.Color(tipHex);
  const scratch = new THREE.Color();

  const positions = new Float32Array(grid.positions.length * 3);
  const colors = new Float32Array(grid.positions.length * 3);
  for (let iu = 0; iu < grid.rows; iu++) {
    const t = grid.rowT[iu];
    const mix = t * t * (3 - 2 * t); // smoothstep — gradient concentrated mid-petal
    for (let iv = 0; iv < grid.cols; iv++) {
      const i = iu * grid.cols + iv;
      const [x, y, z] = grid.positions[i];
      positions.set([x, y, z], i * 3);
      scratch.copy(base).lerp(tip, mix);
      colors.set([scratch.r, scratch.g, scratch.b], i * 3);
    }
  }

  const index: number[] = [];
  for (let iu = 0; iu < grid.rows - 1; iu++) {
    for (let iv = 0; iv < grid.cols - 1; iv++) {
      const a = iu * grid.cols + iv;
      const b = a + 1;
      const c = a + grid.cols;
      const d = c + 1;
      index.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}

interface SharedAssets {
  petalGeometry: THREE.BufferGeometry;
  calyxGeometry: THREE.BufferGeometry;
  leafGeometry: THREE.BufferGeometry;
  floretGeometry: THREE.BufferGeometry;
  domeGeometry: THREE.BufferGeometry;
  backGeometry: THREE.BufferGeometry;
  stemMaterial: THREE.MeshStandardMaterial;
  petalMaterial: THREE.MeshStandardMaterial;
  calyxMaterial: THREE.MeshStandardMaterial;
  leafMaterial: THREE.MeshStandardMaterial;
  floretMaterial: THREE.MeshStandardMaterial;
  domeMaterial: THREE.MeshStandardMaterial;
  backMaterial: THREE.MeshStandardMaterial;
}

function createSharedAssets(): SharedAssets {
  return {
    // Unit-length (1m) surfaces, scaled per instance/leaf.
    petalGeometry: gridToGeometry(
      petalGrid({ lengthM: 1, widthM: 0.34, segmentsU: 10, segmentsV: 6, cupM: 0.06, bendM: 0.18 }),
      0xd0740f,
      0xffc830,
    ),
    calyxGeometry: gridToGeometry(
      petalGrid({ lengthM: 1, widthM: 0.44, segmentsU: 8, segmentsV: 4, cupM: 0.04, bendM: 0.4 }),
      0x2c4a1a,
      0x4c7a2b,
    ),
    leafGeometry: gridToGeometry(
      petalGrid({ lengthM: 1, widthM: 0.78, segmentsU: 10, segmentsV: 8, cupM: -0.09, bendM: 0.34 }),
      0x2c4a18,
      0x477026,
    ),
    floretGeometry: new THREE.SphereGeometry(1, 6, 5),
    // Squashed hemispheres: receptacle disc (front) and green back of the head.
    domeGeometry: new THREE.SphereGeometry(1, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    backGeometry: new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    stemMaterial: new THREE.MeshStandardMaterial({ color: 0x557a33, roughness: 0.8 }),
    petalMaterial: new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.6,
      side: THREE.DoubleSide,
    }),
    calyxMaterial: new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.75,
      side: THREE.DoubleSide,
    }),
    leafMaterial: new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.72,
      side: THREE.DoubleSide,
    }),
    floretMaterial: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }),
    domeMaterial: new THREE.MeshStandardMaterial({ color: 0x4a2c10, roughness: 0.95 }),
    backMaterial: new THREE.MeshStandardMaterial({ color: 0x36521e, roughness: 0.85 }),
  };
}

/** Instanced ring of petal-grid surfaces radiating from the head axis (+Y up = face). */
export function addRadialRing(
  head: THREE.Group,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  opts: {
    count: number;
    ringRadius: number;
    ringY: number;
    tiltDeg: number; // toward the face (+) or behind it (−)
    lengthM: number;
    angleOffsetRad: number;
    tint?: THREE.Color;
  },
): void {
  const mesh = new THREE.InstancedMesh(geometry, material, opts.count);
  mesh.castShadow = true;
  const matrix = new THREE.Matrix4();
  const dir = new THREE.Vector3();
  const side = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const tilt = (opts.tiltDeg * Math.PI) / 180;

  for (let k = 0; k < opts.count; k++) {
    const angle = (k / opts.count) * Math.PI * 2 + opts.angleOffsetRad;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    // Basis: local Y (petal length) → radial+tilt, local Z (cup normal) → face.
    dir.set(cosA * Math.cos(tilt), Math.sin(tilt), sinA * Math.cos(tilt));
    side.set(-sinA, 0, cosA);
    normal.crossVectors(side, dir);
    matrix.makeBasis(side, dir, normal);
    matrix.scale(new THREE.Vector3(opts.lengthM, opts.lengthM, opts.lengthM));
    matrix.setPosition(cosA * opts.ringRadius, opts.ringY, sinA * opts.ringRadius);
    mesh.setMatrixAt(k, matrix);
    if (opts.tint) mesh.setColorAt(k, opts.tint);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  head.add(mesh);
}

/** One sunflower head, built face-up (+Y) and oriented to the layout's head direction. */
function createHead(stem: StemLayout, assets: SharedAssets): THREE.Group {
  const head = new THREE.Group();
  head.position.set(...stem.headPosition);
  head.quaternion.setFromUnitVectors(UP, new THREE.Vector3(...stem.headDirection));

  const discR = stem.headRadiusM * 0.52;
  const petalLen = stem.headRadiusM * 0.58;

  const dome = new THREE.Mesh(assets.domeGeometry, assets.domeMaterial);
  dome.scale.set(discR, discR * 0.42, discR);
  dome.castShadow = true;
  head.add(dome);

  const back = new THREE.Mesh(assets.backGeometry, assets.backMaterial);
  back.scale.set(discR * 0.96, discR * 0.55, discR * 0.96);
  head.add(back);

  // Disc florets in a golden-angle spiral, darker at the center like a real
  // seed head (the outer florets are the ones in bloom).
  const floretPositions = phyllotaxis(170, discR * 0.94);
  const florets = new THREE.InstancedMesh(assets.floretGeometry, assets.floretMaterial, floretPositions.length);
  const matrix = new THREE.Matrix4();
  const color = new THREE.Color();
  const center = new THREE.Color(0x1d1108);
  const rim = new THREE.Color(0x8a5a20);
  floretPositions.forEach(([x, z], i) => {
    const rr = Math.min(1, Math.hypot(x, z) / discR);
    const domeY = discR * 0.42 * Math.sqrt(Math.max(0, 1 - rr * rr));
    const s = discR * (0.05 + 0.025 * rr); // florets grow slightly toward the rim
    matrix.makeScale(s, s * 0.8, s);
    matrix.setPosition(x, domeY + s * 0.3, z);
    florets.setMatrixAt(i, matrix);
    color.copy(center).lerp(rim, rr ** 1.4);
    florets.setColorAt(i, color);
  });
  florets.instanceMatrix.needsUpdate = true;
  if (florets.instanceColor) florets.instanceColor.needsUpdate = true;
  head.add(florets);

  // Two offset rings of ray petals — the inner ring lifts toward the face,
  // which is what gives a sunflower its depth when seen from the side.
  const tint = new THREE.Color().setHSL(0.108 + stem.colorSeed * 0.02, 1.0, 0.58);
  const innerTint = tint.clone().multiplyScalar(0.92);
  addRadialRing(head, assets.petalGeometry, assets.petalMaterial, {
    count: stem.petalCount,
    ringRadius: discR * 0.92,
    ringY: discR * 0.03,
    tiltDeg: 9,
    lengthM: petalLen,
    angleOffsetRad: 0,
    tint,
  });
  addRadialRing(head, assets.petalGeometry, assets.petalMaterial, {
    count: stem.petalCount,
    ringRadius: discR * 0.86,
    ringY: discR * 0.09,
    tiltDeg: 24,
    lengthM: petalLen * 0.88,
    angleOffsetRad: Math.PI / stem.petalCount,
    tint: innerTint,
  });

  // Two rows of calyx bracts behind the petals — the second, steeper row
  // wraps back over the green underside so the head's rear reads as layered
  // bracts instead of a bare smooth dome.
  addRadialRing(head, assets.calyxGeometry, assets.calyxMaterial, {
    count: 13,
    ringRadius: discR * 0.88,
    ringY: -discR * 0.06,
    tiltDeg: -14,
    lengthM: petalLen * 0.52,
    angleOffsetRad: 0.3,
  });
  addRadialRing(head, assets.calyxGeometry, assets.calyxMaterial, {
    count: 11,
    ringRadius: discR * 0.62,
    ringY: -discR * 0.22,
    tiltDeg: -38,
    lengthM: petalLen * 0.46,
    angleOffsetRad: 0.9,
  });

  return head;
}

function createLeaf(
  leaf: StemLayout["leaves"][number],
  curve: THREE.CatmullRomCurve3,
  assets: SharedAssets,
): THREE.Mesh {
  const mesh = new THREE.Mesh(assets.leafGeometry, assets.leafMaterial);
  mesh.castShadow = true;
  mesh.position.copy(curve.getPointAt(leaf.t));
  mesh.scale.setScalar(leaf.lengthM);

  const az = (leaf.azimuthDeg * Math.PI) / 180;
  const dir = new THREE.Vector3(Math.cos(az) * 0.8, -0.35, Math.sin(az) * 0.8).normalize();
  const side = new THREE.Vector3().crossVectors(UP, dir).normalize();
  const normal = new THREE.Vector3().crossVectors(side, dir);
  mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(side, dir, normal));
  return mesh;
}

interface SwayEntry {
  node: THREE.Group;
  phase: number;
  freqHz: number;
  amplitudeRad: number;
}

/**
 * Attach a breeze sway to per-stem groups: each stem tilts a fraction of a
 * degree around its base on its own slow phase. The caller drives it via
 * `group.userData.update(tSec)` from the frame loop — which never runs
 * under reduced motion, so the bouquet simply holds still there.
 */
export function attachBreeze(group: THREE.Group, stems: readonly THREE.Group[]): void {
  const entries: SwayEntry[] = stems.map((node, i) => ({
    node,
    phase: i * 2.1,
    freqHz: 0.22 + (i % 3) * 0.07,
    // Barely-there indoor air movement — at ~0.4° of tilt the flower heads
    // drift a millimeter or two, which reads as alive without drawing the eye.
    amplitudeRad: 0.006 + (i % 2) * 0.002,
  }));
  group.userData.update = (tSec: number): void => {
    for (const s of entries) {
      const w = tSec * s.freqHz * Math.PI * 2 + s.phase;
      s.node.rotation.z = Math.sin(w) * s.amplitudeRad;
      s.node.rotation.x = Math.sin(w * 0.63 + 1.4) * s.amplitudeRad * 0.7;
    }
  };
}

/** Procedural sunflower bouquet: thick stems, drooping leaves, phyllotaxis seed heads. */
export function createFlowersGroup(opts?: Partial<BouquetOptions>): THREE.Group {
  const stems = layoutBouquet(opts);
  const assets = createSharedAssets();
  const group = new THREE.Group();
  const stemGroups: THREE.Group[] = [];

  for (const stem of stems) {
    const stemGroup = new THREE.Group();
    const curve = new THREE.CatmullRomCurve3(
      stem.controlPoints.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    );
    const stemMesh = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 20, 0.0048, 8, false),
      assets.stemMaterial,
    );
    stemMesh.castShadow = true;
    stemGroup.add(stemMesh);

    for (const leaf of stem.leaves) {
      stemGroup.add(createLeaf(leaf, curve, assets));
    }

    stemGroup.add(createHead(stem, assets));
    group.add(stemGroup);
    stemGroups.push(stemGroup);
  }

  attachBreeze(group, stemGroups);
  return group;
}
