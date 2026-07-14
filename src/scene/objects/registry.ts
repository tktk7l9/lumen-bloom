import type * as THREE from "three";

export interface SceneObjectFactory {
  id: string;
  displayName: string;
  /** Builds the object centered on the origin, standing on y=0. */
  create(): THREE.Group;
}

const registry = new Map<string, SceneObjectFactory>();

/** Adding a new centerpiece object is: write its factory, call this once. */
export function registerSceneObject(factory: SceneObjectFactory): void {
  registry.set(factory.id, factory);
}

export function getSceneObject(id: string): SceneObjectFactory | undefined {
  return registry.get(id);
}

export function listSceneObjects(): SceneObjectFactory[] {
  return Array.from(registry.values());
}
