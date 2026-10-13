import { sprayLayout } from "./spray";

const BASE = {
  shoots: 6,
  seed: 3,
  spanM: 0.05,
  reachM: 0.035,
  sagM: 0.012,
  headRadiusM: { min: 0.011, max: 0.015 },
  budFraction: 0.34,
};

const horizontal = (p: readonly number[]): number => Math.hypot(p[0], p[2]);

describe("sprayLayout", () => {
  it("is deterministic for a given seed", () => {
    expect(sprayLayout(BASE)).toEqual(sprayLayout(BASE));
    expect(sprayLayout({ ...BASE, seed: 4 })).not.toEqual(sprayLayout(BASE));
  });

  it("returns the terminal head plus one head per shoot", () => {
    expect(sprayLayout(BASE)).toHaveLength(7);
    expect(sprayLayout({ ...BASE, shoots: 0 })).toHaveLength(1);
    expect(sprayLayout({ ...BASE, shoots: -2 })).toHaveLength(1);
  });

  it("puts the open terminal head on a short neck straight up the stem", () => {
    const [terminal] = sprayLayout(BASE);
    expect(terminal.dropM).toBe(0);
    expect(terminal.bud).toBe(false);
    expect(terminal.facing).toEqual([0, 1, 0]);
    expect(terminal.pedicel[0]).toEqual([0, 0, 0]);
    expect(terminal.pedicel[3][1]).toBeCloseTo(0.006, 9);
  });

  it("attaches the shoots down the span from the top, in order", () => {
    const shoots = sprayLayout(BASE).slice(1);
    let previous = 0;
    for (const head of shoots) {
      expect(head.dropM).toBeGreaterThan(previous);
      expect(head.dropM).toBeLessThanOrEqual(BASE.spanM);
      previous = head.dropM;
      // Each shoot starts on the stem at its attachment height.
      expect(head.pedicel[0]).toEqual([0, -head.dropM, 0]);
      expect(head.pedicel).toHaveLength(4);
    }
  });

  it("finishes every head in a dome around the terminal one, above its own attachment", () => {
    for (const head of sprayLayout(BASE).slice(1)) {
      const end = head.pedicel[3];
      expect(horizontal(end)).toBeLessThanOrEqual(BASE.reachM * 1.12 + 1e-12);
      expect(end[1]).toBeGreaterThan(-head.dropM);
      expect(end[1]).toBeGreaterThanOrEqual(-BASE.sagM * 1.12 ** 2 * 1.2 - 1e-12);
      expect(end[1]).toBeLessThanOrEqual(0.3 * BASE.reachM);
    }
  });

  it("lets the lowest shoot reach furthest out", () => {
    const shoots = sprayLayout(BASE).slice(1);
    expect(horizontal(shoots[shoots.length - 1].pedicel[3])).toBeGreaterThan(horizontal(shoots[0].pedicel[3]));
  });

  it("arches each shoot out from the stem before it turns up into the head", () => {
    for (const head of sprayLayout(BASE).slice(1)) {
      const [start, a, b, end] = head.pedicel;
      // Monotone outward travel…
      expect(horizontal(a)).toBeGreaterThan(horizontal(start));
      expect(horizontal(b)).toBeGreaterThan(horizontal(a));
      expect(horizontal(end)).toBeGreaterThan(horizontal(b));
      // …and the last stretch climbs more steeply than the first.
      const slope = (p: readonly number[], q: readonly number[]): number =>
        (q[1] - p[1]) / Math.max(1e-9, horizontal(q) - horizontal(p));
      expect(slope(b, end)).toBeGreaterThan(slope(start, a));
    }
  });

  it("turns every face up toward the light", () => {
    for (const head of sprayLayout(BASE)) {
      expect(Math.hypot(...head.facing)).toBeCloseTo(1, 9);
      expect(head.facing[1]).toBeGreaterThan(0.75);
    }
  });

  it("keeps the top shoots in bud and sizes heads within range", () => {
    const heads = sprayLayout(BASE);
    expect(heads.filter((h) => h.bud)).toHaveLength(2);
    expect(heads[1].bud).toBe(true);
    expect(heads[heads.length - 1].bud).toBe(false);
    for (const h of heads) {
      expect(h.headRadiusM).toBeGreaterThanOrEqual(BASE.headRadiusM.min);
      expect(h.headRadiusM).toBeLessThanOrEqual(BASE.headRadiusM.max);
    }
    expect(sprayLayout({ ...BASE, budFraction: 2 }).filter((h) => h.bud)).toHaveLength(6);
    expect(sprayLayout({ ...BASE, budFraction: -1 }).filter((h) => h.bud)).toHaveLength(0);
  });

  it("produces only finite coordinates", () => {
    for (const head of sprayLayout({ ...BASE, shoots: 9, seed: 99 })) {
      for (const p of [...head.pedicel, head.facing]) {
        for (const v of p) expect(Number.isFinite(v)).toBe(true);
      }
    }
  });
});
