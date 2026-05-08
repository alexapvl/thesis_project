import { useEffect, useMemo, useRef, useState } from 'react';
import { TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import { BUILTIN_FIXTURES } from '@stl/fixtures';
import { useStore } from '@/store';
import { snapVec3 } from '@/scene/document/snap';
import type { Vec3 } from '@/scene/document/reducer';
import { isInRange } from './raycastFloor';

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

  const proxy = useMemo(() => new THREE.Object3D(), []);
  const ref = useRef<THREE.Object3D>(proxy);
  const [, force] = useState(0);

  useEffect(() => {
    if (!selected) return;
    proxy.position.set(...selected.target);
    force((n) => n + 1);
  }, [selected?.id, selected?.target, proxy]);

  if (!selected || placement) return null;
  const def = BUILTIN_FIXTURES.find((d) => d.typeId === selected.definitionId);
  if (def?.kind !== 'spot') return null;

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
        onMouseDown={() => setOrbitEnabled(false)}
        onMouseUp={() => {
          setOrbitEnabled(true);
          if (!isInRange(proxy.position)) {
            // Drag projected to a near-Infinity world point (gizmo arrow
            // nearly parallel to the camera ray). Revert the proxy and
            // skip the dispatch instead of writing garbage to the doc.
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
        <bufferGeometry
          attach="geometry"
          onUpdate={(geom: THREE.BufferGeometry) => {
            const verts = new Float32Array([
              ...selected.position,
              proxy.position.x,
              proxy.position.y,
              proxy.position.z,
            ]);
            geom.setAttribute('position', new THREE.BufferAttribute(verts, 3));
          }}
        />
        <lineBasicMaterial color="#fbbf24" transparent opacity={0.4} />
      </line>
    </>
  );
}
