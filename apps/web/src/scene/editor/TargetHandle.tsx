import { useEffect, useMemo, useRef, useState } from 'react';
import { TransformControls } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BUILTIN_FIXTURES, fixturePlacementMeta } from '@stl/fixtures';
import { useStore } from '@/store';
import { snapVec3 } from '@/scene/document/snap';
import type { Vec3 } from '@/scene/document/reducer';
import { isInRange } from './raycastFloor';
import { useTransformPreview } from './TransformPreviewProvider';

type Props = {
  setOrbitEnabled: (enabled: boolean) => void;
};

/**
 * Visible 3D handle for the spotlight target. Moving it updates the fixture's
 * `target` field on the scene document — the runtime reads the document, never
 * the gizmo.
 */
export function TargetHandle({ setOrbitEnabled }: Props) {
  const selected = useStore((s) =>
    s.scene.doc.fixtures.find((f) => f.id === s.scene.doc.selectedFixtureId),
  );
  const dispatch = useStore((s) => s.sceneDispatch);
  const gridSnap = useStore((s) => s.editor.gridSnap);
  const gridSize = useStore((s) => s.editor.gridSize);
  const placement = useStore((s) => s.editor.pendingFixtureTypeId);
  const debugLog = useStore((s) => s.debugLog);
  const preview = useTransformPreview();

  const proxy = useMemo(() => new THREE.Object3D(), []);
  const ref = useRef<THREE.Object3D>(proxy);
  const [, force] = useState(0);

  // Single 6-float buffer (two 3D points) reused every frame.
  const lineGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    return g;
  }, []);

  useEffect(() => {
    if (!selected) return;
    proxy.position.set(...selected.target);
    force((n) => n + 1);
  }, [selected?.id, selected?.target, proxy]);

  // Keep the drop-line live every frame, so neither a translate drag of
  // the fixture body (TransformHandles writes preview.position) nor a
  // drag of the target sphere (mutates this proxy) leaves a stale line
  // endpoint. Mutating the buffer directly is cheaper than rebuilding
  // geometry on each React render.
  useFrame(() => {
    if (!selected) return;
    const live = preview.current.fixtureId === selected.id;
    const start =
      live && preview.current.position ? preview.current.position : selected.position;
    const startX = Array.isArray(start) ? start[0] : start.x;
    const startY = Array.isArray(start) ? start[1] : start.y;
    const startZ = Array.isArray(start) ? start[2] : start.z;
    const attr = lineGeom.getAttribute('position') as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    arr[0] = startX;
    arr[1] = startY;
    arr[2] = startZ;
    arr[3] = proxy.position.x;
    arr[4] = proxy.position.y;
    arr[5] = proxy.position.z;
    attr.needsUpdate = true;
  });

  if (!selected || placement) return null;
  const def = BUILTIN_FIXTURES.find((d) => d.typeId === selected.definitionId);
  if (!def || !fixturePlacementMeta(def).aims) return null;

  return (
    <>
      {/* Mount the proxy so drei's TransformControls.attach() finds it
          parented to the scene. Same fix as TransformHandles. */}
      <primitive object={proxy}>
        <mesh>
          <sphereGeometry args={[0.18, 16, 16]} />
          <meshBasicMaterial color="#fbbf24" />
        </mesh>
      </primitive>
      <TransformControls
        object={ref.current}
        mode="translate"
        size={0.6}
        onMouseDown={() => {
          setOrbitEnabled(false);
          preview.current.fixtureId = selected.id;
        }}
        onObjectChange={() => {
          if (preview.current.fixtureId !== selected.id) return;
          preview.current.target = proxy.position.clone();
        }}
        onMouseUp={() => {
          setOrbitEnabled(true);
          preview.current.fixtureId = null;
          preview.current.target = null;
          if (!isInRange(proxy.position)) {
            proxy.position.set(...selected.target);
            force((n) => n + 1);
            debugLog('warn', 'target drag rejected: out of range');
            return;
          }
          let t: Vec3 = [proxy.position.x, proxy.position.y, proxy.position.z];
          if (gridSnap) t = snapVec3(t, gridSize);
          dispatch({ type: 'fixture.update', id: selected.id, patch: { target: t } });
        }}
      />
      <line>
        <primitive object={lineGeom} attach="geometry" />
        <lineBasicMaterial color="#fbbf24" transparent opacity={0.4} />
      </line>
    </>
  );
}
