import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BUILTIN_FIXTURES, type FixtureInstance } from '@stl/fixtures';
import { mapLightingFrame } from '@/scene/mappers/mapLightingFrame';
import { useSmoothedLighting } from '@/scene/mappers/SmoothedLightingProvider';

type Props = {
  instance: FixtureInstance;
  selected: boolean;
  onSelect: (id: string) => void;
};

const SPOT_INTENSITY_GAIN = 60;

export function SpotFixture({ instance, selected, onSelect }: Props) {
  const lightRef = useRef<THREE.SpotLight>(null);
  const targetObj = useMemo(() => new THREE.Object3D(), []);
  const colorScratch = useMemo(() => new THREE.Color(), []);
  const smoothed = useSmoothedLighting();

  const definition = BUILTIN_FIXTURES.find((d) => d.typeId === instance.definitionId);
  const angle = (instance.overrides.angleRad as number) ?? Math.PI / 6;
  const distance = (instance.overrides.distance as number) ?? 30;
  const penumbra = (instance.overrides.penumbra as number) ?? 0.2;

  targetObj.position.set(...instance.target);

  useFrame(() => {
    const light = lightRef.current;
    if (!light) return;
    const render = mapLightingFrame(instance, definition, smoothed.current, colorScratch);
    light.color.copy(render.color);
    light.intensity = render.intensity * SPOT_INTENSITY_GAIN;
  });

  return (
    <group
      position={instance.position}
      rotation={instance.rotation}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(instance.id);
      }}
    >
      <primitive object={targetObj} />
      <spotLight
        ref={lightRef}
        angle={angle}
        penumbra={penumbra}
        distance={distance}
        target={targetObj}
        castShadow={false}
      />
      <mesh>
        <boxGeometry args={[0.4, 0.25, 0.4]} />
        <meshStandardMaterial
          color={selected ? '#fbbf24' : '#cbd5e1'}
          emissive={selected ? '#fbbf24' : '#1e293b'}
          emissiveIntensity={selected ? 0.4 : 0.1}
        />
      </mesh>
      {selected && (
        <mesh>
          <boxGeometry args={[0.5, 0.35, 0.5]} />
          <meshBasicMaterial color="#fbbf24" wireframe />
        </mesh>
      )}
    </group>
  );
}
