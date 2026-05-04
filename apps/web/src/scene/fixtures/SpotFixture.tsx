import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { FixtureInstance } from '@stl/fixtures';
import { useStore } from '@/store';

type Props = {
  instance: FixtureInstance;
  selected: boolean;
  onSelect: (id: string) => void;
};

/** Renders a spotlight as a body cube + a directional cone, all aiming at `target`. */
export function SpotFixture({ instance, selected, onSelect }: Props) {
  const group = useRef<THREE.Group>(null);
  const targetObj = useMemo(() => new THREE.Object3D(), []);
  const lighting = useStore((s) => s.lighting);

  const angle = (instance.overrides.angleRad as number) ?? Math.PI / 6;
  const distance = (instance.overrides.distance as number) ?? 30;
  const intensity = (instance.overrides.intensity as number) ?? 1.0;

  const color = useMemo(() => {
    const c = new THREE.Color();
    c.setHSL(((lighting.hue % 360) + 360) % 360 / 360, 0.7, 0.5);
    return c;
  }, [lighting.hue]);

  const runtimeIntensity = instance.enabled
    ? intensity * (lighting.value > 0 ? lighting.value : 0.4)
    : 0;

  // Update the target Object3D each render so the spotLight aims correctly.
  targetObj.position.set(...instance.target);

  return (
    <group
      ref={group}
      position={instance.position}
      rotation={instance.rotation}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(instance.id);
      }}
    >
      <primitive object={targetObj} />
      <spotLight
        color={color}
        intensity={runtimeIntensity * 60}
        angle={angle}
        penumbra={(instance.overrides.penumbra as number) ?? 0.2}
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