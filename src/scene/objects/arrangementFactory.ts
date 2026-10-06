import * as THREE from "three";
import type { Arrangement } from "../../engine/arrangements";
import { DEFAULT_VASE_PROFILE } from "../../engine/geometry/vaseProfile";
import { createFlowersGroup } from "./flowers";
import { createBranchesGroup } from "./flora/branches";
import { createCallaGroup } from "./flora/calla";
import {
  createAnemoneGroup,
  createCosmosGroup,
  createGerberaGroup,
  createKikyouGroup,
  createMargaretGroup,
  createPoppyGroup,
} from "./flora/daisy";
import { createHiganbanaGroup } from "./flora/higanbana";
import { createHydrangeaGroup } from "./flora/hydrangea";
import { createIrisGroup } from "./flora/iris";
import { createKasumisouGroup } from "./flora/kasumisou";
import { createLavenderGroup, createMuscariGroup } from "./flora/lavender";
import { createLilyGroup } from "./flora/lily";
import {
  createCarnationGroup,
  createDahliaGroup,
  createMumGroup,
  createPeonyGroup,
  createRanunculusGroup,
  createRoseGroup,
} from "./flora/layeredBloom";
import { createNarcissusGroup } from "./flora/narcissus";
import { createRindouGroup } from "./flora/rindou";
import { createSusukiGroup } from "./flora/susuki";
import { createTulipsGroup } from "./flora/tulips";
import { createVaseGroup } from "./vase";

