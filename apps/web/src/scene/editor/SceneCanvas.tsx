import { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment, Grid, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '@/store';
import { FixtureRenderer } from '@/scene/fixtures/FixtureRenderer';
import { StructureRenderer } from '@/scene/structures/StructureRenderer';
import { SocketPicker } from './SocketPicker';
import { StructureTransformHandles } from './StructureTransformHandles';
import { SmoothedLightingProvider } from '@/scene/mappers/SmoothedLightingProvider';
import { PlacementModeController } from './PlacementModeController';
import { DragPlacementController } from './DragPlacementController';
import { PlacementGhost } from './PlacementGhost';
import { TransformHandles } from './TransformHandles';
import { TargetHandle } from './TargetHandle';
import { TransformPreviewProvider } from './TransformPreviewProvider';

export function SceneCanvas() {
  const dispatch = useStore((s) => s.sceneDispatch);
  const placement = useStore(
    (s) => s.editor.pendingFixtureTypeId ?? s.editor.pendingStructureTypeId,
  );
  const [orbitEnabled, setOrbitEnabled] = useState(true);
  const [transformMode, setTransformMode] = useState<'translate' | 'rotate'>('translate');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (placement) return;
      if (e.key === 'g') setTransformMode('translate');
      else if (e.key === 'r') setTransformMode('rotate');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [placement]);

  return (
    <Canvas
      camera={{ position: [6, 6, 8], fov: 50 }}
      gl={{ antialias: true }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
        gl.localClippingEnabled = true;
      }}
      onPointerMissed={() => {
        if (!placement) {
          dispatch({ type: 'selection.set', id: null });
          dispatch({ type: 'structure.select', id: null });
        }
      }}
    >
      <color attach="background" args={['#0b1220']} />
      <Environment preset="warehouse" background={false} environmentIntensity={0.35} />
      <ambientLight intensity={0.18} />
      <directionalLight position={[10, 12, 6]} intensity={0.35} />
      <Grid args={[20, 20]} cellColor="#334155" sectionColor="#475569" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]}>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial
          color="#111827"
          metalness={0.12}
          roughness={0.72}
          envMapIntensity={0.45}
        />
      </mesh>

      <TransformPreviewProvider>
        <StructureRenderer />
        <SmoothedLightingProvider>
          <FixtureRenderer />
        </SmoothedLightingProvider>

        <PlacementModeController />
        <DragPlacementController />
        <PlacementGhost />
        <SocketPicker />
        <StructureTransformHandles mode={transformMode} setOrbitEnabled={setOrbitEnabled} />
        <TransformHandles mode={transformMode} setOrbitEnabled={setOrbitEnabled} />
        <TargetHandle setOrbitEnabled={setOrbitEnabled} />
      </TransformPreviewProvider>

      <OrbitControls enabled={orbitEnabled} makeDefault zoomSpeed={0.4} />
    </Canvas>
  );
}
