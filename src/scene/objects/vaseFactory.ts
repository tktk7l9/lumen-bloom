import * as THREE from "three";
import { DEFAULT_VASE_PROFILE } from "../../engine/geometry/vaseProfile";
import { createFlowersGroup } from "./flowers";
import { registerSceneObject } from "./registry";
import { createVaseMesh } from "./vase";

export const VASE_OBJECT_ID = "vase-flowers";

registerSceneObject({
  id: VASE_OBJECT_ID,
  displayName: "花瓶と花",
  create(): THREE.Group {
    const group = new THREE.Group();
    group.add(createVaseMesh());
    group.add(
      createFlowersGroup({
        vaseRimYM: DEFAULT_VASE_PROFILE.heightM,
        vaseNeckRadiusM: DEFAULT_VASE_PROFILE.neckRadiusM,
      }),
    );
    return group;
  },
});
