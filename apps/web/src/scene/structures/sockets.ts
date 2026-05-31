import * as THREE from 'three';
import type { StructureDims, StructureInstance } from '@stl/fixtures';
import type { Vec3 } from '@/scene/document/vec3';

export const SOCKET_SPACING = 0.5;

export type Socket = {
  id: string;
  localPos: Vec3;
  localNormal: Vec3;
};

export type MountTransform = {
  position: Vec3;
  rotation: Vec3;
};

const _euler = new THREE.Euler();
const _q = new THREE.Quaternion();
const _structObj = new THREE.Object3D();

function dim(
  dims: StructureDims,
  key: keyof StructureDims,
  fallback: number,
): number {
  const v = dims[key];
  return typeof v === 'number' && v > 0 ? v : fallback;
}

function pushFaceSockets(
  out: Socket[],
  prefix: string,
  axis: 'x' | 'y' | 'z',
  length: number,
  faceOffset: Vec3,
  normal: Vec3,
  start = SOCKET_SPACING * 0.5,
) {
  const count = Math.max(1, Math.floor((length - start) / SOCKET_SPACING) + 1);
  for (let i = 0; i < count; i++) {
    const t = start + i * SOCKET_SPACING;
    const pos: Vec3 =
      axis === 'y'
        ? [faceOffset[0], t, faceOffset[2]]
        : axis === 'z'
          ? [faceOffset[0], faceOffset[1], t]
          : [faceOffset[0] + t, faceOffset[1], faceOffset[2]];
    out.push({
      id: `${prefix}-${i}`,
      localPos: pos,
      localNormal: normal,
    });
  }
}

function towerSockets(height: number): Socket[] {
  const out: Socket[] = [];
  const r = 0.18;
  pushFaceSockets(out, 'tower-xp', 'y', height, [r, 0, 0], [1, 0, 0]);
  pushFaceSockets(out, 'tower-xn', 'y', height, [-r, 0, 0], [-1, 0, 0]);
  pushFaceSockets(out, 'tower-zp', 'y', height, [0, 0, r], [0, 0, 1]);
  pushFaceSockets(out, 'tower-zn', 'y', height, [0, 0, -r], [0, 0, -1]);
  return out;
}

/** Sockets for a horizontal beam along +Z (standalone truss beam). */
function beamSocketsAlongZ(length: number, origin: Vec3): Socket[] {
  const out: Socket[] = [];
  const r = 0.18;
  const yUnder = -0.15;
  const [ox, oy, oz] = origin;
  pushFaceSockets(out, 'beam-under', 'z', length, [ox, oy + yUnder, oz], [0, -1, 0], 0.25);
  pushFaceSockets(out, 'beam-xp', 'z', length, [ox + r, oy, oz], [1, 0, 0]);
  pushFaceSockets(out, 'beam-xn', 'z', length, [ox - r, oy, oz], [-1, 0, 0]);
  pushFaceSockets(out, 'beam-yp', 'z', length, [ox, oy + r, oz], [0, 1, 0]);
  return out;
}

/** Sockets for a horizontal beam along +X (goalpost top span). */
function beamSocketsAlongX(length: number, origin: Vec3): Socket[] {
  const out: Socket[] = [];
  const r = 0.18;
  const yUnder = -0.15;
  const [ox, oy, oz] = origin;
  pushFaceSockets(out, 'beam-under', 'x', length, [ox, oy + yUnder, oz], [0, -1, 0], 0.25);
  pushFaceSockets(out, 'beam-zp', 'x', length, [ox, oy, oz + r], [0, 0, 1]);
  pushFaceSockets(out, 'beam-zn', 'x', length, [ox, oy, oz - r], [0, 0, -1]);
  pushFaceSockets(out, 'beam-yp', 'x', length, [ox, oy + r, oz], [0, 1, 0]);
  return out;
}

export function socketsForStructure(structure: StructureInstance): Socket[] {
  const d = structure.dims;
  switch (structure.kind) {
    case 'tower': {
      const h = dim(d, 'height', 4);
      return towerSockets(h);
    }
    case 'beam': {
      const len = dim(d, 'length', 4);
      return beamSocketsAlongZ(len, [0, 0.19, 0]);
    }
    case 'goalpost': {
      const span = dim(d, 'span', 4);
      const height = dim(d, 'height', 4);
      const half = span / 2;
      const left: Socket[] = towerSockets(height).map((s) => ({
        ...s,
        id: `gp-l-${s.id}`,
        localPos: [s.localPos[0] - half, s.localPos[1], s.localPos[2]] as Vec3,
      }));
      const right: Socket[] = towerSockets(height).map((s) => ({
        ...s,
        id: `gp-r-${s.id}`,
        localPos: [s.localPos[0] + half, s.localPos[1], s.localPos[2]] as Vec3,
      }));
      const topBeam: Socket[] = beamSocketsAlongX(span, [-half, height, 0]).map((s) => ({
        ...s,
        id: `gp-top-${s.id}`,
      }));
      return [...left, ...right, ...topBeam];
    }
    case 'baseplate': {
      const w = dim(d, 'width', 0.8);
      const h = 0.05;
      return [
        { id: 'bp-0', localPos: [0, h, 0] as Vec3, localNormal: [0, 1, 0] as Vec3 },
        { id: 'bp-1', localPos: [w * 0.25, h, 0] as Vec3, localNormal: [0, 1, 0] as Vec3 },
        { id: 'bp-2', localPos: [-w * 0.25, h, 0] as Vec3, localNormal: [0, 1, 0] as Vec3 },
        { id: 'bp-3', localPos: [0, h, w * 0.25] as Vec3, localNormal: [0, 1, 0] as Vec3 },
        { id: 'bp-4', localPos: [0, h, -w * 0.25] as Vec3, localNormal: [0, 1, 0] as Vec3 },
      ];
    }
    default:
      return [];
  }
}

