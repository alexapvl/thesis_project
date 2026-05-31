import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const TRUSS_COLOR = '#b8c4d0';
const WIREFRAME_COLOR = '#fbbf24';
const PLATE_COLOR = '#64748b';

const NODE_SPACING = 0.5;
const HALF = 0.15;

const _dir = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();

type MatProps = {
  ghost?: boolean;
  wireframe?: boolean;
};

function trussMaterial({ ghost, wireframe }: MatProps) {
  if (wireframe) {
    return {
      color: WIREFRAME_COLOR,
      wireframe: true,
      transparent: true,
      opacity: 0.85,
    };
  }
  if (ghost) {
    return {
      color: WIREFRAME_COLOR,
      transparent: true,
      opacity: 0.45,
      metalness: 0.4,
      roughness: 0.5,
    };
  }
  return { color: TRUSS_COLOR, metalness: 0.8, roughness: 0.35 };
}

function plateMaterial({ ghost, wireframe }: MatProps) {
  if (wireframe) {
    return { color: WIREFRAME_COLOR, wireframe: true, transparent: true, opacity: 0.85 };
  }
  if (ghost) {
    return { color: WIREFRAME_COLOR, transparent: true, opacity: 0.45, metalness: 0.35, roughness: 0.6 };
  }
  return { color: PLATE_COLOR, metalness: 0.75, roughness: 0.4 };
}

type TrussSegmentProps = {
  length: number;
  axis?: 'x' | 'y' | 'z';
  ghost?: boolean;
  wireframe?: boolean;
  radius?: number;
};

type LatticePart = {
  key: string;
  position: [number, number, number];
  rotation: [number, number, number];
  length: number;
};

type Point3 = [number, number, number];

function addBrace(parts: LatticePart[], key: string, a: Point3, b: Point3) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-5) return;

  _dir.set(dx, dy, dz).normalize();
  _quat.setFromUnitVectors(new THREE.Vector3(0, 1, 0), _dir);
  _euler.setFromQuaternion(_quat);

  parts.push({
    key,
    position: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2],
    rotation: [_euler.x, _euler.y, _euler.z],
    length: len,
  });
}

function addSquareRing(parts: LatticePart[], prefix: string, t: number) {
  const c: Point3[] = [
    [HALF, t, HALF],
    [-HALF, t, HALF],
    [-HALF, t, -HALF],
    [HALF, t, -HALF],
  ];
  for (let i = 0; i < 4; i++) {
    addBrace(parts, `${prefix}-${i}`, c[i]!, c[(i + 1) % 4]!);
  }
}

/** Zig-zag between two parallel corner chords on one face (t runs 0..length). */
function addFaceZigZag(
  parts: LatticePart[],
  faceKey: string,
  cornerA: Point3,
  cornerB: Point3,
  nodes: number[],
) {
  for (let i = 0; i < nodes.length - 1; i++) {
    const t0 = nodes[i]!;
    const t1 = nodes[i + 1]!;
    const a0: Point3 = [cornerA[0], t0, cornerA[2]];
    const a1: Point3 = [cornerA[0], t1, cornerA[2]];
    const b0: Point3 = [cornerB[0], t0, cornerB[2]];
    const b1: Point3 = [cornerB[0], t1, cornerB[2]];

    if (i % 2 === 0) {
      addBrace(parts, `zig-${faceKey}-${i}`, a0, b1);
    } else {
      addBrace(parts, `zig-${faceKey}-${i}`, b0, a1);
    }
  }
}

