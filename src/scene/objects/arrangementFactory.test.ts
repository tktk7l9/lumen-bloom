// Builds the real Three.js arrangements in node (no WebGL needed to build
// geometry) and checks what the screenshots cannot pin down: every build is
// deterministic, finite through the whole week, inside the room corner, and
// within the per-arrangement triangle/draw-call budget.

import * as THREE from "three";
import { ARRANGEMENTS, type Arrangement, findArrangement } from "../../engine/arrangements";
import type { BloomStage } from "../../engine/bloomCycle";
import { createArrangement } from "./arrangementFactory";

const BUD: BloomStage = { openness: 0, shedProgress: 0 };
const PEAK: BloomStage = { openness: 1, shedProgress: 0 };
const SHED: BloomStage = { openness: 1, shedProgress: 1 };
const WEEK: readonly BloomStage[] = [BUD, { openness: 0.5, shedProgress: 0 }, PEAK, { openness: 1, shedProgress: 0.5 }, SHED];

// The room corner around the vase, in the arrangement's own (unscaled)
// space: the walls sit 0.62 m behind and 0.86 m beside the vase axis, and
// the camera frames roughly 0.8 m of height.
const FRAME = { radiusM: 0.32, minY: -0.025, maxY: 0.8 };
// Guideline used since PR #28: about 30k triangles with the vase, ~40 draw calls.
const TRIANGLE_BUDGET = 30_000;
const DRAW_CALL_BUDGET = 40;
const REBUILT = ["hyacinth", "kuchinashi", "kogiku"] as const;

function build(id: string, stage: BloomStage = PEAK): THREE.Group {
  const group = createArrangement(findArrangement(id) as Arrangement);
  (group.userData.setBloomStage as (s: BloomStage) => void)(stage);
  group.updateMatrixWorld(true);
  return group;
}

function meshes(root: THREE.Object3D): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) out.push(obj);
  });
  return out;
}

/** Triangles and draw calls of one render pass, as PR #28/#30 counted them. */
function census(root: THREE.Object3D): { triangles: number; drawCalls: number } {
  let triangles = 0;
  let drawCalls = 0;
  for (const mesh of meshes(root)) {
    const geometry = mesh.geometry as THREE.BufferGeometry;
    const perInstance = (geometry.index ? geometry.index.count : geometry.getAttribute("position").count) / 3;
    const instances = mesh instanceof THREE.InstancedMesh ? mesh.count : 1;
    triangles += perInstance * instances;
    if (instances > 0) drawCalls++;
  }
  return { triangles, drawCalls };
}

function allFinite(root: THREE.Object3D): boolean {
  return meshes(root).every((mesh) => {
    const arrays = [mesh.geometry.getAttribute("position").array, mesh.matrixWorld.elements];
    if (mesh instanceof THREE.InstancedMesh) arrays.push(mesh.instanceMatrix.array);
    return arrays.every((array) => Array.from(array).every(Number.isFinite));
  });
}

function named(root: THREE.Object3D, name: string): THREE.InstancedMesh[] {
  return meshes(root).filter((m): m is THREE.InstancedMesh => m instanceof THREE.InstancedMesh && m.name === name);
}

function instanceScale(mesh: THREE.InstancedMesh, i: number): number {
  const matrix = new THREE.Matrix4();
  mesh.getMatrixAt(i, matrix);
  return new THREE.Vector3().setFromMatrixScale(matrix).length();
}

describe("arrangement builders", () => {
  it("build every catalog arrangement finite and inside the room corner, all week", () => {
    for (const a of ARRANGEMENTS) {
      for (const stage of [PEAK, SHED]) {
        const group = build(a.id, stage);
        expect(allFinite(group), a.id).toBe(true);
        const box = new THREE.Box3().setFromObject(group);
        expect(box.min.y, a.id).toBeGreaterThanOrEqual(FRAME.minY);
        expect(box.max.y, a.id).toBeLessThanOrEqual(FRAME.maxY);
        for (const v of [box.min.x, box.max.x, box.min.z, box.max.z]) {
          expect(Math.abs(v), a.id).toBeLessThanOrEqual(FRAME.radiusM);
        }
      }
    }
  });
});

describe.each(REBUILT)("rebuilt arrangement %s", (id) => {
  it("is deterministic: two builds place every instance identically", () => {
    const a = meshes(build(id));
    const b = meshes(build(id));
    expect(a.map((m) => m.name)).toEqual(b.map((m) => m.name));
    a.forEach((mesh, i) => {
      expect(Array.from(mesh.geometry.getAttribute("position").array)).toEqual(
        Array.from(b[i].geometry.getAttribute("position").array),
      );
      if (mesh instanceof THREE.InstancedMesh) {
        const other = b[i] as THREE.InstancedMesh;
        expect(mesh.count).toBe(other.count);
        expect(Array.from(mesh.instanceMatrix.array)).toEqual(Array.from(other.instanceMatrix.array));
        expect(mesh.instanceColor?.array).toEqual(other.instanceColor?.array);
      }
    });
  });

  it("stays finite at every stage of the week", () => {
    const group = build(id);
    for (const stage of WEEK) {
      (group.userData.setBloomStage as (s: BloomStage) => void)(stage);
      group.updateMatrixWorld(true);
      expect(allFinite(group)).toBe(true);
    }
  });

  it("keeps within the triangle and draw-call budget, in bloom and fully shed", () => {
    for (const stage of [PEAK, SHED]) {
      const { triangles, drawCalls } = census(build(id, stage));
      expect(triangles).toBeLessThanOrEqual(TRIANGLE_BUDGET);
      expect(drawCalls).toBeLessThanOrEqual(DRAW_CALL_BUDGET);
    }
  });

  it("stands its flowers above the vase rim", () => {
    const a = findArrangement(id) as Arrangement;
    const rimY = a.vase.profile.heightM as number;
    const group = build(id);
    const flowers = meshes(group).filter((m) => /florets|petals|rays|discs/.test(m.name));
    expect(flowers.length).toBeGreaterThan(0);
    for (const mesh of flowers) {
      const box = new THREE.Box3().setFromObject(mesh);
      expect(box.min.y).toBeGreaterThan(rimY - 0.02);
    }
  });
});

