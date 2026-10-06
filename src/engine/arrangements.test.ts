import {
  ARRANGEMENTS,
  BRANCH_KINDS,
  WEEK_MS,
  arrangementForDate,
  findArrangement,
  monthCandidates,
} from "./arrangements";
import { DEFAULT_VASE_PROFILE } from "./geometry/vaseProfile";

describe("arrangements catalog", () => {
  it("has unique ids", () => {
    const ids = ARRANGEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has unique display names (the info card repaints only when the name changes)", () => {
    const names = ARRANGEMENTS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("uses ids that survive the ?obj= URL filter", () => {
    for (const a of ARRANGEMENTS) expect(a.id).toMatch(/^[a-z0-9-]+$/);
  });

  it("every arrangement has a display name, a description, and a sane vase profile", () => {
    for (const a of ARRANGEMENTS) {
      expect(a.name.length).toBeGreaterThan(0);
      expect(a.description.length).toBeGreaterThan(20);
      const profile = { ...DEFAULT_VASE_PROFILE, ...a.vase.profile };
      expect(profile.heightM).toBeGreaterThan(0.1);
      expect(profile.neckRadiusM).toBeGreaterThan(0);
      expect(profile.bellyRadiusM).toBeGreaterThanOrEqual(profile.neckRadiusM * 0.9);
      expect(profile.baseRadiusM).toBeGreaterThan(0);
    }
  });

  it("branch kinds carry a bark color", () => {
    for (const a of ARRANGEMENTS) {
      if (BRANCH_KINDS.includes(a.flora.kind)) expect(a.flora.branchHex).toBeGreaterThan(0);
    }
  });
});

describe("findArrangement", () => {
  it("finds by id and returns null for unknown ids", () => {
    expect(findArrangement("sunflower")?.name).toBe("ひまわり");
    expect(findArrangement("nope")).toBeNull();
  });

  it("keeps the old registry ids working as aliases", () => {
    expect(findArrangement("vase-flowers")?.id).toBe("sunflower");
    expect(findArrangement("vase-tulips")?.id).toBe("tulip");
  });
});

describe("monthly rotation", () => {
  it("lists only catalog ids, with no duplicates inside a month", () => {
    for (let m = 0; m < 12; m++) {
      const ids = monthCandidates(m);
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) expect(findArrangement(id)).not.toBeNull();
    }
  });

  it("gives every month the same number of candidates", () => {
    const sizes = new Set(Array.from({ length: 12 }, (_, m) => monthCandidates(m).length));
    expect(sizes.size).toBe(1);
  });

  it("puts every catalog arrangement in season somewhere in the year", () => {
    const inRotation = new Set(Array.from({ length: 12 }, (_, m) => monthCandidates(m)).flat());
    for (const a of ARRANGEMENTS) expect(inRotation.has(a.id)).toBe(true);
  });

  it("keeps an arrangement shared by adjacent months in the same slot", () => {
    for (let m = 0; m < 12; m++) {
      const here = monthCandidates(m);
      const next = monthCandidates((m + 1) % 12);
      here.forEach((id, slot) => {
        const nextSlot = next.indexOf(id);
        if (nextSlot !== -1) expect(nextSlot).toBe(slot);
      });
    }
  });
});

describe("arrangementForDate", () => {
  it("never shows the same arrangement two weeks in a row, in either hemisphere", () => {
    const start = Date.UTC(2026, 0, 1);
    const weeks = 52 * 6;
    for (const latitude of [35, -33.9]) {
      for (let w = 0; w < weeks; w++) {
        const d = new Date(start + w * WEEK_MS);
        const next = new Date(start + (w + 1) * WEEK_MS);
        expect(arrangementForDate(d, latitude).id).not.toBe(arrangementForDate(next, latitude).id);
      }
    }
  });

  it("resolves a valid catalog arrangement for every month of the year", () => {
    for (let m = 0; m < 12; m++) {
      for (const day of [3, 18]) {
        const a = arrangementForDate(new Date(2026, m, day));
        expect(ARRANGEMENTS.some((x) => x.id === a.id)).toBe(true);
      }
    }
  });

  it("is deterministic", () => {
    const d = new Date("2026-07-14T12:00:00Z");
    expect(arrangementForDate(d).id).toBe(arrangementForDate(d).id);
  });

  it("changes between consecutive weeks", () => {
    // Mid-month so both weeks fall in the same month's pair.
    const w1 = arrangementForDate(new Date(2026, 6, 8));
    const w2 = arrangementForDate(new Date(2026, 6, 15));
    expect(w1.id).not.toBe(w2.id);
  });

  it("cycles through July's summer candidates week by week (north)", () => {
    const ids = [1, 8, 15, 22, 29].map((day) => arrangementForDate(new Date(2026, 6, day), 35).id);
    expect(new Set(ids).size).toBe(5);
    for (const id of ids) expect(monthCandidates(6)).toContain(id);
  });

  it("shifts the season six months for the southern hemisphere", () => {
    const ids = [1, 8, 15, 22, 29].map((day) => arrangementForDate(new Date(2026, 6, day), -33.9).id);
    // July in Sydney = January's winter candidates.
    for (const id of ids) expect(monthCandidates(0)).toContain(id);
    expect(new Set(ids).size).toBe(5);
  });

  it("defaults to the northern hemisphere when latitude is omitted", () => {
    const d = new Date(2026, 6, 8);
    expect(arrangementForDate(d).id).toBe(arrangementForDate(d, 35).id);
  });
});
