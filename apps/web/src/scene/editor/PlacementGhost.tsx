import { useEffect, useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { BUILTIN_FIXTURES, fixturePlacementMeta, type FixtureKind } from '@stl/fixtures';
import { useStore } from '@/store';
import { snapVec3 } from '@/scene/document/snap';
import type { Vec3 } from '@/scene/document/reducer';
import { raycastFloor } from './raycastFloor';

const GHOST = '#fbbf24';
const ghostMat = { color: GHOST, transparent: true, opacity: 0.5 };

function AimingGhost({ target, pos }: { target: THREE.Vector3; pos: Vec3 }) {
  return (
    <>
      <mesh position={[0, -0.2, 0]}>
        <cylinderGeometry args={[0.22, 0.28, 0.12, 20]} />
        <meshStandardMaterial {...ghostMat} />
      </mesh>
      <mesh position={[-0.2, 0, 0]}>
        <boxGeometry args={[0.05, 0.36, 0.08]} />
        <meshStandardMaterial {...ghostMat} />
      </mesh>
      <mesh position={[0.2, 0, 0]}>
        <boxGeometry args={[0.05, 0.36, 0.08]} />
        <meshStandardMaterial {...ghostMat} />
      </mesh>
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.16, 0.16, 0.42, 20]} />
        <meshStandardMaterial {...ghostMat} />
      </mesh>
      <line>
        <bufferGeometry
          attach="geometry"
          ref={(geom) => {
            if (!geom) return;
            const pts = new Float32Array([
              0, 0, 0,
              target.x - pos[0],
              -pos[1],
              target.z - pos[2],
            ]);
            geom.setAttribute('position', new THREE.BufferAttribute(pts, 3));
          }}
        />
        <lineBasicMaterial color={GHOST} transparent opacity={0.4} />
      </line>
    </>
  );
}

function KindGhost({ kind }: { kind: FixtureKind }) {
  switch (kind) {
    case 'bar':
      return (
        <mesh>
          <boxGeometry args={[1.6, 0.12, 0.12]} />
          <meshStandardMaterial {...ghostMat} />
        </mesh>
      );
    case 'matrix':
      return (
        <mesh>
          <boxGeometry args={[1.4, 0.1, 1.4]} />
          <meshStandardMaterial {...ghostMat} />
        </mesh>
      );
    case 'blinder':
      return (
        <mesh>
          <boxGeometry args={[0.5, 0.4, 0.1]} />
          <meshStandardMaterial {...ghostMat} />
        </mesh>
      );
    case 'strobe':
      return (
        <mesh>
          <boxGeometry args={[0.35, 0.28, 0.12]} />
          <meshStandardMaterial {...ghostMat} />
        </mesh>
      );
    case 'par':
      return (
        <mesh rotation={[-Math.PI / 6, 0, 0]}>
          <cylinderGeometry args={[0.14, 0.18, 0.22, 16]} />
          <meshStandardMaterial {...ghostMat} />
        </mesh>
      );
    case 'laser':
      return (
        <mesh>
          <boxGeometry args={[0.2, 0.15, 0.2]} />
          <meshStandardMaterial {...ghostMat} />
        </mesh>
      );
    case 'point':
      return (
        <mesh>
          <sphereGeometry args={[0.18, 16, 16]} />
          <meshBasicMaterial {...ghostMat} />
        </mesh>
      );
    default:
      return (
        <mesh>
          <boxGeometry args={[0.3, 0.5, 0.3]} />
          <meshStandardMaterial {...ghostMat} />
        </mesh>
      );
  }
}

export function PlacementGhost() {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const pendingTypeId = useStore((s) => s.editor.pendingFixtureTypeId);
  const gridSnap = useStore((s) => s.editor.gridSnap);
  const gridSize = useStore((s) => s.editor.gridSize);

  const [pos, setPos] = useState<Vec3 | null>(null);
  const overRef = useRef(false);

  useEffect(() => {
    if (!pendingTypeId) {
      setPos(null);
      return;
    }
    const dom = gl.domElement;

    const onMove = (ev: MouseEvent) => {
      overRef.current = true;
      const r = raycastFloor(dom, camera, ev.clientX, ev.clientY);
      if (!r.ok) {
        setPos(null);
        return;
      }
      const def = BUILTIN_FIXTURES.find((d) => d.typeId === pendingTypeId);
      if (!def) return;
      const defaultY = fixturePlacementMeta(def).mountHeight;
      let next: Vec3 = [r.point[0], defaultY, r.point[2]];
      if (gridSnap) next = snapVec3(next, gridSize);
      setPos(next);
    };
    const onLeave = () => {
      overRef.current = false;
      setPos(null);
    };

    dom.addEventListener('mousemove', onMove);
    dom.addEventListener('mouseleave', onLeave);
    return () => {
      dom.removeEventListener('mousemove', onMove);
      dom.removeEventListener('mouseleave', onLeave);
    };
  }, [pendingTypeId, gl, camera, gridSnap, gridSize]);

  if (!pendingTypeId || !pos) return null;
  const def = BUILTIN_FIXTURES.find((d) => d.typeId === pendingTypeId);
  if (!def) return null;

  const { aims } = fixturePlacementMeta(def);
  const target = aims ? new THREE.Vector3(pos[0], 0, pos[2]) : null;

  return (
    <group position={pos}>
      {aims && target ? <AimingGhost target={target} pos={pos} /> : <KindGhost kind={def.kind} />}
    </group>
  );
}
