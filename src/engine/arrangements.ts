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
  | "muscari"
  | "poppy"
  | "kikyou"
  | "iris"
  | "higanbana"
  | "susuki"
  | "camellia"
  | "sazanka"
  | "osmanthus"
  | "hellebore"
  | "clematis"
  | "shumeigiku"
  | "tsuwabuki"
  | "kogiku"
  | "hyacinth"
  | "waremokou"
  | "hozuki"
  | "nanohana"
  | "allium"
  | "ominaeshi"
  | "amaryllis"
  | "asagao"
  | "gladiolus"
  | "wisteria"
  | "pine"
  | "magnolia"
  | "gardenia"
  | "dogwood"
  | "blossomBranch"
  | "leafBranch"
  | "berryBranch";

/** Kinds built on the cut-branch rig — these carry a bark color. */
export const BRANCH_KINDS: readonly FloraKind[] = [
  "blossomBranch",
  "leafBranch",
  "berryBranch",
  "camellia",
  "sazanka",
  "osmanthus",
  "wisteria",
  "pine",
  "magnolia",
  "gardenia",
  "dogwood",
];

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
      "夏を代表する一年草。つぼみの頃は太陽を追って東から西へ向きを変え、咲いてからは東を向いたまま止まる。種の並びはフィボナッチ数の螺旋を描く。花言葉は「憧れ」。",
    flora: { kind: "sunflower", paletteHex: [], stemCount: 4, seed: 5 },
    vase: { profile: {}, style: { kind: "glass", colorHex: 0xf4fbf9 } },
  },
  {
    id: "tulip",
    name: "チューリップ",
    description:
      "春の球根花。気温が上がると開き、下がると閉じる動きを繰り返し、切り花になっても水を吸って伸び続ける。花言葉は「思いやり」。",
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
      "「難を転ずる」に通じる縁起木として、正月飾りに使われ、鬼門にも植えられてきた冬の実もの。艶やかな赤い実は雪景色によく映える。花言葉は「福をなす」。",
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
      "雪の残る頃から咲き始める冬の花。うつむき加減に咲く白い花弁の中心に、小さな杯のような黄色い副花冠を持つ。花言葉は「自己愛」「うぬぼれ」——水鏡に見とれたナルキッソスの伝説から。",
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
      "皇室の紋にも使われる菊が欧米で品種改良され、洋花として里帰りしたのが「マム」。細い花弁がびっしりと重なる姿は晩秋の贅沢。重陽の節句(9月9日)は菊の節句。花言葉は「高貴」。",
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
      "秋の野に凛と咲く青紫の花。根は苦い生薬「竜胆(りゅうたん)」で、病に打ち勝つ花とされたことと、紫が高貴な色であることから敬老の日の贈り物に定着した。花言葉は「勝利」「正義感」。",
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
  {
    id: "roubai",
    name: "蝋梅",
    description:
      "年の瀬から早春にかけ、葉のない枝に蝋細工のような半透明の黄色い花を咲かせる。名に梅とつくがバラ科の梅とは別のロウバイ科で、甘い香りが強い。花言葉は「慈愛」「先見」。",
    flora: {
      kind: "blossomBranch",
      paletteHex: [0xf0cf4a, 0x8a3a3a],
      branchHex: 0x5a4a3c,
      stemCount: 3,
      seed: 31,
    },
    vase: {
      profile: { heightM: 0.36, neckRadiusM: 0.042, bellyRadiusM: 0.05, baseRadiusM: 0.056 },
      style: { kind: "ceramic", colorHex: 0x3b4a4e },
    },
  },
  {
    id: "tsubaki",
    name: "椿",
    description:
      "艶のある濃い緑の葉に赤い花が映える、冬から春の花木。花びらと雄しべの根元がつながっているため、散るときは花ごとぽとりと落ちる。花言葉は「控えめな優しさ」「誇り」。",
    flora: {
      kind: "camellia",
      paletteHex: [0xc5262c, 0xf0c94a, 0x2d5a2b],
      branchHex: 0x4a3a30,
      stemCount: 3,
      seed: 32,
    },
    vase: {
      profile: { heightM: 0.32, neckRadiusM: 0.044, bellyRadiusM: 0.056, baseRadiusM: 0.058 },
      style: { kind: "ceramic", colorHex: 0xe9e4da },
    },
  },
  {
    id: "sazanka",
    name: "山茶花",
    description:
      "晩秋から初冬、花の少ない季節に咲く。椿によく似るが、花ごと落ちる椿と違って花びらが一枚ずつ散る。童謡「たきび」にも歌われた垣根の花。花言葉は「困難に打ち克つ」「ひたむきさ」。",
    flora: {
      kind: "sazanka",
      paletteHex: [0xe88aa8, 0xf0c94a, 0x2f5c2c],
      branchHex: 0x4a3a30,
      stemCount: 3,
      seed: 33,
    },
    vase: {
      profile: { heightM: 0.32, neckRadiusM: 0.044, bellyRadiusM: 0.056, baseRadiusM: 0.058 },
      style: { kind: "ceramic", colorHex: 0x2a2c33 },
    },
  },
  {
    id: "eucalyptus",
    name: "ユーカリ",
    description:
      "銀色がかった丸い葉が人気の枝物。オーストラリア原産でコアラの食樹として知られ、葉には清涼感のある香りがある。乾いても色と形が残り、冬のスワッグやリースの定番。花言葉は「再生」「思い出」。",
    flora: {
      kind: "leafBranch",
      paletteHex: [0x8fa697, 0xa6b9ab, 0x7b937f],
      branchHex: 0x6b5a48,
      stemCount: 3,
      seed: 34,
    },
    vase: {
      profile: { heightM: 0.34, neckRadiusM: 0.046, bellyRadiusM: 0.056, baseRadiusM: 0.058 },
      style: { kind: "glass", colorHex: 0xd9c8b0 },
    },
  },
  {
    id: "momo",
    name: "桃",
    description:
      "ひな祭り(桃の節句)に飾る花木。古く中国から伝わり、邪気を払う力があると信じられてきた。梅より遅く桜より少し早く、濃い桃色の花を枝いっぱいに咲かせる。花言葉は「チャーミング」「私はあなたのとりこ」。",
    flora: {
      kind: "blossomBranch",
      paletteHex: [0xf07aa6, 0xf6e2a0],
      branchHex: 0x5c4536,
      stemCount: 3,
      seed: 35,
    },
    vase: {
      profile: { heightM: 0.36, neckRadiusM: 0.046, bellyRadiusM: 0.056, baseRadiusM: 0.058 },
      style: { kind: "ceramic", colorHex: 0xf2ece2 },
    },
  },
  {
    id: "rappa-suisen",
    name: "ラッパ水仙",
    description:
      "春の花壇を明るくする黄色い水仙。副花冠が花びらと同じかそれ以上に長く突き出し、ラッパのように見える。英国ウェールズの国花でもある。花言葉は「尊敬」「報われぬ恋」。",
    flora: {
      kind: "narcissus",
      paletteHex: [0xf2d24a, 0xe8961e],
      stemCount: 5,
      seed: 36,
    },
    vase: {
      profile: { heightM: 0.28, neckRadiusM: 0.042, bellyRadiusM: 0.054, baseRadiusM: 0.05 },
      style: { kind: "glass", colorHex: 0xf4fbf9 },
    },
  },
  {
    id: "muscari",
    name: "ムスカリ",
    description:
      "ブドウの房のように小さな壺形の花を連ねる春の球根花。英名はグレープヒヤシンス。チューリップの足元を青く染める名脇役で、一輪挿しにも向く。花言葉は「明るい未来」「通じ合う心」。",
    flora: {
      kind: "muscari",
      paletteHex: [0x3f55c2, 0x4a4fb8],
      stemCount: 7,
      seed: 37,
    },
    vase: {
      profile: { heightM: 0.22, neckRadiusM: 0.032, bellyRadiusM: 0.046, baseRadiusM: 0.044 },
      style: { kind: "glass", colorHex: 0xf4fbf9 },
    },
  },
  {
    id: "poppy",
    name: "ポピー",
    description:
      "薄紙をくしゃっと広げたような花びらが春風に揺れる。毛に覆われたつぼみはうつむいているが、咲くときに2枚の萼を落として上を向く。切り花はアイスランドポピーが主流。花言葉は「いたわり」「思いやり」。",
    flora: {
      kind: "poppy",
      paletteHex: [0xf08a2e, 0xf2d040, 0xf6efe4, 0xee9a8a],
      stemCount: 6,
      seed: 38,
    },
    vase: {
      profile: { heightM: 0.27, neckRadiusM: 0.036, bellyRadiusM: 0.05, baseRadiusM: 0.048 },
      style: { kind: "glass", colorHex: 0xd7dee6 },
    },
  },
  {
    id: "botan",
    name: "牡丹",
    description:
      "「百花の王」と称えられる春の大輪。芍薬とよく似るが、芍薬が草なのに対し牡丹は木で、ひと足早い4月下旬から咲く。花言葉は「風格」「富貴」。",
    flora: {
      kind: "peony",
      paletteHex: [0xb0224a, 0xf3ece6, 0xd94a7a],
      stemCount: 3,
      seed: 39,
    },
    vase: {
      profile: { heightM: 0.26, neckRadiusM: 0.055, bellyRadiusM: 0.09, baseRadiusM: 0.06 },
      style: { kind: "ceramic", colorHex: 0x1e2a3a },
    },
  },
  {
    id: "ayame",
    name: "アヤメ",
    description:
      "5月、乾いた草地に咲く紫の花。外側の花びらの付け根に黄色地の網目模様があり、「文目(あやめ)」の名の由来とされる。水辺に咲く杜若や花菖蒲とは生える場所で見分けられる。花言葉は「よい便り」「希望」。",
    flora: {
      kind: "iris",
      paletteHex: [0x5b3fa8, 0x6a4fb8],
      stemCount: 4,
      seed: 40,
    },
    vase: {
      profile: { heightM: 0.3, neckRadiusM: 0.042, bellyRadiusM: 0.056, baseRadiusM: 0.054 },
      style: { kind: "ceramic", colorHex: 0x2f3b3a },
    },
  },
  {
    id: "hanashoubu",
    name: "花菖蒲",
    description:
      "梅雨の水辺を彩る、江戸時代に品種改良が進んだ日本の園芸花。花びらの付け根の黄色い筋が目印。端午の節句の菖蒲湯に使うショウブは別の植物。花言葉は「うれしい知らせ」「優雅」。",
    flora: {
      kind: "iris",
      paletteHex: [0x6f55b8, 0xf2eef8, 0x9a7fcf],
      stemCount: 4,
      seed: 41,
    },
    vase: {
      profile: { heightM: 0.3, neckRadiusM: 0.044, bellyRadiusM: 0.058, baseRadiusM: 0.056 },
      style: { kind: "ceramic", colorHex: 0xdde6ec },
    },
  },
  {
    id: "annabelle",
    name: "アナベル",
    description:
      "北米原産のアメリカノリノキの園芸品種。咲き始めは淡い緑、やがて真っ白な手まり咲きになり、終わりにまた緑へ戻る。土の酸度で色が変わらない紫陽花。花言葉は「ひたむきな愛」「辛抱強い愛情」。",
    flora: {
      kind: "hydrangea",
      paletteHex: [0xf4f4ec, 0xe8efd8, 0xf7f6f0],
      stemCount: 3,
      seed: 42,
    },
    vase: {
      profile: { heightM: 0.24, neckRadiusM: 0.06, bellyRadiusM: 0.085, baseRadiusM: 0.06 },
      style: { kind: "glass", colorHex: 0xf4fbf9 },
    },
  },
  {
    id: "sukashiyuri",
    name: "スカシユリ",
    description:
      "初夏、杯のように上を向いて咲く橙色のユリ。花びらの付け根が細く、隙間が透けて見えることが名の由来。香りはほとんどない。花言葉は「注目を浴びる」「飾らぬ美」。",
    flora: {
      kind: "lily",
      paletteHex: [0xe8742a, 0xf2a036],
      stemCount: 3,
      seed: 43,
    },
    vase: {
      profile: { heightM: 0.34, neckRadiusM: 0.052, bellyRadiusM: 0.064, baseRadiusM: 0.058 },
      style: { kind: "ceramic", colorHex: 0x24262c },
    },
  },
  {
    id: "kikyou",
    name: "桔梗",
    description:
      "万葉の昔から親しまれる秋の七草のひとつ。紙風船のようにふくらんだつぼみが、星の形にぱっと開く。実際の花期は早く、6月頃から咲き始める。花言葉は「永遠の愛」「誠実」。",
    flora: {
      kind: "kikyou",
      paletteHex: [0x5a4cc0, 0x6c5cd0, 0xf2f0f6],
      stemCount: 5,
      seed: 44,
    },
    vase: {
      profile: { heightM: 0.29, neckRadiusM: 0.04, bellyRadiusM: 0.054, baseRadiusM: 0.052 },
      style: { kind: "ceramic", colorHex: 0xafc9ba },
    },
  },
  {
    id: "lisianthus",
    name: "トルコキキョウ",
    description:
      "名にトルコとキキョウを持つが、北米原産のリンドウ科の花。日本で品種改良が進み、バラのような八重咲きが世界で人気になった。夏でも日持ちがよい。花言葉は「優美」「希望」。",
    flora: {
      kind: "rose",
      paletteHex: [0x7a5cc2, 0xf4f0ec, 0xc9b6e4],
      stemCount: 4,
      seed: 45,
    },
    vase: {
      profile: { heightM: 0.28, neckRadiusM: 0.05, bellyRadiusM: 0.07, baseRadiusM: 0.056 },
      style: { kind: "glass", colorHex: 0xf4fbf9 },
    },
  },
  {
    id: "kibana-cosmos",
    name: "キバナコスモス",
    description:
      "メキシコ原産、暑さに強く夏のうちから咲く黄色や橙のコスモス。秋桜とは同じ属の別種で、互いに交配はできない。花言葉は「野性的な美しさ」「幼い恋心」。",
    flora: {
      kind: "cosmos",
      paletteHex: [0xf0862a, 0xf2b63a, 0xe86a26],
      stemCount: 6,
      seed: 46,
    },
    vase: {
      profile: { heightM: 0.3, neckRadiusM: 0.035, bellyRadiusM: 0.045, baseRadiusM: 0.045 },
      style: { kind: "ceramic", colorHex: 0x3b4a4e },
    },
  },
  {
    id: "higanbana",
    name: "彼岸花",
    description:
      "秋の彼岸の頃、葉のない茎をすっと伸ばして炎のような赤い花を咲かせる。葉は花が終わってから出るので「葉見ず花見ず」とも。別名は曼珠沙華。花言葉は「情熱」「再会」「また会う日を楽しみに」。",
    flora: {
      kind: "higanbana",
      paletteHex: [0xd8261f, 0xe0322a],
      stemCount: 5,
      seed: 47,
    },
    vase: {
      profile: { heightM: 0.32, neckRadiusM: 0.04, bellyRadiusM: 0.05, baseRadiusM: 0.054 },
      style: { kind: "ceramic", colorHex: 0x24262c },
    },
  },
  {
    id: "susuki",
    name: "ススキ",
    description:
      "秋の七草のひとつ「尾花」。十五夜には稲穂に見立てて月見団子とともに供え、豊作を祈り魔除けとした。穂は開くにつれて銀白色に光る。花言葉は「活力」「心が通じる」。",
    flora: {
      kind: "susuki",
      paletteHex: [0xe4d8bc, 0xd6c8a4],
      stemCount: 6,
      seed: 48,
    },
    vase: {
      profile: { heightM: 0.38, neckRadiusM: 0.038, bellyRadiusM: 0.046, baseRadiusM: 0.056 },
      style: { kind: "ceramic", colorHex: 0x2a2c33 },
    },
  },
  {
    id: "kinmokusei",
    name: "金木犀",
    description:
      "秋の訪れを香りで告げる花木。橙色の小花は一週間ほどで散り、地面を金色に染める。日本にあるのはほとんどが雄株で、実を結ぶことはまずない。花言葉は「謙虚」「気高い人」。",
    flora: {
      kind: "osmanthus",
      paletteHex: [0xe9781c, 0x2a4a26],
      branchHex: 0x5a4c3e,
      stemCount: 4,
      seed: 49,
    },
    vase: {
      profile: { heightM: 0.34, neckRadiusM: 0.046, bellyRadiusM: 0.056, baseRadiusM: 0.058 },
      style: { kind: "ceramic", colorHex: 0xe8e2d6 },
    },
  },
  {
    id: "murasakishikibu",
    name: "紫式部",
    description:
      "秋、枝に沿って紫色の小さな実をびっしりとつける。名は『源氏物語』の作者・紫式部にちなむ。庭や花屋で見かけるのは、実つきのよい近縁のコムラサキが多い。花言葉は「聡明」「上品」「愛され上手」。",
    flora: {
      kind: "berryBranch",
      paletteHex: [0x8a4fb8, 0x6f8a44],
      branchHex: 0x5c4a3c,
      stemCount: 3,
      seed: 50,
    },
    vase: {
      profile: { heightM: 0.34, neckRadiusM: 0.044, bellyRadiusM: 0.054, baseRadiusM: 0.056 },
      style: { kind: "glass", colorHex: 0xf4fbf9 },
    },
  },
  {
    id: "nokongiku",
    name: "ノコンギク",
    description:
      "秋の野山を彩る「野菊」の代表種。淡い紫の花びらと黄色い芯が素朴で、伊藤左千夫の小説『野菊の墓』で知られる野菊もこの仲間。花言葉は「守護」「忘れられない想い」。",
    flora: {
      kind: "margaret",
      paletteHex: [0xb9a8dc, 0xcdbfe6, 0xa795d0],
      stemCount: 6,
      seed: 51,
    },
    vase: {
      profile: { heightM: 0.24, neckRadiusM: 0.045, bellyRadiusM: 0.055, baseRadiusM: 0.05 },
      style: { kind: "ceramic", colorHex: 0xb0603f },
    },
  },
  {
    id: "hakubai",
    name: "白梅",
    description:
      "「梅は百花の魁」と呼ばれ、寒さの底の一月から他の花に先駆けて開き、春を告げる。菅原道真が「東風吹かば」と詠んで別れを惜しんだのも、庭の梅と伝わる。花言葉は白梅が「気品」、紅梅が「優美」。",
    flora: {
      kind: "blossomBranch",
      paletteHex: [0xf8f5ee, 0xe9c84a],
      branchHex: 0x3a2d26,
      stemCount: 3,
      seed: 52,
    },
    vase: {
      profile: { heightM: 0.36, neckRadiusM: 0.042, bellyRadiusM: 0.052, baseRadiusM: 0.058 },
      style: { kind: "ceramic", colorHex: 0x3b2f2a },
    },
  },
  {
    id: "matsu",
    name: "松",
    description:
      "冬も緑を失わず長命なことから、古くから神の宿る木、長寿の象徴とされてきた。正月の門松は年神を家に迎えるための依り代で、飾っておく期間を「松の内」と呼ぶ。花言葉は「不老長寿」「永遠の若さ」。",
    flora: {
      kind: "pine",
      paletteHex: [0x3f6b3a],
      branchHex: 0x4a3a2c,
      stemCount: 3,
      seed: 53,
    },
    vase: {
      profile: { heightM: 0.36, neckRadiusM: 0.044, bellyRadiusM: 0.054, baseRadiusM: 0.058 },
      style: { kind: "ceramic", colorHex: 0x24262c },
    },
  },
  {
    id: "hyacinth",
    name: "ヒヤシンス",
    description:
      "地中海東部生まれの球根花で、一本の茎に星形の小花を連ねて甘く香る。庭では三〜四月に咲くが、冬に水栽培すれば室内でひと足早く開く。ギリシャ神話では美少年ヒュアキントスの血から咲いたと伝わる。花言葉は「スポーツ」「悲しみを超えた愛」。",
    flora: {
      kind: "hyacinth",
      paletteHex: [0xe88ab8, 0x6a6fd0, 0xf4f1ea],
      stemCount: 5,
      seed: 54,
    },
    vase: {
      profile: { heightM: 0.22, neckRadiusM: 0.04, bellyRadiusM: 0.055, baseRadiusM: 0.05 },
      style: { kind: "glass", colorHex: 0xf4fbf9 },
    },
  },
  {
    id: "hellebore",
    name: "クリスマスローズ",
    description:
      "名にローズとつくがバラではなくキンポウゲ科。花びらに見える部分は萼で、花の少ない冬から早春にうつむいて咲く。名はクリスマスの頃に咲く白花の原種ニゲルに由来し、多くの品種は年明けから春に開く。花言葉は「慰め」「私の不安をやわらげて」。",
    flora: {
      kind: "hellebore",
      paletteHex: [0xeef0e2, 0xd9a3b4, 0x6a3458],
      stemCount: 6,
      seed: 55,
    },
    vase: {
      profile: { heightM: 0.24, neckRadiusM: 0.044, bellyRadiusM: 0.058, baseRadiusM: 0.052 },
      style: { kind: "ceramic", colorHex: 0xdde6ec },
    },
  },
  {
    id: "nanohana",
    name: "菜の花",
    description:
      "早春の野を黄色に染めるアブラナ科の花。四枚の花びらが十字に開くので、かつては十字花科とも呼ばれた。つぼみは菜花として食卓に上り、種からは菜種油が採れる。蕪村の「菜の花や月は東に日は西に」でも名高い。花言葉は「快活」「明るさ」。",
    flora: {
      kind: "nanohana",
      paletteHex: [0xf2d430, 0xf5dd48],
      stemCount: 6,
      seed: 56,
    },
    vase: {
      profile: { heightM: 0.26, neckRadiusM: 0.04, bellyRadiusM: 0.05, baseRadiusM: 0.05 },
      style: { kind: "glass", colorHex: 0xd7dee6 },
    },
  },
  {
    id: "mokuren",
    name: "白木蓮",
    description:
      "葉が出る前の裸の枝に、杯のような大ぶりの白い花を上向きに咲かせる。モクレン科は白亜紀の化石も残る原始的な花木で、つぼみの先はおおむね北を向くとされる。紫のモクレンはこれよりやや遅れて開く。花言葉は「自然への愛」「持続性」。",
    flora: {
      kind: "magnolia",
      paletteHex: [0xf5f0e8, 0xd9c98a, 0x4a6a3a],
      branchHex: 0x5a4a40,
      stemCount: 3,
      seed: 57,
    },
    vase: {
      profile: { heightM: 0.36, neckRadiusM: 0.046, bellyRadiusM: 0.056, baseRadiusM: 0.06 },
      style: { kind: "ceramic", colorHex: 0x2a2c33 },
    },
  },
  {
    id: "fuji",
    name: "藤",
    description:
      "マメ科のつる性の花木で、藤棚から垂れる花房は長いものでは一メートルを超す。日本に自生するノダフジとヤマフジは、つるの巻く向きが互いに逆なのが見分けの決め手。万葉集にも多く詠まれた古くからの花。花言葉は「優しさ」「歓迎」。",
    flora: {
      kind: "wisteria",
      paletteHex: [0xb59be0, 0x6e58b8, 0x7fa05a],
      branchHex: 0x5a4636,
      stemCount: 3,
      seed: 58,
    },
    vase: {
      profile: { heightM: 0.38, neckRadiusM: 0.046, bellyRadiusM: 0.056, baseRadiusM: 0.06 },
      style: { kind: "ceramic", colorHex: 0xe9e4da },
    },
  },
  {
    id: "hanamizuki",
    name: "ハナミズキ",
    description:
      "桜の後を継ぐように四月半ばから咲く。白や桃色の四枚の花びらに見えるのは苞で、本当の花は中央に集まる小さな粒。1912年に東京がワシントンへ桜を贈った返礼として、1915年にアメリカから届いた木でもある。花言葉は「返礼」「永続性」。",
    flora: {
      kind: "dogwood",
      paletteHex: [0xefa9bd, 0x8fb04a],
      branchHex: 0x4f3f33,
      stemCount: 3,
      seed: 59,
    },
    vase: {
      profile: { heightM: 0.36, neckRadiusM: 0.046, bellyRadiusM: 0.056, baseRadiusM: 0.058 },
      style: { kind: "glass", colorHex: 0xf4fbf9 },
    },
  },
  {
    id: "allium",
    name: "アリウム",
    description:
      "ネギやニンニクと同じネギ属の球根花で、属名はラテン語でニンニクを指す。代表種のギガンチウムは初夏、葉のない一メートル余りの茎の先に無数の小花を集め、直径十数センチの紫の球をつくる。花言葉は「深い悲しみ」「正しい主張」。",
    flora: {
      kind: "allium",
      paletteHex: [0x8a4fc0, 0x9a5fd0],
      stemCount: 3,
      seed: 60,
    },
    vase: {
      profile: { heightM: 0.36, neckRadiusM: 0.034, bellyRadiusM: 0.044, baseRadiusM: 0.05 },
      style: { kind: "glass", colorHex: 0xd7dee6 },
    },
  },
  {
    id: "kuchinashi",
    name: "クチナシ",
    description:
      "梅雨どきに純白の花を開き、沈丁花・金木犀と並ぶ三大香木に数えられるアカネ科の花木。実が熟しても割れないことから「口無し」と名がついたとされ、その実は栗きんとんやたくあんを黄色く染める。花言葉は「とても幸せです」「喜びを運ぶ」。",
    flora: {
      kind: "gardenia",
      paletteHex: [0xf7f5ee, 0xe9d98a, 0x254a24],
      branchHex: 0x4a3a30,
      stemCount: 3,
      seed: 61,
    },
    vase: {
      profile: { heightM: 0.3, neckRadiusM: 0.044, bellyRadiusM: 0.056, baseRadiusM: 0.058 },
      style: { kind: "ceramic", colorHex: 0x3b4a4e },
    },
  },
  {
    id: "clematis",
    name: "クレマチス",
    description:
      "「つる性植物の女王」と呼ばれるキンポウゲ科の花。花びらに見える部分は萼で、本当の花びらは持たない。日本に自生するカザグルマや中国原産のテッセンも仲間で、園芸品種を総称してテッセンと呼ぶこともある。花言葉は「精神の美」「旅人の喜び」。",
    flora: {
      kind: "clematis",
      paletteHex: [0x6f4fa8, 0xf2eef6, 0xc25a8a],
      stemCount: 5,
      seed: 62,
    },
    vase: {
      profile: { heightM: 0.28, neckRadiusM: 0.046, bellyRadiusM: 0.06, baseRadiusM: 0.052 },
      style: { kind: "glass", colorHex: 0xaab3bf },
    },
  },
  {
    id: "asagao",
    name: "朝顔",
    description:
      "奈良時代に薬草として中国から渡来し、種は牽牛子という下剤に使われた。花は日の出ではなく、日が沈んでからおよそ十時間たつと開く。江戸の二度の大流行が品種を広げ、七月初めの入谷朝顔市は今も夏の風物詩だ。花言葉は「愛情」「はかない恋」。",
    flora: {
      kind: "asagao",
      paletteHex: [0x3f55b8, 0x8a4fb0, 0xd94a8a],
      stemCount: 5,
      seed: 63,
    },
    vase: {
      profile: { heightM: 0.28, neckRadiusM: 0.044, bellyRadiusM: 0.058, baseRadiusM: 0.054 },
      style: { kind: "glass", colorHex: 0xf4fbf9 },
    },
  },
  {
    id: "gladiolus",
    name: "グラジオラス",
    description:
      "剣のような葉から、ラテン語で剣を意味するグラディウスにちなんで名づけられたアヤメ科の球根花。穂状に並ぶ花は下から上へ順に開き、夏の切り花として七月に出回りの盛りを迎える。和名は唐菖蒲、オランダアヤメ。花言葉は「勝利」「密会」。",
    flora: {
      kind: "gladiolus",
      paletteHex: [0xd8303a, 0xf08aa8, 0xf2d040, 0xf6f1ea],
      stemCount: 4,
      seed: 64,
    },
    vase: {
      profile: { heightM: 0.34, neckRadiusM: 0.046, bellyRadiusM: 0.056, baseRadiusM: 0.06 },
      style: { kind: "ceramic", colorHex: 0x24262c },
    },
  },
  {
    id: "hozuki",
    name: "ホオズキ",
    description:
      "提灯のような橙色の袋は、実を包んで大きく育った萼だ。お盆には先祖の霊を導く灯りに見立てて精霊棚に飾られ、浅草寺の七月九・十日のほおずき市は夏の風物詩。漢字では鬼灯、酸漿と書くナス科の草。花言葉は「偽り」「ごまかし」。",
    flora: {
      kind: "hozuki",
      paletteHex: [0xe8651c],
      stemCount: 5,
      seed: 65,
    },
    vase: {
      profile: { heightM: 0.3, neckRadiusM: 0.04, bellyRadiusM: 0.052, baseRadiusM: 0.054 },
      style: { kind: "ceramic", colorHex: 0x2a2c33 },
    },
  },
  {
    id: "shumeigiku",
    name: "秋明菊",
    description:
      "名に菊とつくがキク科ではなく、キンポウゲ科アネモネの仲間で、花びらに見えるのは萼だ。中国から古くに渡来して野生化し、京都・貴船にちなむ貴船菊の別名を持つ。英名はジャパニーズ・アネモネ。花言葉は「薄れゆく愛」「忍耐」。",
    flora: {
      kind: "shumeigiku",
      paletteHex: [0xf5eef1, 0xe9a0bd],
      stemCount: 5,
      seed: 66,
    },
    vase: {
      profile: { heightM: 0.3, neckRadiusM: 0.044, bellyRadiusM: 0.058, baseRadiusM: 0.054 },
      style: { kind: "ceramic", colorHex: 0xafc9ba },
    },
  },
  {
    id: "ominaeshi",
    name: "オミナエシ",
    description:
      "山上憶良が万葉集で数え上げた秋の七草のひとつ。細い茎の先に粟粒のような黄色い小花を群れ咲かせ、名は粟飯の別名「女飯」が転じたとする説がある。白い花を咲かせる近縁のオトコエシもある。花言葉は「美人」「はかない恋」。",
    flora: {
      kind: "ominaeshi",
      paletteHex: [0xe9c53a],
      stemCount: 7,
      seed: 67,
    },
    vase: {
      profile: { heightM: 0.32, neckRadiusM: 0.036, bellyRadiusM: 0.046, baseRadiusM: 0.05 },
      style: { kind: "ceramic", colorHex: 0x5b6b7e },
    },
  },
  {
    id: "nerine",
    name: "ネリネ",
    description:
      "南アフリカ原産のヒガンバナ科の球根花で、彼岸花によく似た花を秋に咲かせる。光が当たると花びらが宝石のようにきらめくことから、ダイヤモンドリリーの別名を持つ。切り花としての花もちもよい。花言葉は「また会う日を楽しみに」「華やか」。",
    flora: {
      kind: "higanbana",
      paletteHex: [0xf07aa6, 0xf5a0c0],
      stemCount: 5,
      seed: 68,
    },
    vase: {
      profile: { heightM: 0.3, neckRadiusM: 0.04, bellyRadiusM: 0.05, baseRadiusM: 0.054 },
      style: { kind: "glass", colorHex: 0xf4fbf9 },
    },
  },
  {
    id: "waremokou",
    name: "吾亦紅",
    description:
      "秋の野に暗紅色の小さな穂を立てるバラ科の多年草。穂は花びらのない小花の集まりで、赤く見えるのは萼だ。上から下へ咲き進むこの花は、みずから「我もまた紅なり」と唱えたのが名の由来と伝わる。花言葉は「変化」「もの思い」。",
    flora: {
      kind: "waremokou",
      paletteHex: [0x7a2535, 0x8a3040],
      stemCount: 9,
      seed: 69,
    },
    vase: {
      profile: { heightM: 0.3, neckRadiusM: 0.036, bellyRadiusM: 0.046, baseRadiusM: 0.05 },
      style: { kind: "ceramic", colorHex: 0xe8e2d6 },
    },
  },
  {
    id: "tsuwabuki",
    name: "ツワブキ",
    description:
      "花の乏しい晩秋から初冬に、つやのある厚い葉の上へ黄色い花を掲げるキク科の常緑草。名は「艶葉蕗」の転じたものとされ、鹿児島や沖縄では葉柄をフキ同様に食べ、佃煮のキャラブキにもする。花言葉は「謙譲」「困難に負けない」。",
    flora: {
      kind: "tsuwabuki",
      paletteHex: [0xf2c330, 0xe9b520],
      stemCount: 5,
      seed: 70,
    },
    vase: {
      profile: { heightM: 0.26, neckRadiusM: 0.044, bellyRadiusM: 0.056, baseRadiusM: 0.052 },
      style: { kind: "ceramic", colorHex: 0x2f3b3a },
    },
  },
  {
    id: "kogiku",
    name: "小菊",
    description:
      "菊は奈良時代の末から平安の初めに中国から渡ったとされ、古くから仏花や献花に用いられてきた。小菊は枝分かれして小ぶりの花を多数つける種類で、八戸特産の食用菊「阿房宮」のように食卓に上るものもある。花言葉は「高潔」「高尚」。",
    flora: {
      kind: "kogiku",
      paletteHex: [0xf2d24a, 0xf6f1e8, 0xe9a0bd, 0xc97aa8],
      stemCount: 7,
      seed: 83,
    },
    vase: {
      profile: { heightM: 0.26, neckRadiusM: 0.046, bellyRadiusM: 0.058, baseRadiusM: 0.052 },
      style: { kind: "ceramic", colorHex: 0xb0603f },
    },
  },
  {
    id: "amaryllis",
    name: "アマリリス",
    description:
      "中南米生まれのヒガンバナ科の球根花で、園芸上のアマリリスはヒッペアストルム属。空洞の太い茎の先に大輪の花を横向きに二〜四輪開く。本来は五〜六月に咲くが、冷蔵処理した球根や切り花でクリスマスの頃にも楽しまれる。花言葉は「誇り」「おしゃべり」。",
    flora: {
      kind: "amaryllis",
      paletteHex: [0xd42a2a, 0xe24a4a],
      stemCount: 3,
      seed: 72,
    },
    vase: {
      profile: { heightM: 0.34, neckRadiusM: 0.05, bellyRadiusM: 0.06, baseRadiusM: 0.058 },
      style: { kind: "glass", colorHex: 0xeef7f6 },
    },
  },
];