function buildLattice(length: number): LatticePart[] {
  const parts: LatticePart[] = [];
  const segCount = Math.max(1, Math.ceil(length / NODE_SPACING));
  const nodes: number[] = [];
  for (let i = 0; i <= segCount; i++) {
    nodes.push(Math.min(length, (i * length) / segCount));
  }

  const corners: Point3[] = [
    [HALF, 0, HALF],
    [-HALF, 0, HALF],
    [-HALF, 0, -HALF],
    [HALF, 0, -HALF],
  ];

  for (let ci = 0; ci < 4; ci++) {
    const c = corners[ci]!;
    parts.push({
      key: `chord-${ci}`,
      position: [c[0], length / 2, c[2]],
      rotation: [0, 0, 0],
      length,
    });
  }

  addSquareRing(parts, 'ring-bot', 0);
  addSquareRing(parts, 'ring-top', length);

  // +X face: between corners at z=-HALF and z=+HALF
  addFaceZigZag(parts, 'xp', [HALF, 0, -HALF], [HALF, 0, HALF], nodes);
  // -X face
  addFaceZigZag(parts, 'xn', [-HALF, 0, -HALF], [-HALF, 0, HALF], nodes);
  // +Z face: between x=-HALF and x=+HALF
  addFaceZigZag(parts, 'zp', [-HALF, 0, HALF], [HALF, 0, HALF], nodes);
  // -Z face
  addFaceZigZag(parts, 'zn', [-HALF, 0, -HALF], [HALF, 0, -HALF], nodes);

  return parts;
}

const _partMatrix = new THREE.Matrix4();
const _partQuat = new THREE.Quaternion();
const _partEuler = new THREE.Euler();
const _partPos = new THREE.Vector3();
const _partScale = new THREE.Vector3(1, 1, 1);

/**
 * Merge every tube of the lattice into ONE geometry so a whole segment is a
 * single draw call. Rendering each tube as its own env-mapped mesh produced
 * dozens of draw calls per structure and tanked framerate when on-screen.
 */
function buildMergedGeometry(length: number, radius: number, braceRadius: number): THREE.BufferGeometry {
  const parts = buildLattice(length);
  const geoms: THREE.BufferGeometry[] = [];

  for (const part of parts) {
    const isChord = part.key.startsWith('chord');
    const r = isChord ? radius : braceRadius;
    const g = new THREE.CylinderGeometry(r, r, part.length, isChord ? 8 : 6, 1);
    _partEuler.set(part.rotation[0], part.rotation[1], part.rotation[2]);
    _partQuat.setFromEuler(_partEuler);
    _partPos.set(part.position[0], part.position[1], part.position[2]);
    _partMatrix.compose(_partPos, _partQuat, _partScale);
    g.applyMatrix4(_partMatrix);
    geoms.push(g);
  }

  const merged = mergeGeometries(geoms, false) ?? new THREE.BufferGeometry();
  for (const g of geoms) g.dispose();
  return merged;
}

/** Square truss: 4 corner pillars, top/bottom squares, zig-zag bracing on each face. */
export function TrussSegment({
  length,
  axis = 'y',
  ghost,
  wireframe,
  radius = 0.028,
}: TrussSegmentProps) {
  const mat = trussMaterial({ ghost, wireframe });
  const braceRadius = radius * 0.55;
  const geometry = useMemo(
    () => buildMergedGeometry(length, radius, braceRadius),
    [length, radius, braceRadius],
  );

  useEffect(() => () => geometry.dispose(), [geometry]);

  const rot: [number, number, number] =
    axis === 'y' ? [0, 0, 0] : axis === 'x' ? [0, 0, -Math.PI / 2] : [Math.PI / 2, 0, 0];

  return (
    <group rotation={rot}>
      <mesh geometry={geometry}>
        <meshStandardMaterial {...mat} />
      </mesh>
    </group>
  );
}

type PlateProps = {
  width: number;
  ghost?: boolean;
  wireframe?: boolean;
};

export function TrussBasePlate({ width, ghost, wireframe }: PlateProps) {
  const mat = plateMaterial({ ghost, wireframe });
  return (
    <mesh position={[0, 0.02, 0]}>
      <boxGeometry args={[width, 0.04, width]} />
      <meshStandardMaterial {...mat} />
    </mesh>
  );
}

export function TrussCapPlate({ width, height, ghost, wireframe }: PlateProps & { height: number }) {
  const mat = plateMaterial({ ghost, wireframe });
  return (
    <mesh position={[0, height + 0.02, 0]}>
      <boxGeometry args={[width, 0.04, width]} />
      <meshStandardMaterial {...mat} />
    </mesh>
  );
}
