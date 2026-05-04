import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { BUILTIN_FIXTURES } from '@stl/fixtures';
import { useStore } from '@/store';
import { instantiateFixture } from '@/scene/fixtures/instantiate';
import { snapVec3 } from '@/scene/document/snap';
import type { Vec3 } from '@/scene/document/reducer';

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
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();

    const onClick = (ev: MouseEvent) => {
      if (ev.button !== 0) return;
      const rect = dom.getBoundingClientRect();
      ndc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      ray.setFromCamera(ndc, camera);
      if (!ray.ray.intersectPlane(floor, hit)) return;
      const defaultY = def.kind === 'spot' ? 4 : 2;
      let pos: Vec3 = [hit.x, defaultY, hit.z];
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