import * as THREE from 'three';
import type { StructureInstance } from '@stl/fixtures';
import type { Vec3 } from '@/scene/document/vec3';
import {
  findSocketAlongRay,
  resolveMountTransform,
  SOCKET_RAY_THRESHOLD,
} from '@/scene/structures/sockets';
import { raycastFloor } from './raycastFloor';

const _ndc = new THREE.Vector2();
const _raycaster = new THREE.Raycaster();

export type FixtureDrop =
  | {
      kind: 'mount';
      structureId: string;
      socketId: string;
      position: Vec3;
      rotation: Vec3;
    }
  | { kind: 'ground'; position: Vec3 }
  | { kind: 'none'; reason: string };

export function rayFromClient(
  dom: HTMLElement,
  camera: THREE.Camera,
  clientX: number,
  clientY: number,
): THREE.Ray | null {
  const rect = dom.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  _ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  _ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  _raycaster.setFromCamera(_ndc, camera);
  return _raycaster.ray.clone();
}

export function resolveFixtureDrop(
  dom: HTMLElement,
  camera: THREE.Camera,
  clientX: number,
  clientY: number,
  structures: StructureInstance[],
  groundRestHeight: number,
  socketThreshold = SOCKET_RAY_THRESHOLD,
): FixtureDrop {
  const ray = rayFromClient(dom, camera, clientX, clientY);
  if (!ray) return { kind: 'none', reason: 'invalid-rect' };

  const socketHit = findSocketAlongRay(ray, structures, socketThreshold);
  if (socketHit) {
    const resolved = resolveMountTransform(socketHit.structure, socketHit.socket.id);
    if (resolved) {
      return {
        kind: 'mount',
        structureId: socketHit.structure.id,
        socketId: socketHit.socket.id,
        position: resolved.position,
        rotation: resolved.rotation,
      };
    }
  }

  const floor = raycastFloor(dom, camera, clientX, clientY);
  if (!floor.ok) return { kind: 'none', reason: floor.reason };

  return {
    kind: 'ground',
    position: [floor.point[0], groundRestHeight, floor.point[2]],
  };
}
