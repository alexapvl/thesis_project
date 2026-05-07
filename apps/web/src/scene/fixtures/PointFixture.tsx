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

const POINT_INTENSITY_GAIN = 30;

export function PointFixture({ instance, selected, onSelect }: Props) {
  const lightRef = useRef<THREE.PointLight>(null);
  const colorScratch = useMemo(() => new THREE.Color(), []);
  const smoothed = useSmoothedLighting();

  const definition = BUILTIN_FIXTURES.find((d) => d.typeId === instance.definitionId);
  const distance = (instance.overrides.distance as number) ?? 12;

  useFrame(() => {
    const light = lightRef.current;
    if (!light) return;
    const render = mapLightingFrame(instance, definition, smoothed.current, colorScratch);
    light.color.copy(render.color);
    light.intensity = render.intensity * POINT_INTENSITY_GAIN;
  });

  return (
    <group
      position={instance.position}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(instance.id);
      }}
    >
      <pointLight ref={lightRef} distance={distance} />
      <mesh>
        <sphereGeometry args={[0.18, 16, 16]} />
        <meshBasicMaterial color={selected ? '#fbbf24' : '#cbd5e1'} />
      </mesh>
    </group>
  );
}
