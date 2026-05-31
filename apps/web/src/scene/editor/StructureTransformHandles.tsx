import { useEffect, useMemo, useRef, useState } from 'react';
import { TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '@/store';
import { snap, snapVec3 } from '@/scene/document/snap';
import type { Vec3 } from '@/scene/document/reducer';
import { isInRange } from './raycastFloor';

type Mode = 'translate' | 'rotate';

type Props = {
  mode: Mode;
  setOrbitEnabled: (enabled: boolean) => void;
};

export function StructureTransformHandles({ mode, setOrbitEnabled }: Props) {
  const selected = useStore((s) =>
    s.scene.doc.structures.find((st) => st.id === s.scene.doc.selectedStructureId),
  );
  const dispatch = useStore((s) => s.sceneDispatch);
  const gridSnap = useStore((s) => s.editor.gridSnap);
  const gridSize = useStore((s) => s.editor.gridSize);
  const placement = useStore(
    (s) => s.editor.pendingFixtureTypeId ?? s.editor.pendingStructureTypeId,
  );
  const debugLog = useStore((s) => s.debugLog);

  const proxy = useMemo(() => new THREE.Object3D(), []);
  const ref = useRef<THREE.Object3D>(proxy);
  const [, force] = useState(0);
  const dragging = useRef(false);

  useEffect(() => {
    if (!selected || dragging.current) return;
    proxy.position.set(...selected.position);
    proxy.rotation.set(...selected.rotation);
    force((n) => n + 1);
  }, [selected?.id, selected?.position, selected?.rotation, proxy]);

  if (!selected || placement) return null;

  return (
    <>
      <primitive object={proxy} />
      <TransformControls
        object={ref.current}
        mode={mode}
        onMouseDown={() => {
          dragging.current = true;
          setOrbitEnabled(false);
        }}
        onMouseUp={() => {
          dragging.current = false;
          setOrbitEnabled(true);
          if (!selected) return;
          if (mode === 'translate') {
            if (!isInRange(proxy.position)) {
              proxy.position.set(...selected.position);
              force((n) => n + 1);
              debugLog('warn', 'structure move rejected: out of range');
              return;
            }
            let pos: Vec3 = [proxy.position.x, proxy.position.y, proxy.position.z];
            if (gridSnap) pos = snapVec3(pos, gridSize);
            dispatch({ type: 'structure.update', id: selected.id, patch: { position: pos } });
          } else {
            const rot: Vec3 = [proxy.rotation.x, proxy.rotation.y, proxy.rotation.z];
            const stepRad = (Math.PI / 180) * 5;
            const snapped: Vec3 = gridSnap
              ? [snap(rot[0], stepRad), snap(rot[1], stepRad), snap(rot[2], stepRad)]
              : rot;
            dispatch({ type: 'structure.update', id: selected.id, patch: { rotation: snapped } });
          }
        }}
      />
    </>
  );
}
