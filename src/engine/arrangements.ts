// Weekly seasonal arrangements: which flowers/branches sit in which vase,
// month by month. Selection is deterministic — everyone sees the same
// arrangement for a given week, and it swaps automatically when the week
// rolls over. Pure data + date math, so the whole catalog is testable.

import type { VaseProfileOptions } from "./geometry/vaseProfile";

export type FloraKind =
  | "sunflower"
  | "tulip"
  | "cosmos"
  | "anemone"
  | "gerbera"
  | "margaret"
  | "peony"
  | "dahlia"
  | "mum"
  | "carnation"
  | "rose"
  | "ranunculus"
  | "hydrangea"
  | "narcissus"
  | "lily"
  | "lavender"
  | "kasumisou"
  | "rindou"
  | "calla"
  | "blossomBranch"
  | "leafBranch"
  | "berryBranch";

export interface VaseStyle {
  kind: "glass" | "ceramic" | "metal";
  /** Glass tint, ceramic body color, or metal color. */
  colorHex: number;
}

export interface Arrangement {
  id: string;
  /** Display name for the HUD (Japanese flower name). */
  name: string;
  /** A couple of sentences about the flower, shown in the info card. */
  description: string;
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
    description:
      "夏を代表する一年草。若い花は太陽を追って東から西へ向きを変え、種の並びはフィボナッチ数の螺旋を描く。花言葉は「憧れ」。",
    flora: { kind: "sunflower", paletteHex: [], stemCount: 4, seed: 5 },
    vase: { profile: {}, style: { kind: "glass", colorHex: 0xf4fbf9 } },
  },
  {
    id: "tulip",
    name: "チューリップ",
    description:
      "春の球根花。昼は開き夜は閉じる就眠運動をし、切り花になっても水を吸って伸び続ける。花言葉は「思いやり」。",
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
    description:
      "漢字では「秋桜」。細い茎に軽やかな八弁の花を揺らす秋の野の花で、風に強くしなやか。花言葉は「調和」「乙女の真心」。",
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
    description:
      "「立てば芍薬、座れば牡丹」と美人の立ち姿に例えられる初夏の花。幾重にも重なる花弁が一輪でも豪華。花言葉は「はにかみ」。",
    flora: { kind: "peony", paletteHex: [0xe98cb1, 0xf3ece6], stemCount: 3, seed: 6 },
    vase: {
      profile: { heightM: 0.26, neckRadiusM: 0.055, bellyRadiusM: 0.095, baseRadiusM: 0.06 },
      style: { kind: "glass", colorHex: 0xd9b98a },
    },
  },
  {
    id: "hydrangea",
    name: "紫陽花",
    description:
      "梅雨を彩る花。小さな花の集まりに見える部分は実は萼(がく)で、土の酸性度によって青にも赤紫にも色を変える。花言葉は「移り気」「辛抱強い愛情」。",
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
    description:
      "厳寒の中、春に先駆けて香り高く咲く枝物。万葉集では桜より多く詠まれた花見の元祖。花言葉は「高潔」「忍耐」。",
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
    description:
      "日本の春の象徴。開花からわずか二週間ほどで散る儚さが古くから愛され、枝物として生けると室内でも小さな花見ができる。花言葉は「精神の美」。",
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
    description:
      "秋の彩りを室内に持ち込む枝物。気温が下がると葉の中の糖がアントシアニンに変わり、緑から赤や橙へ染まる。花言葉は「大切な思い出」。",
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
    description:
      "「難を転ずる」に通じる縁起木として、正月飾りや鬼門に植えられてきた冬の実もの。艶やかな赤い実は雪景色によく映える。花言葉は「福をなす」。",
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
  {
    id: "suisen",
    name: "水仙",
    description:
      "雪の残る頃から咲き始める冬の花。うつむき加減に咲く白い花弁の中心に、ラッパ状の黄色い副花冠を持つ。花言葉は「自己愛」「うぬぼれ」——水鏡に見とれたナルキッソスの伝説から。",
    flora: {
      kind: "narcissus",
      paletteHex: [0xf4f2ea, 0xe8b93a],
      stemCount: 5,
      seed: 10,
    },
    vase: {
      profile: { heightM: 0.28, neckRadiusM: 0.04, bellyRadiusM: 0.052, baseRadiusM: 0.05 },
      style: { kind: "ceramic", colorHex: 0xdde6ec },
    },
  },
  {
    id: "mimosa",
    name: "ミモザ",
    description:
      "早春を告げる黄色いポンポンの枝物。3月8日の国際女性デーには感謝を込めて贈られる「ミモザの日」の花。銀葉との対比も美しい。花言葉は「感謝」「友情」。",
    flora: {
      kind: "berryBranch",
      paletteHex: [0xf2c73a, 0x8a9a7b],
      branchHex: 0x5a4c3a,
      stemCount: 3,
      seed: 14,
    },
    vase: {
      profile: { heightM: 0.34, neckRadiusM: 0.048, bellyRadiusM: 0.058, baseRadiusM: 0.058 },
      style: { kind: "ceramic", colorHex: 0xb0603f },
    },
  },
  {
    id: "carnation",
    name: "カーネーション",
    description:
      "フリルのように波打つ花弁を幾重にも重ねる、母の日の定番。切り花としての歴史は古く、日持ちの良さでも愛される。花言葉は「無垢で深い愛」。",
    flora: {
      kind: "carnation",
      paletteHex: [0xe87a9c, 0xc23b52],
      stemCount: 4,
      seed: 13,
    },
    vase: {
      profile: { heightM: 0.27, neckRadiusM: 0.05, bellyRadiusM: 0.075, baseRadiusM: 0.055 },
      style: { kind: "glass", colorHex: 0xe9c9d2 },
    },
  },
  {
    id: "lavender",
    name: "ラベンダー",
    description:
      "初夏の風に香る紫の穂。古代ローマでは入浴に使われ、名はラテン語の「洗う(lavare)」に由来するとも。乾いても香りが残る。花言葉は「沈黙」「あなたを待っています」。",
    flora: {
      kind: "lavender",
      paletteHex: [0x8a76c9, 0x6f5cb0],
      stemCount: 9,
      seed: 15,
    },
    vase: {
      profile: { heightM: 0.29, neckRadiusM: 0.036, bellyRadiusM: 0.046, baseRadiusM: 0.046 },
      style: { kind: "glass", colorHex: 0xf4fbf9 },
    },
  },
  {
    id: "lily",
    name: "ユリ",
    description:
      "大輪の花弁を優雅に反らせて咲く夏の花。強い芳香を放ち、一輪でも空間の主役になる。白いカサブランカは「ユリの女王」と呼ばれる。花言葉は「純粋」「威厳」。",
    flora: {
      kind: "lily",
      paletteHex: [0xf6f3ec, 0xf2dfe8],
      stemCount: 3,
      seed: 16,
    },
    vase: {
      profile: { heightM: 0.37, neckRadiusM: 0.055, bellyRadiusM: 0.068, baseRadiusM: 0.06 },
      style: { kind: "glass", colorHex: 0xeef7f6 },
    },
  },
  {
    id: "doudan",
    name: "ドウダンツツジ",
    description:
      "夏の生け込みの定番となった枝物。涼やかな小さい緑の葉が風にそよぎ、水さえ替えれば一ヶ月近くもつ丈夫さで人気。秋には紅葉も楽しめる。花言葉は「上品」「節制」。",
    flora: {
      kind: "leafBranch",
      paletteHex: [0x4c7a34, 0x69984a, 0x3c6428],
      branchHex: 0x4a3c30,
      stemCount: 3,
      seed: 17,
    },
    vase: {
      profile: { heightM: 0.36, neckRadiusM: 0.06, bellyRadiusM: 0.07, baseRadiusM: 0.062 },
      style: { kind: "glass", colorHex: 0xf0f7f5 },
    },
  },
  {
    id: "dahlia",
    name: "ダリア",
    description:
      "幾何学的に重なる花弁が圧巻の秋の大輪。18世紀にメキシコからヨーロッパへ渡り、品種は今や数万種とも。和名は「天竺牡丹」。花言葉は「華麗」「気品」。",
    flora: {
      kind: "dahlia",
      paletteHex: [0xc23b4e, 0xd96f2e],
      stemCount: 3,
      seed: 18,
    },
    vase: {
      profile: { heightM: 0.28, neckRadiusM: 0.05, bellyRadiusM: 0.08, baseRadiusM: 0.058 },
      style: { kind: "ceramic", colorHex: 0x24262c },
    },
  },
  {
    id: "mum",
    name: "マム",
    description:
      "皇室の紋にも使われる菊を、洋風にアレンジしたのが「マム」。細い花弁がびっしりと重なる姿は晩秋の贅沢。重陽の節句(9月9日)は菊の節句。花言葉は「高貴」。",
    flora: {
      kind: "mum",
      paletteHex: [0xe8c23a, 0xf2efe6],
      stemCount: 4,
      seed: 19,
    },
    vase: {
      profile: { heightM: 0.3, neckRadiusM: 0.048, bellyRadiusM: 0.065, baseRadiusM: 0.056 },
      style: { kind: "ceramic", colorHex: 0xafc9ba },
    },
  },
  {
    id: "rose",
    name: "バラ",
    description:
      "愛と美の象徴として最も贈られてきた花。贈る本数によって意味が変わり、1本は「一目惚れ」、12本は「私と付き合ってください」。花言葉は「愛」「美」。",
    flora: {
      kind: "rose",
      paletteHex: [0xc22b45, 0xf2e8e0],
      stemCount: 4,
      seed: 21,
    },
    vase: {
      profile: { heightM: 0.28, neckRadiusM: 0.052, bellyRadiusM: 0.078, baseRadiusM: 0.056 },
      style: { kind: "glass", colorHex: 0x3f5fae },
    },
  },
  {
    id: "ranunculus",
    name: "ラナンキュラス",
    description:
      "薄紙のような花弁が幾重にも重なる春の花。咲き進むほどふんわりと開き、一輪でも豪華な表情に。名前はラテン語の「小さなカエル」から。花言葉は「とても魅力的」。",
    flora: {
      kind: "ranunculus",
      paletteHex: [0xe8875f, 0xf2e3cf, 0xb06fc2],
      stemCount: 4,
      seed: 22,
    },
    vase: {
      profile: { heightM: 0.24, neckRadiusM: 0.052, bellyRadiusM: 0.08, baseRadiusM: 0.06 },
      style: { kind: "ceramic", colorHex: 0xf0e9dc },
    },
  },
  {
    id: "anemone",
    name: "アネモネ",
    description:
      "名前はギリシャ語の「風(anemos)」から来た「風の花」。ビロードのような黒い花芯と鮮やかな花弁のコントラストが早春の主役。花言葉は「はかない恋」「期待」。",
    flora: {
      kind: "anemone",
      paletteHex: [0xc23b52, 0xf2ede8, 0x7a5fc2],
      stemCount: 5,
      seed: 23,
    },
    vase: {
      profile: { heightM: 0.27, neckRadiusM: 0.046, bellyRadiusM: 0.06, baseRadiusM: 0.052 },
      style: { kind: "glass", colorHex: 0xaab3bf },
    },
  },
  {
    id: "gerbera",
    name: "ガーベラ",
    description:
      "整った放射状の花弁と豊富な色数で、花束の主役にも脇役にもなれる花。前向きな花言葉ばかりで贈り物に選ばれやすい。花言葉は「希望」「常に前進」。",
    flora: {
      kind: "gerbera",
      paletteHex: [0xe86a2e, 0xe873a0, 0xf2c23a],
      stemCount: 5,
      seed: 24,
    },
    vase: {
      profile: { heightM: 0.3, neckRadiusM: 0.05, bellyRadiusM: 0.062, baseRadiusM: 0.06 },
      style: { kind: "metal", colorHex: 0xb08d4a },
    },
  },
  {
    id: "margaret",
    name: "マーガレット",
    description:
      "「好き、嫌い、好き……」の花占いはこの花から。ギリシャ語の「真珠(margarites)」が名前の由来で、白い一重咲きが清楚。花言葉は「恋占い」「真実の愛」。",
    flora: {
      kind: "margaret",
      paletteHex: [0xf5f2ea],
      stemCount: 6,
      seed: 25,
    },
    vase: {
      profile: { heightM: 0.24, neckRadiusM: 0.045, bellyRadiusM: 0.055, baseRadiusM: 0.05 },
      style: { kind: "glass", colorHex: 0xf4fbf9 },
    },
  },
  {
    id: "kasumisou",
    name: "かすみ草",
    description:
      "無数の小さな白い花が霞のように広がる名脇役。近年は主役として束ねるブーケも人気で、ドライフラワーにしても長く楽しめる。花言葉は「幸福」「無垢の愛」。",
    flora: {
      kind: "kasumisou",
      paletteHex: [0xf5f4ee],
      stemCount: 8,
      seed: 26,
    },
    vase: {
      profile: { heightM: 0.3, neckRadiusM: 0.034, bellyRadiusM: 0.044, baseRadiusM: 0.046 },
      style: { kind: "glass", colorHex: 0xf4fbf9 },
    },
  },
  {
    id: "rindou",
    name: "リンドウ",
    description:
      "秋の野に凛と咲く青紫の花。敬老の日に贈る花としても定着している——根が生薬「竜胆」として長寿に効くとされたことから。花言葉は「勝利」「正義感」。",
    flora: {
      kind: "rindou",
      paletteHex: [0x3a55a8, 0x5a4fa0],
      stemCount: 5,
      seed: 27,
    },
    vase: {
      profile: { heightM: 0.29, neckRadiusM: 0.046, bellyRadiusM: 0.06, baseRadiusM: 0.054 },
      style: { kind: "ceramic", colorHex: 0x5b6b7e },
    },
  },
  {
    id: "calla",
    name: "カラー",
    description:
      "くるりと巻いた白い苞(ほう)がワイングラスのよう。すっと伸びた立ち姿からウェディングブーケの定番となった。名はギリシャ語の「美しい(kallos)」。花言葉は「華麗なる美」。",
    flora: {
      kind: "calla",
      paletteHex: [0xf4f1e8, 0xe8c23a],
      stemCount: 4,
      seed: 28,
    },
    vase: {
      profile: { heightM: 0.34, neckRadiusM: 0.048, bellyRadiusM: 0.054, baseRadiusM: 0.058 },
      style: { kind: "ceramic", colorHex: 0xf2efe8 },
    },
  },
];

