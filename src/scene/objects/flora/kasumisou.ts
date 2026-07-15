import * as THREE from "three";
import { layoutBouquet } from "../../../engine/geometry/flowerLayout";
import { mulberry32 } from "../../../engine/geometry/prng";
import { attachBreeze } from "../flowers";

const DOTS_PER_STEM = 30;

export interface KasumisouOptions {
  paletteHex: readonly number[];
  stemCount: number;
  seed: number;
  vaseRimYM: number;
  vaseNeckRadiusM: number;
}

/** A mist of tiny white dots hovering in a cloud over hair-thin stems. */
export function createKasumisouGroup(opts: KasumisouOptions): THREE.Group {
  const stems = layoutBouquet(opts);
  const group = new THREE.Group();
  const stemGroups: THREE.Group[] = [];
  const rand = mulberry32(opts.seed + 71);

  const stemMaterial = new THREE.MeshStandardMaterial({ color: 0x6b8258, roughness: 0.75 });
  const dotGeometry = new THREE.SphereGeometry(1, 5, 4);
  const dotMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75 });

  const matrix = new THREE.Matrix4();
  const color = new THREE.Color();
  const tint = new THREE.Color(opts.paletteHex[0] ?? 0xf5f4ee);

  for (const stem of stems) {
    const stemGroup = new THREE.Group();
    const curve = new THREE.CatmullRomCurve3(
      stem.controlPoints.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    );
    const stemMesh = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 20, 0.0012, 5, false),
      stemMaterial,
    );
    stemMesh.castShadow = true;
    stemGroup.add(stemMesh);

    // The cloud: dots scattered in a flattened sphere around the stem tip,
    // denser toward the center like a real gypsophila spray.
    const tip = curve.getPointAt(1);
    const cloudR = stem.headRadiusM * 0.55;
    const dots = new THREE.InstancedMesh(dotGeometry, dotMaterial, DOTS_PER_STEM);
    dots.castShadow = true;
    for (let k = 0; k < DOTS_PER_STEM; k++) {
      const r = cloudR * Math.sqrt(rand());
      const theta = rand() * Math.PI * 2;
      const phi = Math.acos(2 * rand() - 1);
      const s = 0.0016 + rand() * 0.0012;
      matrix.makeScale(s, s, s);
      matrix.setPosition(
        tip.x + r * Math.sin(phi) * Math.cos(theta),
        tip.y + r * Math.cos(phi) * 0.75,
        tip.z + r * Math.sin(phi) * Math.sin(theta),
      );
      dots.setMatrixAt(k, matrix);
      color.copy(tint).offsetHSL(0, 0, (rand() - 0.5) * 0.06);
      dots.setColorAt(k, color);
    }
    dots.instanceMatrix.needsUpdate = true;
    if (dots.instanceColor) dots.instanceColor.needsUpdate = true;
    stemGroup.add(dots);

    group.add(stemGroup);
    stemGroups.push(stemGroup);
  }

  attachBreeze(group, stemGroups);
  return group;
}
