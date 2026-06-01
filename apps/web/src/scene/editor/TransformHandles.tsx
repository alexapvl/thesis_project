import { useEffect, useMemo, useRef, useState } from 'react';
import { TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import { BUILTIN_FIXTURES, fixturePlacementMeta } from '@stl/fixtures';
import { useStore } from '@/store';
import { snap, snapVec3 } from '@/scene/document/snap';
import type { Vec3 } from '@/scene/document/reducer';
import { isInRange } from './raycastFloor';
import { useTransformPreview } from './TransformPreviewProvider';
import { findNearestSocketGlobal, MOUNT_SNAP_RADIUS, resolveMountTransform } from '@/scene/structures/sockets';

type Mode = 'translate' | 'rotate';

type Props = {
  mode: Mode;
  setOrbitEnabled: (enabled: boolean) => void;
};

export function TransformHandles({ mode, setOrbitEnabled }: Props) {
  const selected = useStore((s) =>
    s.scene.doc.fixtures.find((f) => f.id === s.scene.doc.selectedFixtureId),
  );
  const structures = useStore((s) => s.scene.doc.structures);
  const dispatch = useStore((s) => s.sceneDispatch);
  const gridSnap = useStore((s) => s.editor.gridSnap);
  const gridSize = useStore((s) => s.editor.gridSize);
  const placement = useStore(
    (s) => s.editor.pendingFixtureTypeId ?? s.editor.pendingStructureTypeId,
  );
  const debugLog = useStore((s) => s.debugLog);
  const preview = useTransformPreview();

  const proxy = useMemo(() => new THREE.Object3D(), []);
  const ref = useRef<THREE.Object3D>(proxy);
  const [, force] = useState(0);
  const dragging = useRef(false);
  const nearestMount = useRef<{ structureId: string; socketId: string } | null>(null);

  const fixtureDef = selected
    ? BUILTIN_FIXTURES.find((d) => d.typeId === selected.definitionId)
    : undefined;
  const groundRestHeight = fixtureDef
    ? fixturePlacementMeta(fixtureDef).groundRestHeight
    : 0.2;

  useEffect(() => {
    if (!selected || dragging.current) return;
    let pos = selected.position;
    let rot = selected.rotation;
    if (selected.mount) {
      const structure = structures.find((s) => s.id === selected.mount!.structureId);
      if (structure) {
        const resolved = resolveMountTransform(structure, selected.mount.socketId);
        if (resolved) {
          pos = resolved.position;
          rot = resolved.rotation;
        }
      }
    }
    if (mode === 'translate') {
      proxy.position.set(...pos);
      proxy.rotation.set(0, 0, 0);
    } else {
      proxy.position.set(...pos);
      proxy.rotation.set(...rot);
    }
    force((n) => n + 1);
  }, [selected?.id, selected?.position, selected?.rotation, selected?.mount, structures, mode, proxy]);

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
          preview.current.fixtureId = selected.id;
          preview.current.structureId = null;
          nearestMount.current = null;
        }}
        onObjectChange={() => {
          if (!dragging.current) return;
          if (mode === 'translate') {
            const world: Vec3 = [proxy.position.x, proxy.position.y, proxy.position.z];
            const hit = findNearestSocketGlobal(structures, world, MOUNT_SNAP_RADIUS);
            nearestMount.current = hit
              ? { structureId: hit.structure.id, socketId: hit.socket.id }
              : null;
            if (!hit) {
              proxy.position.y = groundRestHeight;
            }
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
            const mount = nearestMount.current;
            nearestMount.current = null;
            if (mount) {
              dispatch({
                type: 'fixture.mount',
                id: selected.id,
                structureId: mount.structureId,
                socketId: mount.socketId,
              });
              return;
            }
            if (selected.mount) {
              dispatch({ type: 'fixture.unmount', id: selected.id });
            }
            let pos: Vec3 = [proxy.position.x, groundRestHeight, proxy.position.z];
            if (gridSnap) pos = snapVec3(pos, gridSize);
            const { aims } = fixtureDef ? fixturePlacementMeta(fixtureDef) : { aims: false };
            const patch: { position: Vec3; target?: Vec3 } = { position: pos };
            if (aims) {
              patch.target = [pos[0] + 4, pos[1] + 2, pos[2]];
            }
            dispatch({ type: 'fixture.update', id: selected.id, patch });
          } else {
            const rot: Vec3 = [proxy.rotation.x, proxy.rotation.y, proxy.rotation.z];
            const stepRad = (Math.PI / 180) * 5;
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
