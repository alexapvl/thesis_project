import * as THREE from 'three';
import type { Vec3 } from '@/scene/document/vec3';

const _eA = new THREE.Euler();
const _eB = new THREE.Euler();
const _qA = new THREE.Quaternion();
const _qB = new THREE.Quaternion();
const _eOut = new THREE.Euler();

/** Combine mount/base orientation with user placement rotation (pending applied in local space). */
export function composeRotation(base: Vec3, pending: Vec3): Vec3 {
  _eA.set(base[0], base[1], base[2]);
  _eB.set(pending[0], pending[1], pending[2]);
  _qA.setFromEuler(_eA);
  _qB.setFromEuler(_eB);
  _qA.multiply(_qB);
  _eOut.setFromQuaternion(_qA);
  return [_eOut.x, _eOut.y, _eOut.z];
}
