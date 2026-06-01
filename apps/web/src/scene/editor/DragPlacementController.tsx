import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import {
  BUILTIN_FIXTURES,
  BUILTIN_STRUCTURES,
  fixturePlacementMeta,
  isStructureTypeId,
} from '@stl/fixtures';
import { useStore } from '@/store';
import { instantiateFixture } from '@/scene/fixtures/instantiate';
import { instantiateStructure } from '@/scene/structures/instantiateStructure';
import { snapVec3 } from '@/scene/document/snap';
import type { Vec3 } from '@/scene/document/reducer';
import { raycastFloor } from './raycastFloor';
import { composeRotation } from './composeRotation';
import { resolveFixtureDrop } from './resolveFixtureDrop';

export const FIXTURE_DRAG_MIME = 'application/x-stl-fixture-typeid';

export function DragPlacementController() {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const structures = useStore((s) => s.scene.doc.structures);
  const gridSnap = useStore((s) => s.editor.gridSnap);
  const gridSize = useStore((s) => s.editor.gridSize);
  const dispatch = useStore((s) => s.sceneDispatch);
  const newFixtureId = useStore((s) => s.newFixtureId);
  const debugLog = useStore((s) => s.debugLog);

  const ref = useRef({ camera, gl, structures });
  ref.current.camera = camera;
  ref.current.gl = gl;
  ref.current.structures = structures;

  useEffect(() => {
    const dom = gl.domElement;

    const onDragOver = (ev: DragEvent) => {
      if (ev.dataTransfer?.types.includes(FIXTURE_DRAG_MIME)) {
        ev.preventDefault();
        ev.dataTransfer.dropEffect = 'copy';
      }
    };

    const onDrop = (ev: DragEvent) => {
      const typeId = ev.dataTransfer?.getData(FIXTURE_DRAG_MIME);
      if (!typeId) return;
      ev.preventDefault();

      if (isStructureTypeId(typeId)) {
        const def = BUILTIN_STRUCTURES.find((d) => d.typeId === typeId);
        if (!def) {
          debugLog('warn', `dropped unknown structure typeId: ${typeId}`);
          return;
        }
        const r = raycastFloor(dom, ref.current.camera, ev.clientX, ev.clientY);
        if (!r.ok) {
          debugLog('warn', `drop ignored: ${r.reason} (tilt the camera down)`);
          return;
        }
        let pos: Vec3 = [r.point[0], 0, r.point[2]];
        if (gridSnap) pos = snapVec3(pos, gridSize);
        const pendingRotation = useStore.getState().editor.pendingRotation;
        const inst = instantiateStructure(def, newFixtureId(), pos, pendingRotation);
        dispatch({ type: 'structure.add', structure: inst });
        debugLog('info', `dropped ${def.label} at ${pos.map((n) => n.toFixed(2)).join(', ')}`);
        return;
      }

      const def = BUILTIN_FIXTURES.find((d) => d.typeId === typeId);
      if (!def) {
        debugLog('warn', `dropped unknown fixture typeId: ${typeId}`);
        return;
      }

      const { groundRestHeight } = fixturePlacementMeta(def);
      const drop = resolveFixtureDrop(
        dom,
        ref.current.camera,
        ev.clientX,
        ev.clientY,
        ref.current.structures,
        groundRestHeight,
      );
      if (drop.kind === 'none') {
        debugLog('warn', `drop ignored: ${drop.reason}`);
        return;
      }

      const id = newFixtureId();
      const pendingRotation = useStore.getState().editor.pendingRotation;
      if (drop.kind === 'mount') {
        let pos = drop.position;
        if (gridSnap) pos = snapVec3(pos, gridSize);
        const rotation = composeRotation(drop.rotation, pendingRotation);
        const inst = instantiateFixture(def, id, pos, { rotation });
        dispatch({ type: 'fixture.add', fixture: inst });
        dispatch({
          type: 'fixture.mount',
          id,
          structureId: drop.structureId,
          socketId: drop.socketId,
        });
        debugLog('info', `dropped ${def.label} on structure`);
      } else {
        let pos = drop.position;
        if (gridSnap) pos = snapVec3(pos, gridSize);
        const inst = instantiateFixture(def, id, pos, {
          onGround: true,
          rotation: pendingRotation,
        });
        dispatch({ type: 'fixture.add', fixture: inst });
        debugLog('info', `dropped ${def.label} on ground`);
      }
    };

    dom.addEventListener('dragover', onDragOver);
    dom.addEventListener('drop', onDrop);
    return () => {
      dom.removeEventListener('dragover', onDragOver);
      dom.removeEventListener('drop', onDrop);
    };
  }, [gl, gridSnap, gridSize, dispatch, newFixtureId, debugLog]);

  return null;
}
