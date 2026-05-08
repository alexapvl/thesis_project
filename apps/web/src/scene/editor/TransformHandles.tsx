import { useEffect, useMemo, useRef, useState } from 'react';
import { TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '@/store';
import { snap, snapVec3 } from '@/scene/document/snap';
import type { Vec3 } from '@/scene/document/reducer';

type Mode = 'translate' | 'rotate';

type Props = {
  mode: Mode;
  setOrbitEnabled: (enabled: boolean) => void;
};

export function TransformHandles({ mode, setOrbitEnabled }: Props) {
  const selected = useStore((s) =>
    s.scene.doc.fixtures.find((f) => f.id === s.scene.doc.selectedFixtureId),
  );
  const dispatch = useStore((s) => s.sceneDispatch);
  const gridSnap = useStore((s) => s.editor.gridSnap);
  const gridSize = useStore((s) => s.editor.gridSize);
  const placement = useStore((s) => s.editor.pendingFixtureTypeId);

  const proxy = useMemo(() => new THREE.Object3D(), []);
  const ref = useRef<THREE.Object3D>(proxy);
  const [, force] = useState(0);

  // Sync proxy when selection or mode changes.
  useEffect(() => {
    if (!selected) return;
    if (mode === 'translate') {
      proxy.position.set(...selected.position);
      proxy.rotation.set(0, 0, 0);
    } else {
      proxy.position.set(...selected.position);
      proxy.rotation.set(...selected.rotation);
    }
    force((n) => n + 1);
  }, [selected?.id, selected?.position, selected?.rotation, mode, proxy]);

  // Don't show handles while placement is active — placement takes priority.
  if (!selected || placement) return null;

  return (
    <>
      {/* The proxy must live in the scene graph; otherwise drei's
          TransformControls.attach() warns "must be a part of the scene
          graph" every frame. We don't render anything visible from it —
          the gizmo IS the visualization — so it's a bare <primitive>. */}
      <primitive object={proxy} />
      <TransformControls
        object={ref.current}
        mode={mode}
        onMouseDown={() => setOrbitEnabled(false)}
        onMouseUp={() => {
          setOrbitEnabled(true);
          if (!selected) return;
          if (mode === 'translate') {
            let pos: Vec3 = [proxy.position.x, proxy.position.y, proxy.position.z];
            if (gridSnap) pos = snapVec3(pos, gridSize);
            dispatch({ type: 'fixture.update', id: selected.id, patch: { position: pos } });
          } else {
            const rot: Vec3 = [proxy.rotation.x, proxy.rotation.y, proxy.rotation.z];
            const stepRad = (Math.PI / 180) * 5; // 5° rotational snap when grid snap is on
            const snapped: Vec3 = gridSnap
              ? [snap(rot[0], stepRad), snap(rot[1], stepRad), snap(rot[2], stepRad)]
              : rot;
            dispatch({ type: 'fixture.update', id: selected.id, patch: { rotation: snapped } });
          }
        }}
      />
    </>
  );
}