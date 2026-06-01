import * as THREE from 'three';
import type { Vec3 } from '@/scene/document/vec3';

const STEP = Math.PI / 4;
const _q = new THREE.Quaternion();
const _delta = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _worldUp = new THREE.Vector3(0, 1, 0);
const _localX = new THREE.Vector3(1, 0, 0);

/** Apply one 45° placement rotation step (yaw = world Y, tilt = local X after current orientation). */
export function stepPlacementRotation(current: Vec3, axis: 'yaw' | 'tilt'): Vec3 {
  _euler.set(current[0], current[1], current[2]);
  _q.setFromEuler(_euler);

  if (axis === 'yaw') {
    _delta.setFromAxisAngle(_worldUp, STEP);
    _q.premultiply(_delta);
  } else {
    _delta.setFromAxisAngle(_localX, STEP);
    _q.multiply(_delta);
  }

  _euler.setFromQuaternion(_q);
  return [_euler.x, _euler.y, _euler.z];
}
