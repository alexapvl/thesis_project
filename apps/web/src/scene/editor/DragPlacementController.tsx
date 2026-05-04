import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { BUILTIN_FIXTURES } from '@stl/fixtures';
import { useStore } from '@/store';
import { instantiateFixture } from '@/scene/fixtures/instantiate';
import { snapVec3 } from '@/scene/document/snap';
import type { Vec3 } from '@/scene/document/reducer';

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
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();

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
      const rect = dom.getBoundingClientRect();
      ndc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      ray.setFromCamera(ndc, ref.current.camera);
      if (!ray.ray.intersectPlane(floor, hit)) return;
      const defaultY = def.kind === 'spot' ? 4 : 2;
      let pos: Vec3 = [hit.x, defaultY, hit.z];
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