/** Vessel + flora for one catalog arrangement, breeze hook included. */
export function createArrangement(a: Arrangement): THREE.Group {
  const profile = { ...DEFAULT_VASE_PROFILE, ...a.vase.profile };
  const group = new THREE.Group();

  const common = {
    stemCount: a.flora.stemCount,
    seed: a.flora.seed,
    vaseRimYM: profile.heightM,
    vaseNeckRadiusM: profile.neckRadiusM,
    vaseBaseRadiusM: profile.baseRadiusM,
  };

  let flora: THREE.Group;
  switch (a.flora.kind) {
    case "sunflower":
      flora = createFlowersGroup(common);
      break;
    case "tulip":
      flora = createTulipsGroup({ ...common, paletteHex: a.flora.paletteHex });
      break;
    case "cosmos":
      flora = createCosmosGroup({ ...common, paletteHex: a.flora.paletteHex });
      break;
    case "anemone":
      flora = createAnemoneGroup({ ...common, paletteHex: a.flora.paletteHex });
      break;
    case "gerbera":
      flora = createGerberaGroup({ ...common, paletteHex: a.flora.paletteHex });
      break;
    case "margaret":
      flora = createMargaretGroup({ ...common, paletteHex: a.flora.paletteHex });
      break;
    case "peony":
      flora = createPeonyGroup({ ...common, paletteHex: a.flora.paletteHex });
      break;
    case "dahlia":
      flora = createDahliaGroup({ ...common, paletteHex: a.flora.paletteHex });
      break;
    case "mum":
      flora = createMumGroup({ ...common, paletteHex: a.flora.paletteHex });
      break;
    case "carnation":
      flora = createCarnationGroup({ ...common, paletteHex: a.flora.paletteHex });
      break;
    case "rose":
      flora = createRoseGroup({ ...common, paletteHex: a.flora.paletteHex });
      break;
    case "ranunculus":
      flora = createRanunculusGroup({ ...common, paletteHex: a.flora.paletteHex });
      break;
    case "hydrangea":
      flora = createHydrangeaGroup({ ...common, paletteHex: a.flora.paletteHex });
      break;
    case "narcissus":
      flora = createNarcissusGroup({ ...common, paletteHex: a.flora.paletteHex });
      break;
    case "lily":
      flora = createLilyGroup({ ...common, paletteHex: a.flora.paletteHex });
      break;
    case "lavender":
      flora = createLavenderGroup({ ...common, paletteHex: a.flora.paletteHex });
      break;
    case "kasumisou":
      flora = createKasumisouGroup({ ...common, paletteHex: a.flora.paletteHex });
      break;
    case "rindou":
      flora = createRindouGroup({ ...common, paletteHex: a.flora.paletteHex });
      break;
    case "calla":
      flora = createCallaGroup({ ...common, paletteHex: a.flora.paletteHex });
      break;
    case "muscari":
      flora = createMuscariGroup({ ...common, paletteHex: a.flora.paletteHex });
      break;
    case "poppy":
      flora = createPoppyGroup({ ...common, paletteHex: a.flora.paletteHex });
      break;
    case "kikyou":
      flora = createKikyouGroup({ ...common, paletteHex: a.flora.paletteHex });
      break;
    case "iris":
      flora = createIrisGroup({ ...common, paletteHex: a.flora.paletteHex });
      break;
    case "higanbana":
      flora = createHiganbanaGroup({ ...common, paletteHex: a.flora.paletteHex });
      break;
    case "susuki":
      flora = createSusukiGroup({ ...common, paletteHex: a.flora.paletteHex });
      break;
    case "osmanthus":
      flora = createBranchesGroup({
        branchCount: a.flora.stemCount,
        seed: a.flora.seed,
        branchHex: a.flora.branchHex ?? 0x5a4c3e,
        adorn: {
          type: "osmanthus",
          flowerHex: a.flora.paletteHex[0] ?? 0xe9781c,
          leafHex: a.flora.paletteHex[1] ?? 0x2a4a26,
        },
        vaseRimYM: profile.heightM,
        vaseNeckRadiusM: profile.neckRadiusM,
        vaseBaseRadiusM: profile.baseRadiusM,
      });
      break;
    case "camellia":
    case "sazanka":
      flora = createBranchesGroup({
        branchCount: a.flora.stemCount,
        seed: a.flora.seed,
        branchHex: a.flora.branchHex ?? 0x4a3a30,
        adorn: {
          type: "camellia",
          petalHex: a.flora.paletteHex[0] ?? 0xc5262c,
          stamenHex: a.flora.paletteHex[1] ?? 0xf0c94a,
          leafHex: a.flora.paletteHex[2] ?? 0x2d5a2b,
          form: a.flora.kind === "camellia" ? "cup" : "flat",
        },
        vaseRimYM: profile.heightM,
        vaseNeckRadiusM: profile.neckRadiusM,
        vaseBaseRadiusM: profile.baseRadiusM,
      });
      break;
    case "blossomBranch":
      flora = createBranchesGroup({
        branchCount: a.flora.stemCount,
        seed: a.flora.seed,
        branchHex: a.flora.branchHex ?? 0x3a2d26,
        adorn: {
          type: "blossom",
          petalHex: a.flora.paletteHex[0] ?? 0xe86a8a,
          centerHex: a.flora.paletteHex[1] ?? 0xf0d24a,
        },
        vaseRimYM: profile.heightM,
        vaseNeckRadiusM: profile.neckRadiusM,
        vaseBaseRadiusM: profile.baseRadiusM,
      });
      break;
    case "leafBranch":
      flora = createBranchesGroup({
        branchCount: a.flora.stemCount,
        seed: a.flora.seed,
        branchHex: a.flora.branchHex ?? 0x40332a,
        adorn: { type: "leaf", leafHexes: a.flora.paletteHex },
        vaseRimYM: profile.heightM,
        vaseNeckRadiusM: profile.neckRadiusM,
        vaseBaseRadiusM: profile.baseRadiusM,
      });
      break;
    case "berryBranch":
      flora = createBranchesGroup({
        branchCount: a.flora.stemCount,
        seed: a.flora.seed,
        branchHex: a.flora.branchHex ?? 0x3d3128,
        adorn: {
          type: "berry",
          berryHex: a.flora.paletteHex[0] ?? 0xc22b2a,
          leafHex: a.flora.paletteHex[1] ?? 0x4e6b30,
        },
        vaseRimYM: profile.heightM,
        vaseNeckRadiusM: profile.neckRadiusM,
        vaseBaseRadiusM: profile.baseRadiusM,
      });
      break;
  }

  group.add(createVaseGroup(a.vase.profile, a.vase.style));
  group.add(flora);
  group.userData.update = flora.userData.update;
  group.userData.setBloomStage = flora.userData.setBloomStage;
  return group;
}
