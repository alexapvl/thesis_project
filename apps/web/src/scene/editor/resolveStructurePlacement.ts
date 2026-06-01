import type * as THREE from 'three';
import { snapVec3 } from '@/scene/document/snap';
import type { Vec3 } from '@/scene/document/reducer';
import { raycastFloor, type FloorHit } from './raycastFloor';

export type StructureFloorPlacement =
  | { ok: true; pos: Vec3 }
  | { ok: false; reason: Extract<FloorHit, { ok: false }>['reason'] };

/** Raycast floor and snap structure anchor (y = 0). */
export function resolveStructureFloorPlacement(
  dom: HTMLElement,
  camera: THREE.Camera,
  clientX: number,
  clientY: number,
  gridSnap: boolean,
  gridSize: number,
): StructureFloorPlacement {
  const hit = raycastFloor(dom, camera, clientX, clientY);
  if (!hit.ok) return { ok: false, reason: hit.reason };
  let pos: Vec3 = [hit.point[0], 0, hit.point[2]];
  if (gridSnap) pos = snapVec3(pos, gridSize);
  return { ok: true, pos };
}

/** Last structure placement preview — updated on pointermove/pointerdown so click matches ghost. */
let remembered: Vec3 | null = null;

export function rememberStructurePlacement(pos: Vec3): void {
  remembered = pos;
}

export function peekStructurePlacement(): Vec3 | null {
  return remembered;
}

export function clearStructurePlacement(): void {
  remembered = null;
}
