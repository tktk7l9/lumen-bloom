// Weekly seasonal arrangements: which flowers/branches sit in which vase,
// month by month. Selection is deterministic — everyone sees the same
// arrangement for a given week, and it swaps automatically when the week
// rolls over. Pure data + date math, so the whole catalog is testable.

import type { VaseProfileOptions } from "./geometry/vaseProfile";

export type FloraKind =
  | "sunflower"
  | "tulip"
  | "cosmos"
  | "peony"
  | "hydrangea"
  | "blossomBranch"
  | "leafBranch"
  | "berryBranch";

export interface VaseStyle {
  kind: "glass" | "ceramic";
  /** Glass tint or ceramic body color. */
  colorHex: number;
}

export interface Arrangement {
  id: string;
  /** Display name for the HUD (Japanese flower name). */
  name: string;
  flora: {
    kind: FloraKind;
    /** Petal/leaf/berry colors, meaning depends on the kind. */
    paletteHex: readonly number[];
    /** Branch bark color for branch kinds; unused otherwise. */
    branchHex?: number;
    stemCount: number;
    seed: number;
  };
  vase: {
    profile: Partial<VaseProfileOptions>;
    style: VaseStyle;
  };
}

export const ARRANGEMENTS: readonly Arrangement[] = [
  {
    id: "sunflower",
    name: "ひまわり",
    flora: { kind: "sunflower", paletteHex: [], stemCount: 4, seed: 5 },
    vase: { profile: {}, style: { kind: "glass", colorHex: 0xf4fbf9 } },
  },
  {
    id: "tulip",
    name: "チューリップ",
    flora: {
      kind: "tulip",
      paletteHex: [0xd7443e, 0xe86fa4, 0xf2b93d, 0x9a5fc2],
      stemCount: 5,
      seed: 8,
    },
    vase: {
      profile: { heightM: 0.3, neckRadiusM: 0.048, bellyRadiusM: 0.07, baseRadiusM: 0.052 },
      style: { kind: "glass", colorHex: 0xf4fbf9 },
    },
  },
  {
    id: "cosmos",
    name: "コスモス",
    flora: {
      kind: "cosmos",
      paletteHex: [0xe973a8, 0xf5eef2, 0xc2447e],
      stemCount: 6,
      seed: 4,
    },
    vase: {
      profile: { heightM: 0.3, neckRadiusM: 0.035, bellyRadiusM: 0.045, baseRadiusM: 0.045 },
      style: { kind: "glass", colorHex: 0xd7dee6 },
    },
  },
  {
    id: "peony",
    name: "芍薬",
    flora: { kind: "peony", paletteHex: [0xe98cb1, 0xf3ece6], stemCount: 3, seed: 6 },
    vase: {
      profile: { heightM: 0.26, neckRadiusM: 0.055, bellyRadiusM: 0.095, baseRadiusM: 0.06 },
      style: { kind: "glass", colorHex: 0xd9b98a },
    },
  },
  {
    id: "hydrangea",
    name: "紫陽花",
    flora: {
      kind: "hydrangea",
      paletteHex: [0x7d8fd1, 0x9a86c8, 0x6aa3d8],
      stemCount: 3,
      seed: 9,
    },
    vase: {
      profile: { heightM: 0.24, neckRadiusM: 0.06, bellyRadiusM: 0.085, baseRadiusM: 0.06 },
      style: { kind: "ceramic", colorHex: 0x2e4668 },
    },
  },
  {
    id: "ume",
    name: "梅",
    flora: {
      kind: "blossomBranch",
      paletteHex: [0xe86a8a, 0xf0d24a],
      branchHex: 0x3a2d26,
      stemCount: 3,
      seed: 7,
    },
    vase: {
      profile: { heightM: 0.38, neckRadiusM: 0.042, bellyRadiusM: 0.052, baseRadiusM: 0.06 },
      style: { kind: "ceramic", colorHex: 0x33363e },
    },
  },
  {
    id: "sakura",
    name: "桜",
    flora: {
      kind: "blossomBranch",
      paletteHex: [0xf6cdd8, 0xe8b3c2],
      branchHex: 0x4a3a30,
      stemCount: 3,
      seed: 11,
    },
    vase: {
      profile: { heightM: 0.36, neckRadiusM: 0.05, bellyRadiusM: 0.06, baseRadiusM: 0.058 },
      style: { kind: "glass", colorHex: 0xf4fbf9 },
    },
  },
  {
    id: "momiji",
    name: "紅葉",
    flora: {
      kind: "leafBranch",
      paletteHex: [0xc7472e, 0xe08a2e, 0xd6b23a],
      branchHex: 0x40332a,
      stemCount: 3,
      seed: 12,
    },
    vase: {
      profile: { heightM: 0.38, neckRadiusM: 0.045, bellyRadiusM: 0.055, baseRadiusM: 0.06 },
      style: { kind: "glass", colorHex: 0xb9c0c9 },
    },
  },
  {
    id: "nanten",
    name: "南天",
    flora: {
      kind: "berryBranch",
      paletteHex: [0xc22b2a, 0x4e6b30],
      branchHex: 0x3d3128,
      stemCount: 3,
      seed: 3,
    },
    vase: {
      profile: { heightM: 0.36, neckRadiusM: 0.04, bellyRadiusM: 0.05, baseRadiusM: 0.055 },
      style: { kind: "ceramic", colorHex: 0xe8e2d6 },
    },
  },
];

// Two ids per month (0 = January); the pick alternates week by week so
// consecutive weeks always differ.
const MONTH_ROTATION: ReadonlyArray<readonly [string, string]> = [
  ["ume", "nanten"], // 1月
  ["ume", "tulip"], // 2月
  ["sakura", "tulip"], // 3月
  ["tulip", "sakura"], // 4月
  ["peony", "hydrangea"], // 5月
  ["hydrangea", "peony"], // 6月
  ["sunflower", "hydrangea"], // 7月
  ["sunflower", "cosmos"], // 8月
  ["cosmos", "sunflower"], // 9月
  ["cosmos", "momiji"], // 10月
  ["momiji", "nanten"], // 11月
  ["nanten", "momiji"], // 12月
];

// Old registry ids kept working for shared links.
const ALIASES: Record<string, string> = {
  "vase-flowers": "sunflower",
  "vase-tulips": "tulip",
};

export function findArrangement(id: string): Arrangement | null {
  const resolved = ALIASES[id] ?? id;
  return ARRANGEMENTS.find((a) => a.id === resolved) ?? null;
}

const WEEK_MS = 7 * 86_400_000;

/**
 * The arrangement for this week. Southern-hemisphere viewers get the
 * month shifted by six — July there calls for branches, not sunflowers.
 */
export function arrangementForDate(date: Date, latitude = 35): Arrangement {
  const shift = latitude < 0 ? 6 : 0;
  const month = (date.getMonth() + shift) % 12;
  const pair = MONTH_ROTATION[month];
  const week = Math.floor(date.getTime() / WEEK_MS);
  const id = pair[((week % pair.length) + pair.length) % pair.length];
  // Every MONTH_ROTATION id is verified against the catalog by tests.
  return findArrangement(id) as Arrangement;
}