// Seasonal candidates per month (0 = January); the pick cycles week by
// week so consecutive weeks always differ. Every month lists the same
// number of candidates, so the slot index advances continuously across
// month boundaries — an arrangement that stays in season across two
// adjacent months keeps the same slot in both, which means it is never
// shown two weeks in a row and a week straddling the boundary does not
// swap its flowers mid-week. Tests enforce both.
const MONTH_ROTATION: ReadonlyArray<readonly string[]> = [
  ["ume", "suisen", "tsubaki", "roubai", "nanten", "eucalyptus", "hakubai", "matsu"], // Jan
  ["ume", "suisen", "tsubaki", "roubai", "ranunculus", "anemone", "hyacinth", "hellebore"], // Feb
  ["tulip", "sakura", "mimosa", "momo", "rappa-suisen", "muscari", "nanohana", "mokuren"], // Mar
  ["tulip", "sakura", "gerbera", "botan", "margaret", "poppy", "fuji", "hanamizuki"], // Apr
  ["peony", "rose", "ayame", "carnation", "calla", "poppy", "fuji", "allium"], // May
  ["hydrangea", "rose", "hanashoubu", "kasumisou", "calla", "lavender", "kuchinashi", "clematis"], // Jun
  ["sunflower", "sukashiyuri", "kikyou", "annabelle", "doudan", "lavender", "asagao", "gladiolus"], // Jul
  ["sunflower", "lily", "kikyou", "lisianthus", "doudan", "kibana-cosmos", "asagao", "hozuki"], // Aug
  ["cosmos", "rindou", "susuki", "higanbana", "mum", "kibana-cosmos", "shumeigiku", "ominaeshi"], // Sep
  ["cosmos", "kinmokusei", "susuki", "dahlia", "rose", "murasakishikibu", "nerine", "waremokou"], // Oct
  ["sazanka", "mum", "momiji", "dahlia", "nokongiku", "gerbera", "tsuwabuki", "kogiku"], // Nov
  ["sazanka", "suisen", "momiji", "roubai", "nanten", "eucalyptus", "amaryllis", "matsu"], // Dec
];

/** Exposed for tests: which arrangement ids a month can show. */
export function monthCandidates(month: number): readonly string[] {
  return MONTH_ROTATION[month];
}

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
