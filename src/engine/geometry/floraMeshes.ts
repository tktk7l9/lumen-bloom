// Small closed shapes for flower parts the petal grid cannot express — a
// star-shaped hyacinth floret, a lobed chrysanthemum leaf, a twisted
// gardenia bud — as plain triangle meshes. Like petalGrid, this is only
// the shape math; the scene layer turns it into BufferGeometry, mapping
// `shades` to vertex colors so an instance color can supply the hue.

import type { Point3 } from "./flowerLayout";

export interface MeshData {
  positions: Point3[];
  /** Triangles, three vertex indices each, wound so the face normals point to the outside. */
  indices: number[];
  /** Per-vertex brightness, 0..1 (darker throats, bases and midlines). */
  shades: number[];
}

type Vec = readonly [number, number, number];

const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vec, b: Vec): Vec => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a: Vec, b: Vec): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Unit face normal of triangle (a, b, c) under counter-clockwise winding. */
export function faceNormal(a: Vec, b: Vec, c: Vec): Point3 {
  const n = cross(sub(b, a), sub(c, a));
  const len = Math.hypot(n[0], n[1], n[2]);
  return [n[0] / len, n[1] / len, n[2] / len];
}

/** Push triangle (a, b, c), flipping its winding if needed so its normal points along `outside`. */
function addTriangle(mesh: MeshData, a: number, b: number, c: number, outside: Vec): void {
  const p = mesh.positions;
  const n = cross(sub(p[b], p[a]), sub(p[c], p[a]));
  if (dot(n, outside) >= 0) mesh.indices.push(a, b, c);
  else mesh.indices.push(a, c, b);
}

function centroid(mesh: MeshData, a: number, b: number, c: number): Vec {
  const p = mesh.positions;
  return [(p[a][0] + p[b][0] + p[c][0]) / 3, (p[a][1] + p[b][1] + p[c][1]) / 3, (p[a][2] + p[b][2] + p[c][2]) / 3];
}

// Hyacinth floret proportions (unit floret, opening along +Y).
const TUBE_BASE_R = 0.09;
const THROAT_R = 0.2;
const THROAT_Y = 0.42;

/**
 * A hyacinth floret opening along +Y: a short flared tube whose rim splits
 * into `lobes` pointed tepals that spread out and curl back below their
 * own midpoint. Shades darken into the throat and along each tepal's
 * midline, as on the real flower.
 */
export function starFloret(lobes = 6): MeshData {
  const L = Math.max(3, Math.floor(lobes));
  const mesh: MeshData = { positions: [], indices: [], shades: [] };
  const vertex = (p: Point3, shade: number): number => {
    mesh.positions.push(p);
    mesh.shades.push(shade);
    return mesh.positions.length - 1;
  };
  const step = Math.PI / L;
  // Tube base (between lobe centers) and throat (lobe centers and the gaps between).
  const base = Array.from({ length: L }, (_, j) => {
    const a = (2 * j + 1) * step;
    return vertex([Math.cos(a) * TUBE_BASE_R, 0, Math.sin(a) * TUBE_BASE_R], 0.5);
  });
  const throat = Array.from({ length: 2 * L }, (_, m) => {
    const a = m * step;
    return vertex([Math.cos(a) * THROAT_R, THROAT_Y, Math.sin(a) * THROAT_R], 0.78);
  });
  // The outside of the floret faces away from the axis and down.
  const outsideAt = (a: number, b: number, c: number): Vec => {
    const [x, , z] = centroid(mesh, a, b, c);
    const r = Math.hypot(x, z);
    return [x / r, -1, z / r];
  };
  const tri = (a: number, b: number, c: number): void => addTriangle(mesh, a, b, c, outsideAt(a, b, c));

  for (let j = 0; j < L; j++) {
    const a0 = base[j];
    const a1 = base[(j + 1) % L];
    const c1 = throat[2 * j + 1];
    const c2 = throat[(2 * j + 2) % (2 * L)];
    const c3 = throat[(2 * j + 3) % (2 * L)];
    tri(a0, c2, c1);
    tri(a0, a1, c2);
    tri(a1, c3, c2);
  }

  for (let k = 0; k < L; k++) {
    const a = 2 * k * step;
    const radial = (r: number, across: number, y: number): Point3 => [
      Math.cos(a) * r - Math.sin(a) * across,
      y,
      Math.sin(a) * r + Math.cos(a) * across,
    ];
    const bl = throat[(2 * k - 1 + 2 * L) % (2 * L)];
    const bc = throat[2 * k];
    const br = throat[2 * k + 1];
    // Mid row: spread out and still rising, the midline cupped up; tip: curled back down.
    const ml = vertex(radial(0.4, -0.13, 0.55), 0.97);
    const mc = vertex(radial(0.42, 0, 0.6), 0.88);
    const mr = vertex(radial(0.4, 0.13, 0.55), 0.97);
    const tip = vertex(radial(0.6, 0, 0.47), 1);
    tri(bl, bc, mc);
    tri(bl, mc, ml);
    tri(bc, br, mr);
    tri(bc, mr, mc);
    tri(ml, mc, tip);
    tri(mc, mr, tip);
  }
  return mesh;
}

