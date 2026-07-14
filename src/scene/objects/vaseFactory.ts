import * as THREE from "three";
import { DEFAULT_VASE_PROFILE } from "../../engine/geometry/vaseProfile";
import { createFlowersGroup } from "./flowers";
import { registerSceneObject } from "./registry";
import { createVaseGroup } from "./vase";

export const VASE_OBJECT_ID = "vase-flowers";

registerSceneObject({
  id: VASE_OBJECT_ID,
  displayName: "花瓶とひまわり",
  create(): THREE.Group {
    const group = new THREE.Group();
    group.add(createVaseGroup());
    const flowers = createFlowersGroup({
      vaseRimYM: DEFAULT_VASE_PROFILE.heightM,
      vaseNeckRadiusM: DEFAULT_VASE_PROFILE.neckRadiusM,
    });
    group.add(flowers);
    group.userData.update = flowers.userData.update; // breeze hook for the scene rig
    return group;
  },
});
