import { type MeshData, faceNormal, furledBud, lobedLeaf, starFloret } from "./floraMeshes";

function triangles(mesh: MeshData): Array<[number, number, number]> {
  const out: Array<[number, number, number]> = [];
  for (let i = 0; i < mesh.indices.length; i += 3) {
    out.push([mesh.indices[i], mesh.indices[i + 1], mesh.indices[i + 2]]);
  }
  return out;
}

function expectWellFormed(mesh: MeshData): void {
  expect(mesh.indices.length % 3).toBe(0);
  expect(mesh.shades).toHaveLength(mesh.positions.length);
  for (const i of mesh.indices) {
    expect(Number.isInteger(i)).toBe(true);
    expect(i).toBeGreaterThanOrEqual(0);
    expect(i).toBeLessThan(mesh.positions.length);
  }
  for (const p of mesh.positions) for (const v of p) expect(Number.isFinite(v)).toBe(true);
  for (const s of mesh.shades) {
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThanOrEqual(1);
  }
  // No degenerate (zero-area) triangles: every face has a real normal.
  for (const [a, b, c] of triangles(mesh)) {
    const n = faceNormal(mesh.positions[a], mesh.positions[b], mesh.positions[c]);
    expect(Math.hypot(...n)).toBeCloseTo(1, 9);
  }
}

describe("faceNormal", () => {
  it("follows counter-clockwise winding", () => {
    expect(faceNormal([0, 0, 0], [1, 0, 0], [0, 1, 0])).toEqual([0, 0, 1]);
    expect(faceNormal([0, 0, 0], [0, 1, 0], [1, 0, 0])).toEqual([0, 0, -1]);
  });
});

describe("starFloret", () => {
  it("has a fixed structure: 7 vertices and 9 triangles per lobe", () => {
    const mesh = starFloret();
    expect(mesh.positions).toHaveLength(42);
    expect(mesh.indices).toHaveLength(54 * 3);
    expect(starFloret(5).positions).toHaveLength(35);
    // Fewer than three lobes is not a star.
    expect(starFloret(2).positions).toHaveLength(21);
  });

  it("is well formed and deterministic", () => {
    expectWellFormed(starFloret());
    expect(starFloret()).toEqual(starFloret());
  });

  it("fits a unit floret opening along +Y", () => {
    for (const [x, y, z] of starFloret().positions) {
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(0.6);
      expect(Math.hypot(x, z)).toBeLessThanOrEqual(0.6 + 1e-9);
    }
  });

  it("spreads its tepals into a star whose tips curl back below the midline", () => {
    const mesh = starFloret();
    const tips = mesh.positions.filter((_, i) => mesh.shades[i] === 1);
    expect(tips).toHaveLength(6);
    const mids = mesh.positions.filter((_, i) => mesh.shades[i] === 0.88);
    for (let k = 0; k < 6; k++) {
      expect(Math.hypot(tips[k][0], tips[k][2])).toBeCloseTo(0.6, 9);
      expect(tips[k][1]).toBeLessThan(mids[k][1]);
      // Six-fold symmetry: each tip is the previous one turned by 60°.
      const angle = Math.atan2(tips[k][2], tips[k][0]);
      expect(Math.cos(angle - (k * Math.PI) / 3)).toBeCloseTo(1, 9);
    }
  });

  it("is darkest at the base of the tube and lightest at the tepal tips", () => {
    const mesh = starFloret();
    expect(Math.min(...mesh.shades)).toBe(mesh.shades[0]);
    expect(Math.max(...mesh.shades)).toBe(1);
  });

  it("winds every face to the outside (away from the axis and down)", () => {
    const mesh = starFloret();
    for (const [a, b, c] of triangles(mesh)) {
      const [p, q, r] = [mesh.positions[a], mesh.positions[b], mesh.positions[c]];
      const n = faceNormal(p, q, r);
      const cx = (p[0] + q[0] + r[0]) / 3;
      const cz = (p[2] + q[2] + r[2]) / 3;
      const len = Math.hypot(cx, cz);
      expect(n[0] * (cx / len) - n[1] + n[2] * (cz / len)).toBeGreaterThan(0);
    }
  });
});

