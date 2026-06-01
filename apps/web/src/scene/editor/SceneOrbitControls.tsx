import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { createConstantSpeedOrbitControls } from './constant-speed-orbit-controls';

type Props = {
  enabled: boolean;
};

export function SceneOrbitControls({ enabled }: Props) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const set = useThree((s) => s.set);
  const invalidate = useThree((s) => s.invalidate);

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
    set({ controls });
    const onChange = () => invalidate();
    controls.addEventListener('change', onChange);
    return () => {
      controls.removeEventListener('change', onChange);
      controls.dispose();
    };
  }, [controls, set, invalidate]);

  return null;
}
