import { useMemo } from 'react';
import * as THREE from 'three';
import type { FixtureInstance } from '@stl/fixtures';
import { useStore } from '@/store';

type Props = {
  instance: FixtureInstance;
  selected: boolean;
  onSelect: (id: string) => void;
};

export function PointFixture({ instance, selected, onSelect }: Props) {
  const lighting = useStore((s) => s.lighting);
  const distance = (instance.overrides.distance as number) ?? 12;
  const intensity = (instance.overrides.intensity as number) ?? 0.6;

  const color = useMemo(() => {
    const c = new THREE.Color();
    c.setHSL(((lighting.hue % 360) + 360) % 360 / 360, 0.7, 0.5);
    return c;
  }, [lighting.hue]);

  const runtimeIntensity = instance.enabled
    ? intensity * (lighting.value > 0 ? lighting.value : 0.4)
    : 0;

  return (
    <group
      position={instance.position}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(instance.id);
      }}
    >
      <pointLight color={color} intensity={runtimeIntensity * 30} distance={distance} />
      <mesh>
        <sphereGeometry args={[0.18, 16, 16]} />
        <meshBasicMaterial color={selected ? '#fbbf24' : '#cbd5e1'} />
      </mesh>
    </group>
  );
}