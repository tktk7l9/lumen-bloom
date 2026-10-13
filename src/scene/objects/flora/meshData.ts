import * as THREE from "three";
import type { MeshData } from "../../../engine/geometry/floraMeshes";
import type { Point3 } from "../../../engine/geometry/flowerLayout";

/**
 * Indexed BufferGeometry from an engine mesh, with vertex colors from
 * `color(shade, position)` — a gray of the shade when the instance color
 * should supply the hue, or a ramp between two colors for parts that are
 * colored on their own.
 */
export function meshDataToGeometry(
  mesh: MeshData,
  color: (shade: number, position: Point3) => THREE.Color,
): THREE.BufferGeometry {
  const positions = new Float32Array(mesh.positions.length * 3);
  const colors = new Float32Array(mesh.positions.length * 3);
  mesh.positions.forEach((p, i) => {
    positions.set(p, i * 3);
    const c = color(mesh.shades[i], p);
    colors.set([c.r, c.g, c.b], i * 3);
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(mesh.indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** Shade as a neutral gray, for geometry tinted by its instance color. */
export const grayShade = (shade: number): THREE.Color => new THREE.Color(shade, shade, shade);

/**
 * Concatenate indexed geometries (a stem and its side shoots) into one, so
 * they cost a single draw call. Only position and normal are kept — the
 * plain stem material samples no texture.
 */
export function mergeIndexed(parts: readonly THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = new THREE.BufferGeometry();
  for (const name of ["position", "normal"]) {
    const arrays = parts.map((g) => g.getAttribute(name).array as Float32Array);
    const joined = new Float32Array(arrays.reduce((n, a) => n + a.length, 0));
    let offset = 0;
    for (const a of arrays) {
      joined.set(a, offset);
      offset += a.length;
    }
    merged.setAttribute(name, new THREE.BufferAttribute(joined, 3));
  }
  const index: number[] = [];
  let base = 0;
  for (const g of parts) {
    for (const i of (g.index as THREE.BufferAttribute).array) index.push(i + base);
    base += g.getAttribute("position").count;
  }
  merged.setIndex(index);
  return merged;
}
