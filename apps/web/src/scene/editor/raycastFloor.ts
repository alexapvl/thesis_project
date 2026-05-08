import * as THREE from 'three';
import type { Vec3 } from '@/scene/document/reducer';

/**
 * Maximum hit distance (world units) we accept from the floor raycast.
 * THREE.Ray.intersectPlane only returns null when the ray is *exactly*
 * parallel to the plane; when the camera looks nearly horizontally,
 * `denominator` is a very small non-zero number, `t` blows up to ~Infinity,
 * and the returned point sits at (Inf, Inf, Inf). The grid is 20x20, so
 * any legitimate floor hit is well inside this bound.
 */
const MAX_HIT_RADIUS = 200;

const _floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _ray = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _hit = new THREE.Vector3();

export type FloorHit =
  | { ok: true; point: Vec3 }
  | { ok: false; reason: 'parallel' | 'out-of-range' | 'invalid-rect' };

export function raycastFloor(
  dom: HTMLElement,
  camera: THREE.Camera,
  clientX: number,
  clientY: number,
): FloorHit {
  const rect = dom.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return { ok: false, reason: 'invalid-rect' };

  _ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  _ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  _ray.setFromCamera(_ndc, camera);

  const result = _ray.ray.intersectPlane(_floor, _hit);
  if (!result) return { ok: false, reason: 'parallel' };

  if (
    !Number.isFinite(_hit.x) ||
    !Number.isFinite(_hit.y) ||
    !Number.isFinite(_hit.z) ||
    Math.abs(_hit.x) > MAX_HIT_RADIUS ||
    Math.abs(_hit.z) > MAX_HIT_RADIUS
  ) {
    return { ok: false, reason: 'out-of-range' };
  }

  return { ok: true, point: [_hit.x, _hit.y, _hit.z] };
}
