import { useEffect, useMemo, useRef, useState } from 'react';
import { TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '@/store';
import { snap, snapVec3 } from '@/scene/document/snap';
import type { Vec3 } from '@/scene/document/reducer';
import { isInRange } from './raycastFloor';
import { useTransformPreview } from './TransformPreviewProvider';

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
  const debugLog = useStore((s) => s.debugLog);
  const preview = useTransformPreview();

  const proxy = useMemo(() => new THREE.Object3D(), []);
  const ref = useRef<THREE.Object3D>(proxy);
  const [, force] = useState(0);
  const dragging = useRef(false);

  // Sync proxy when selection or mode changes. Skip while a drag is in
  // flight: drei's TransformControls fires onChange events that update
  // selected.* indirectly only on commit, but mid-drag the proxy must
  // not be reset by an unrelated re-render.
  useEffect(() => {
    if (!selected || dragging.current) return;
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
        onMouseDown={() => {
          dragging.current = true;
          setOrbitEnabled(false);
          preview.current.fixtureId = selected.id;
        }}
        // Live preview: TransformControls fires onObjectChange on every
        // gizmo tick. We shove the proxy's pose into the preview ref so
        // the fixture body follows in its useFrame. No store update.
        onObjectChange={() => {
          if (!dragging.current) return;
          if (mode === 'translate') {
            preview.current.position = proxy.position.clone();
            preview.current.rotation = null;
          } else {
            preview.current.rotation = proxy.rotation.clone();
            preview.current.position = null;
          }
        }}
        onMouseUp={() => {
          dragging.current = false;
          setOrbitEnabled(true);
          // Always clear the preview before bailing or committing so the
          // fixture snaps back to the document's value (revert path) or
          // to the freshly-committed value (commit path).
          preview.current.fixtureId = null;
          preview.current.position = null;
          preview.current.rotation = null;
          if (!selected) return;
          if (mode === 'translate') {
            if (!isInRange(proxy.position)) {
              proxy.position.set(...selected.position);
              force((n) => n + 1);
              debugLog('warn', 'move rejected: out of range');
              return;
            }
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
