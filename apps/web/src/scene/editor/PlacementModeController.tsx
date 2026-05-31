import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { BUILTIN_FIXTURES, fixturePlacementMeta } from '@stl/fixtures';
import { useStore } from '@/store';
import { instantiateFixture } from '@/scene/fixtures/instantiate';
import { snapVec3 } from '@/scene/document/snap';
import type { Vec3 } from '@/scene/document/reducer';
import { raycastFloor } from './raycastFloor';

/**
 * Click-to-place: when the user picks a fixture in the catalog, the next
 * click on the stage floor mints a fixture there. Right-click / Esc cancels.
 *
 * Mounted inside <Canvas>. Uses raycasting against the floor plane.
 */
export function PlacementModeController() {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const pendingTypeId = useStore((s) => s.editor.pendingFixtureTypeId);
  const gridSnap = useStore((s) => s.editor.gridSnap);
  const gridSize = useStore((s) => s.editor.gridSize);
  const dispatch = useStore((s) => s.sceneDispatch);
  const newFixtureId = useStore((s) => s.newFixtureId);
  const setPlacement = useStore((s) => s.editorSetPlacement);
  const debugLog = useStore((s) => s.debugLog);

  useEffect(() => {
    if (!pendingTypeId) return;

    const def = BUILTIN_FIXTURES.find((d) => d.typeId === pendingTypeId);
    if (!def) {
      debugLog('warn', `unknown fixture typeId: ${pendingTypeId}`);
      setPlacement(null);
      return;
    }

    const dom = gl.domElement;

    const onClick = (ev: MouseEvent) => {
      if (ev.button !== 0) return;
      const r = raycastFloor(dom, camera, ev.clientX, ev.clientY);
      if (!r.ok) {
        debugLog('warn', `placement skipped: ${r.reason} (tilt the camera down)`);
        return;
      }
      const defaultY = fixturePlacementMeta(def).mountHeight;
      let pos: Vec3 = [r.point[0], defaultY, r.point[2]];
      if (gridSnap) pos = snapVec3(pos, gridSize);
      const inst = instantiateFixture(def, newFixtureId(), pos);
      dispatch({ type: 'fixture.add', fixture: inst });
      debugLog('info', `placed ${def.label} at ${pos.map((n) => n.toFixed(2)).join(', ')}`);
      setPlacement(null);
    };

    const onContext = (ev: MouseEvent) => {
      ev.preventDefault();
      setPlacement(null);
    };

    dom.addEventListener('click', onClick);
    dom.addEventListener('contextmenu', onContext);
    return () => {
      dom.removeEventListener('click', onClick);
      dom.removeEventListener('contextmenu', onContext);
    };
  }, [pendingTypeId, gl, camera, gridSnap, gridSize, dispatch, newFixtureId, setPlacement, debugLog]);

  return null;
}