// Seasonal candidates per month (0 = January); the pick cycles week by
// week so consecutive weeks always differ.
const MONTH_ROTATION: ReadonlyArray<readonly string[]> = [
  ["ume", "suisen", "nanten"], // 1月
  ["ume", "ranunculus", "anemone", "suisen"], // 2月
  ["sakura", "mimosa", "tulip", "margaret"], // 3月
  ["tulip", "sakura", "gerbera", "peony"], // 4月
  ["peony", "carnation", "calla", "hydrangea"], // 5月
  ["hydrangea", "rose", "lavender", "doudan"], // 6月
  ["sunflower", "lily", "doudan"], // 7月
  ["sunflower", "kasumisou", "lily", "cosmos"], // 8月
  ["cosmos", "rindou", "mum", "sunflower"], // 9月
  ["cosmos", "dahlia", "rose", "momiji"], // 10月
  ["momiji", "mum", "dahlia"], // 11月
  ["nanten", "momiji", "suisen"], // 12月
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

export const WEEK_MS = 7 * 86_400_000;

/**
 * The arrangement for this week. Southern-hemisphere viewers get the
 * month shifted by six — July there calls for branches, not sunflowers.
 */
export function arrangementForDate(date: Date, latitude = 35): Arrangement {
  const shift = latitude < 0 ? 6 : 0;
  const month = (date.getMonth() + shift) % 12;
  const candidates = MONTH_ROTATION[month];
  const week = Math.floor(date.getTime() / WEEK_MS);
  const id = candidates[((week % candidates.length) + candidates.length) % candidates.length];
  // Every MONTH_ROTATION id is verified against the catalog by tests.
  return findArrangement(id) as Arrangement;
}