// Right half of a chrysanthemum leaf, base to tip: petiole, three pairs of
// rounded lobes with sinuses between them, and a terminal lobe.
const LEAF_OUTLINE: ReadonlyArray<readonly [x: number, y: number]> = [
  [0.025, 0],
  [0.05, 0.1],
  [0.22, 0.2],
  [0.16, 0.29],
  [0.3, 0.42],
  [0.2, 0.53],
  [0.27, 0.66],
  [0.15, 0.76],
  [0.17, 0.88],
];
const LEAF_MIDRIB_LIFT = 0.035;
const LEAF_TIP_BEND = 0.12;

/**
 * A pinnately lobed chrysanthemum leaf along +Y (length 1), in the same
 * convention as petalGrid: the midrib is lifted toward +Z and the tip bends
 * back toward −Z, so it orients like any other leaf. The pale midrib and
 * darker petiole are in the shades.
 */
export function lobedLeaf(): MeshData {
  const mesh: MeshData = { positions: [], indices: [], shades: [] };
  const vertex = (x: number, y: number, z: number, shade: number): number => {
    mesh.positions.push([x, y, z]);
    mesh.shades.push(shade);
    return mesh.positions.length - 1;
  };
  const bend = (y: number): number => -LEAF_TIP_BEND * y * y;
  const midrib = LEAF_OUTLINE.map(([, y]) => vertex(0, y, LEAF_MIDRIB_LIFT * Math.sin(Math.PI * y) + bend(y), y === 0 ? 0.7 : 1));
  const tip = vertex(0, 1, bend(1), 0.95);
  const right = LEAF_OUTLINE.map(([x, y]) => vertex(x, y, bend(y), y === 0 ? 0.65 : 0.82));
  const left = LEAF_OUTLINE.map(([x, y]) => vertex(-x, y, bend(y), y === 0 ? 0.65 : 0.82));
  const up: Vec = [0, 0, 1];
  for (const side of [right, left]) {
    for (let i = 0; i < LEAF_OUTLINE.length - 1; i++) {
      addTriangle(mesh, midrib[i], side[i], side[i + 1], up);
      addTriangle(mesh, midrib[i], side[i + 1], midrib[i + 1], up);
    }
    addTriangle(mesh, midrib[midrib.length - 1], side[side.length - 1], tip, up);
  }
  return mesh;
}

// Gardenia bud: a spindle that swells low and tapers to a sharp point.
const BUD_RINGS: ReadonlyArray<readonly [y: number, r: number]> = [
  [0, 0.07],
  [0.22, 0.17],
  [0.5, 0.2],
  [0.78, 0.13],
];
const BUD_SIDES = 6;
const BUD_TWIST_RAD = 1.5;

/**
 * A still-furled gardenia bud along +Y (height 1): a pointed spindle whose
 * petals are wrapped in a spiral. The spiral shows as light and dark stripes
 * twisting up the bud (alternate vertices of each ring), since the outline
 * itself is too small on screen to carry real ridges.
 */
export function furledBud(): MeshData {
  const mesh: MeshData = { positions: [], indices: [], shades: [] };
  const rings = BUD_RINGS.map(([y, r]) =>
    Array.from({ length: BUD_SIDES }, (_, j) => {
      const a = (j / BUD_SIDES) * Math.PI * 2 + y * BUD_TWIST_RAD;
      mesh.positions.push([Math.cos(a) * r, y, Math.sin(a) * r]);
      mesh.shades.push(j % 2 === 0 ? 1 : 0.78);
      return mesh.positions.length - 1;
    }),
  );
  mesh.positions.push([0, 1, 0]);
  mesh.shades.push(1);
  const tip = mesh.positions.length - 1;
  const outsideAt = (a: number, b: number, c: number): Vec => {
    const [x, , z] = centroid(mesh, a, b, c);
    return [x, 0, z];
  };
  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < BUD_SIDES; j++) {
      const a = rings[i][j];
      const b = rings[i][(j + 1) % BUD_SIDES];
      const c = rings[i + 1][j];
      const d = rings[i + 1][(j + 1) % BUD_SIDES];
      addTriangle(mesh, a, b, d, outsideAt(a, b, d));
      addTriangle(mesh, a, d, c, outsideAt(a, d, c));
    }
  }
  const top = rings[rings.length - 1];
  for (let j = 0; j < BUD_SIDES; j++) {
    const a = top[j];
    const b = top[(j + 1) % BUD_SIDES];
    addTriangle(mesh, a, b, tip, outsideAt(a, b, tip));
  }
  return mesh;
}
