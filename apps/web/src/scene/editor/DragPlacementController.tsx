import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { BUILTIN_FIXTURES, fixturePlacementMeta } from '@stl/fixtures';
import { useStore } from '@/store';
import { instantiateFixture } from '@/scene/fixtures/instantiate';
import { snapVec3 } from '@/scene/document/snap';
import type { Vec3 } from '@/scene/document/reducer';
import { raycastFloor } from './raycastFloor';

export const FIXTURE_DRAG_MIME = 'application/x-stl-fixture-typeid';

/**
 * Drag-to-place: catalog items use HTML5 drag with mime FIXTURE_DRAG_MIME.
 * On drop into the canvas DOM element, raycast the floor and add a fixture.
 * Produces the same FixtureInstance shape as click-to-place.
 */
export function DragPlacementController() {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const gridSnap = useStore((s) => s.editor.gridSnap);
  const gridSize = useStore((s) => s.editor.gridSize);
  const dispatch = useStore((s) => s.sceneDispatch);
  const newFixtureId = useStore((s) => s.newFixtureId);
  const debugLog = useStore((s) => s.debugLog);

  const ref = useRef({ camera, gl });
  ref.current.camera = camera;
  ref.current.gl = gl;

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
      const def = BUILTIN_FIXTURES.find((d) => d.typeId === typeId);
      if (!def) {
        debugLog('warn', `dropped unknown fixture typeId: ${typeId}`);
        return;
      }
      const r = raycastFloor(dom, ref.current.camera, ev.clientX, ev.clientY);
      if (!r.ok) {
        debugLog('warn', `drop ignored: ${r.reason} (tilt the camera down)`);
        return;
      }
      const defaultY = fixturePlacementMeta(def).mountHeight;
      let pos: Vec3 = [r.point[0], defaultY, r.point[2]];
      if (gridSnap) pos = snapVec3(pos, gridSize);
      const inst = instantiateFixture(def, newFixtureId(), pos);
      dispatch({ type: 'fixture.add', fixture: inst });
      debugLog('info', `dropped ${def.label} at ${pos.map((n) => n.toFixed(2)).join(', ')}`);
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
