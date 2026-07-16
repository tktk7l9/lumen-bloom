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
  createMargaretGroup,
} from "./flora/daisy";
import { createHydrangeaGroup } from "./flora/hydrangea";
import { createKasumisouGroup } from "./flora/kasumisou";
import { createLavenderGroup } from "./flora/lavender";
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
