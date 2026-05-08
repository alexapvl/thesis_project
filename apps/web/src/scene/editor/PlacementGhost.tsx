import { useEffect, useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { BUILTIN_FIXTURES } from '@stl/fixtures';
import { useStore } from '@/store';
import { snapVec3 } from '@/scene/document/snap';
import type { Vec3 } from '@/scene/document/reducer';
import { raycastFloor } from './raycastFloor';

/**
 * Translucent silhouette of the pending fixture, placed at the mouse's
 * raycast hit while click-to-place mode is active. Helps the user judge
 * where a fixture will land before committing — particularly useful
 * because the height defaults are fixed and the cursor only controls
 * X/Z. Rendered when `editor.pendingFixtureTypeId` is non-null.
 *
 * Drag-to-place doesn't get a 3D ghost: HTML5 drag owns the drag image
 * and we'd need to switch to pointer-events to render under the cursor.
 * The catalog tip nudges users toward click-to-place for now.
 */
export function PlacementGhost() {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const pendingTypeId = useStore((s) => s.editor.pendingFixtureTypeId);
  const gridSnap = useStore((s) => s.editor.gridSnap);
  const gridSize = useStore((s) => s.editor.gridSize);

  const [pos, setPos] = useState<Vec3 | null>(null);
  // Track whether the cursor is currently over the canvas. We hide the
  // ghost when it isn't, otherwise it sticks at its last position
  // pointing at thin air.
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
      const defaultY = def.kind === 'spot' ? 4 : 2;
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

  const target = def.kind === 'spot' ? new THREE.Vector3(pos[0], 0, pos[2]) : null;

  return (
    <group position={pos}>
      {def.kind === 'spot' ? (
        <>
          {/* Mirror the real spotlight silhouette: base + yoke arms + head
              aiming straight down (the default target sits at floor below
              the fixture). Helps the user see what shape will land. */}
          <mesh position={[0, -0.2, 0]}>
            <cylinderGeometry args={[0.22, 0.28, 0.12, 20]} />
            <meshStandardMaterial color="#fbbf24" transparent opacity={0.5} />
          </mesh>
          <mesh position={[-0.2, 0, 0]}>
            <boxGeometry args={[0.05, 0.36, 0.08]} />
            <meshStandardMaterial color="#fbbf24" transparent opacity={0.5} />
          </mesh>
          <mesh position={[0.2, 0, 0]}>
            <boxGeometry args={[0.05, 0.36, 0.08]} />
            <meshStandardMaterial color="#fbbf24" transparent opacity={0.5} />
          </mesh>
          {/* Head, oriented to point straight down (matches default target). */}
          <mesh position={[0, 0.05, 0]} rotation={[0, 0, 0]}>
            <cylinderGeometry args={[0.16, 0.16, 0.42, 20]} />
            <meshStandardMaterial color="#fbbf24" transparent opacity={0.5} />
          </mesh>
          {/* Drop-line from fixture body to its default target on the floor. */}
          {target && (
            <line>
              <bufferGeometry
                attach="geometry"
                ref={(geom) => {
                  if (!geom) return;
                  const pts = new Float32Array([0, 0, 0, target.x - pos[0], -pos[1], target.z - pos[2]]);
                  geom.setAttribute('position', new THREE.BufferAttribute(pts, 3));
                }}
              />
              <lineBasicMaterial color="#fbbf24" transparent opacity={0.4} />
            </line>
          )}
        </>
      ) : (
        <mesh>
          <sphereGeometry args={[0.18, 16, 16]} />
          <meshBasicMaterial color="#fbbf24" transparent opacity={0.5} />
        </mesh>
      )}
    </group>
  );
}