function rotationFromNormal(nx: number, ny: number, nz: number): Vec3 {
  const from = new THREE.Vector3(0, 0, -1);
  const to = new THREE.Vector3(nx, ny, nz).normalize();
  _q.setFromUnitVectors(from, to);
  _euler.setFromQuaternion(_q);
  return [_euler.x, _euler.y, _euler.z];
}

export function resolveMountTransform(
  structure: StructureInstance,
  socketId: string,
): MountTransform | null {
  const socket = socketsForStructure(structure).find((s) => s.id === socketId);
  if (!socket) return null;
  _structObj.position.set(...structure.position);
  _structObj.rotation.set(...structure.rotation);
  _structObj.updateMatrixWorld(true);

  const worldPos = new THREE.Vector3(...socket.localPos).applyMatrix4(_structObj.matrixWorld);
  const worldNormal = new THREE.Vector3(...socket.localNormal)
    .transformDirection(_structObj.matrixWorld)
    .normalize();

  return {
    position: [worldPos.x, worldPos.y, worldPos.z],
    rotation: rotationFromNormal(worldNormal.x, worldNormal.y, worldNormal.z),
  };
}

export function findNearestSocket(
  structure: StructureInstance,
  worldPoint: Vec3,
  maxDistance: number,
): Socket | null {
  _structObj.position.set(...structure.position);
  _structObj.rotation.set(...structure.rotation);
  _structObj.updateMatrixWorld(true);

  let best: Socket | null = null;
  let bestDist = maxDistance;
  for (const socket of socketsForStructure(structure)) {
    const local = new THREE.Vector3(...socket.localPos);
    const world = local.applyMatrix4(_structObj.matrixWorld);
    const dx = world.x - worldPoint[0];
    const dy = world.y - worldPoint[1];
    const dz = world.z - worldPoint[2];
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < bestDist) {
      bestDist = dist;
      best = socket;
    }
  }
  return best;
}

export const MOUNT_SNAP_RADIUS = 0.45;
export const SOCKET_RAY_THRESHOLD = 0.4;

const _closestOnRay = new THREE.Vector3();
const _scratch = new THREE.Vector3();
const _worldSocket = new THREE.Vector3();

/** Pick the socket closest to the camera ray within threshold. */
export function findSocketAlongRay(
  ray: THREE.Ray,
  structures: StructureInstance[],
  threshold: number,
): { structure: StructureInstance; socket: Socket } | null {
  let best: {
    structure: StructureInstance;
    socket: Socket;
    dist: number;
    t: number;
  } | null = null;

  for (const structure of structures) {
    _structObj.position.set(...structure.position);
    _structObj.rotation.set(...structure.rotation);
    _structObj.updateMatrixWorld(true);

    for (const socket of socketsForStructure(structure)) {
      _worldSocket.set(...socket.localPos).applyMatrix4(_structObj.matrixWorld);
      _scratch.copy(_worldSocket).sub(ray.origin);
      const t = _scratch.dot(ray.direction);
      if (t < 0) continue;
      _closestOnRay.copy(ray.direction).multiplyScalar(t).add(ray.origin);
      const dist = _worldSocket.distanceTo(_closestOnRay);
      if (dist > threshold) continue;
      if (!best || t < best.t - 1e-6 || (Math.abs(t - best.t) < 1e-6 && dist < best.dist)) {
        best = { structure, socket, dist, t };
      }
    }
  }

  return best ? { structure: best.structure, socket: best.socket } : null;
}

export function findNearestSocketGlobal(
  structures: StructureInstance[],
  worldPoint: Vec3,
  maxDistance: number,
): { structure: StructureInstance; socket: Socket } | null {
  let best: { structure: StructureInstance; socket: Socket } | null = null;
  let bestDist = maxDistance;
  for (const structure of structures) {
    const socket = findNearestSocket(structure, worldPoint, bestDist);
    if (!socket) continue;
    _structObj.position.set(...structure.position);
    _structObj.rotation.set(...structure.rotation);
    _structObj.updateMatrixWorld(true);
    const world = new THREE.Vector3(...socket.localPos).applyMatrix4(_structObj.matrixWorld);
    const dx = world.x - worldPoint[0];
    const dy = world.y - worldPoint[1];
    const dz = world.z - worldPoint[2];
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < bestDist) {
      bestDist = dist;
      best = { structure, socket };
    }
  }
  return best;
}
