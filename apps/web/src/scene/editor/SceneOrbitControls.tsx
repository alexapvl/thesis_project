import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { loadViewport, saveViewport } from '@/features/persistence/viewportStorage';
import { createConstantSpeedOrbitControls } from './constant-speed-orbit-controls';

const VIEWPORT_DEBOUNCE_MS = 500;

type Props = {
  enabled: boolean;
};

export function SceneOrbitControls({ enabled }: Props) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const set = useThree((s) => s.set);
  const invalidate = useThree((s) => s.invalidate);
  const restoredRef = useRef(false);

  const controls = useMemo(
    () => createConstantSpeedOrbitControls(camera, gl.domElement),
    [camera, gl],
  );

  useFrame(() => {
    if (controls.enabled) controls.update();
  }, -1);

  useEffect(() => {
    controls.enabled = enabled;
  }, [enabled, controls]);

  useEffect(() => {
    if (!restoredRef.current) {
      const saved = loadViewport();
      if (saved) {
        camera.position.set(saved.position[0], saved.position[1], saved.position[2]);
        controls.target.set(saved.target[0], saved.target[1], saved.target[2]);
        controls.update();
      }
      restoredRef.current = true;
    }

    set({ controls });
    let timer: number | undefined;
    const onChange = () => {
      invalidate();
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        saveViewport({
          position: [camera.position.x, camera.position.y, camera.position.z],
          target: [controls.target.x, controls.target.y, controls.target.z],
        });
      }, VIEWPORT_DEBOUNCE_MS);
    };
    controls.addEventListener('change', onChange);
    return () => {
      window.clearTimeout(timer);
      controls.removeEventListener('change', onChange);
      controls.dispose();
    };
  }, [controls, camera, set, invalidate]);

  return null;
}