describe("hyacinth", () => {
  it("carries a dense raceme of star florets and two strap leaves on every stem", () => {
    const group = build("hyacinth");
    const racemes = named(group, "hyacinth-florets");
    const stems = (findArrangement("hyacinth") as Arrangement).flora.stemCount;
    expect(racemes).toHaveLength(stems);
    for (const raceme of racemes) {
      expect(raceme.count).toBeGreaterThanOrEqual(30);
      expect(raceme.count).toBeLessThanOrEqual(42);
      // A six-lobed star floret, not a bead.
      expect(raceme.geometry.getAttribute("position").count).toBe(42);
    }
    expect(named(group, "hyacinth-leaves").map((m) => m.count)).toEqual(Array(stems).fill(2));
  });

  it("opens from the bottom: the top of each raceme is still in small closed buds", () => {
    for (const raceme of named(build("hyacinth"), "hyacinth-florets")) {
      const n = raceme.count;
      const lower = Array.from({ length: Math.floor(n / 4) }, (_, i) => instanceScale(raceme, i));
      const top = instanceScale(raceme, n - 1);
      expect(top).toBeLessThan(0.6 * Math.min(...lower));
    }
  });

  it("drops the florets in the week's shed window, the lowest first", () => {
    const group = build("hyacinth", { openness: 1, shedProgress: 0.3 });
    for (const raceme of named(group, "hyacinth-florets")) {
      expect(instanceScale(raceme, 0)).toBe(0);
      expect(instanceScale(raceme, raceme.count - 1)).toBeGreaterThan(0);
    }
  });
});

describe("kuchinashi (gardenia)", () => {
  it("opens a 22-petal double bloom on all but one twig of each branch, the last a twisted bud", () => {
    const group = build("kuchinashi");
    const branches = (findArrangement("kuchinashi") as Arrangement).flora.stemCount;
    // Main branch + two side shoots per branch.
    expect(named(group, "gardenia-petals").map((m) => m.count)).toEqual(Array(branches).fill(22 * 2));
    expect(named(group, "gardenia-buds").map((m) => m.count)).toEqual(Array(branches).fill(1));
    for (const leaves of named(group, "gardenia-leaves")) {
      // Opposite pairs only.
      expect(leaves.count % 2).toBe(0);
      expect(leaves.count).toBeGreaterThanOrEqual(12);
    }
  });

  it("furls the petals into a bud before the week's opening", () => {
    const petalsAt = (stage: BloomStage): number[] => {
      const [petals] = named(build("kuchinashi", stage), "gardenia-petals");
      return Array.from({ length: petals.count }, (_, i) => instanceScale(petals, i));
    };
    const bud = petalsAt(BUD);
    const open = petalsAt(PEAK);
    // Instance matrices are float32.
    bud.forEach((s, i) => expect(s).toBeCloseTo(open[i] * 0.5, 6));
  });

  it("yellows the petals as the flowers age toward the end of the week", () => {
    const tone = (stage: BloomStage): { blue: number; red: number } => {
      const [petals] = named(build("kuchinashi", stage), "gardenia-petals");
      const c = new THREE.Color();
      petals.getColorAt(0, c);
      return { blue: c.b, red: c.r };
    };
    const fresh = tone(PEAK);
    const aged = tone(SHED);
    expect(aged.blue).toBeLessThan(fresh.blue * 0.75);
    expect(aged.red).toBeGreaterThan(aged.blue);
  });
});

describe("kogiku", () => {
  it("branches every stem into a spray: five open heads and two buds", () => {
    const group = build("kogiku");
    const stems = (findArrangement("kogiku") as Arrangement).flora.stemCount;
    const discs = named(group, "kogiku-discs");
    expect(discs.map((m) => m.count)).toEqual(Array(stems).fill(5));
    expect(named(group, "kogiku-buds").map((m) => m.count)).toEqual(Array(stems).fill(2));
    // Two rows of rays per open head: 18 + 14.
    expect(named(group, "kogiku-rays").map((m) => m.count)).toEqual(Array(stems).fill(5 * 32));
    expect(named(group, "kogiku-leaves").map((m) => m.count)).toEqual(Array(stems).fill(6));
  });

  it("spreads a spray's heads around its stem instead of stacking them", () => {
    for (const discs of named(build("kogiku"), "kogiku-discs")) {
      const centers = Array.from({ length: discs.count }, (_, i) => {
        const m = new THREE.Matrix4();
        discs.getMatrixAt(i, m);
        return new THREE.Vector3().setFromMatrixPosition(m);
      });
      for (let i = 0; i < centers.length; i++) {
        for (let j = i + 1; j < centers.length; j++) {
          expect(centers[i].distanceTo(centers[j])).toBeGreaterThan(0.01);
        }
      }
    }
  });
});
