import { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Grid, OrbitControls } from '@react-three/drei';
import { useStore } from '@/store';
import { FixtureRenderer } from '@/scene/fixtures/FixtureRenderer';
import { SmoothedLightingProvider } from '@/scene/mappers/SmoothedLightingProvider';
import { PlacementModeController } from './PlacementModeController';
import { DragPlacementController } from './DragPlacementController';
import { PlacementGhost } from './PlacementGhost';
import { TransformHandles } from './TransformHandles';
import { TargetHandle } from './TargetHandle';

export function SceneCanvas() {
  const dispatch = useStore((s) => s.sceneDispatch);
  const placement = useStore((s) => s.editor.pendingFixtureTypeId);
  const [orbitEnabled, setOrbitEnabled] = useState(true);
  const [transformMode, setTransformMode] = useState<'translate' | 'rotate'>('translate');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'g') setTransformMode('translate');
      else if (e.key === 'r') setTransformMode('rotate');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <Canvas
      camera={{ position: [6, 6, 8], fov: 50 }}
      onPointerMissed={() => {
        if (!placement) dispatch({ type: 'selection.set', id: null });
      }}
    >
      <ambientLight intensity={0.3} />
      <directionalLight position={[10, 10, 5]} intensity={0.6} />
      <Grid args={[20, 20]} cellColor="#334155" sectionColor="#475569" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]}>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#0b1220" />
      </mesh>

      <SmoothedLightingProvider>
        <FixtureRenderer />
      </SmoothedLightingProvider>

      <PlacementModeController />
      <DragPlacementController />
      <PlacementGhost />
      <TransformHandles mode={transformMode} setOrbitEnabled={setOrbitEnabled} />
      <TargetHandle setOrbitEnabled={setOrbitEnabled} />

      <OrbitControls enabled={orbitEnabled} makeDefault zoomSpeed={0.4} />
    </Canvas>
  );
}