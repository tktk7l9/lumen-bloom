import { ARRANGEMENTS, arrangementForDate, findArrangement } from "./arrangements";
import { DEFAULT_VASE_PROFILE } from "./geometry/vaseProfile";

describe("arrangements catalog", () => {
  it("has unique ids", () => {
    const ids = ARRANGEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every arrangement has a display name and a sane vase profile", () => {
    for (const a of ARRANGEMENTS) {
      expect(a.name.length).toBeGreaterThan(0);
      const profile = { ...DEFAULT_VASE_PROFILE, ...a.vase.profile };
      expect(profile.heightM).toBeGreaterThan(0.1);
      expect(profile.neckRadiusM).toBeGreaterThan(0);
      expect(profile.bellyRadiusM).toBeGreaterThanOrEqual(profile.neckRadiusM * 0.9);
      expect(profile.baseRadiusM).toBeGreaterThan(0);
    }
  });

  it("branch kinds carry a bark color", () => {
    for (const a of ARRANGEMENTS) {
      const isBranch = ["blossomBranch", "leafBranch", "berryBranch"].includes(a.flora.kind);
      if (isBranch) expect(a.flora.branchHex).toBeGreaterThan(0);
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

describe("arrangementForDate", () => {
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

  it("picks summer flowers in July for the northern hemisphere", () => {
    const ids = [
      arrangementForDate(new Date(2026, 6, 8), 35).id,
      arrangementForDate(new Date(2026, 6, 15), 35).id,
    ];
    expect(ids.sort()).toEqual(["hydrangea", "sunflower"]);
  });

  it("shifts the season six months for the southern hemisphere", () => {
    const ids = [
      arrangementForDate(new Date(2026, 6, 8), -33.9).id,
      arrangementForDate(new Date(2026, 6, 15), -33.9).id,
    ];
    // July in Sydney = January's pair.
    expect(ids.sort()).toEqual(["nanten", "ume"]);
  });

  it("defaults to the northern hemisphere when latitude is omitted", () => {
    const d = new Date(2026, 6, 8);
    expect(arrangementForDate(d).id).toBe(arrangementForDate(d, 35).id);
  });
});