describe("lobedLeaf", () => {
  it("has a fixed structure", () => {
    const mesh = lobedLeaf();
    expect(mesh.positions).toHaveLength(28);
    expect(mesh.indices).toHaveLength(34 * 3);
  });

  it("is well formed and deterministic", () => {
    expectWellFormed(lobedLeaf());
    expect(lobedLeaf()).toEqual(lobedLeaf());
  });

  it("is mirror-symmetric across the midrib", () => {
    const { positions } = lobedLeaf();
    for (const [x, y, z] of positions) {
      const mirror = positions.find((p) => p[0] === -x && p[1] === y && p[2] === z);
      expect(mirror).toBeDefined();
    }
  });

  it("runs from the petiole at y=0 to the tip at y=1, widest at the middle lobes", () => {
    const { positions } = lobedLeaf();
    const ys = positions.map((p) => p[1]);
    expect(Math.min(...ys)).toBe(0);
    expect(Math.max(...ys)).toBe(1);
    const widest = positions.reduce((best, p) => (Math.abs(p[0]) > Math.abs(best[0]) ? p : best));
    expect(Math.abs(widest[0])).toBeCloseTo(0.3, 9);
    expect(widest[1]).toBeGreaterThan(0.3);
    expect(widest[1]).toBeLessThan(0.6);
  });

  it("alternates lobes and sinuses along each edge", () => {
    const right = lobedLeaf().positions.filter((p) => p[0] > 0);
    const widths = right.map((p) => p[0]);
    // lobe, sinus, lobe, sinus, lobe, sinus: each sinus is narrower than the lobes around it.
    for (const s of [3, 5, 7]) {
      expect(widths[s]).toBeLessThan(widths[s - 1]);
      expect(widths[s]).toBeLessThan(widths[s + 1]);
    }
  });

  it("lifts the midrib and bends the tip back, like petalGrid", () => {
    const { positions } = lobedLeaf();
    const midrib = positions.filter((p) => p[0] === 0 && p[1] > 0 && p[1] < 1);
    for (const [, y, z] of midrib) {
      const edge = positions.find((p) => p[0] > 0 && p[1] === y);
      expect(z).toBeGreaterThan(edge?.[2] ?? Infinity);
    }
    const tip = positions.find((p) => p[1] === 1);
    expect(tip?.[2]).toBeCloseTo(-0.12, 9);
  });

  it("faces every triangle the same way (+Z)", () => {
    const mesh = lobedLeaf();
    for (const [a, b, c] of triangles(mesh)) {
      expect(faceNormal(mesh.positions[a], mesh.positions[b], mesh.positions[c])[2]).toBeGreaterThan(0);
    }
  });
});

describe("furledBud", () => {
  it("has a fixed structure: four twisted rings and a tip", () => {
    const mesh = furledBud();
    expect(mesh.positions).toHaveLength(25);
    expect(mesh.indices).toHaveLength(42 * 3);
    expect(mesh.positions[24]).toEqual([0, 1, 0]);
  });

  it("is well formed and deterministic", () => {
    expectWellFormed(furledBud());
    expect(furledBud()).toEqual(furledBud());
  });

  it("swells low and tapers to the tip within a slim spindle", () => {
    const radii = [0, 1, 2, 3].map((ring) => {
      const [x, , z] = furledBud().positions[ring * 6];
      return Math.hypot(x, z);
    });
    expect(Math.max(...radii)).toBeCloseTo(0.2, 9);
    expect(radii[3]).toBeLessThan(radii[2]);
    expect(radii[0]).toBeLessThan(radii[1]);
  });

  it("twists each ring further round than the one below", () => {
    const { positions } = furledBud();
    const angles = [0, 1, 2, 3].map((ring) => Math.atan2(positions[ring * 6][2], positions[ring * 6][0]));
    for (let i = 1; i < angles.length; i++) expect(angles[i]).toBeGreaterThan(angles[i - 1]);
  });

  it("stripes the spiral with alternating shades and winds faces outward", () => {
    const mesh = furledBud();
    expect(mesh.shades.slice(0, 6)).toEqual([1, 0.78, 1, 0.78, 1, 0.78]);
    for (const [a, b, c] of triangles(mesh)) {
      const [p, q, r] = [mesh.positions[a], mesh.positions[b], mesh.positions[c]];
      const n = faceNormal(p, q, r);
      expect(n[0] * (p[0] + q[0] + r[0]) + n[2] * (p[2] + q[2] + r[2])).toBeGreaterThan(0);
    }
  });
});
