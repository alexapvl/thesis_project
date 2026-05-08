import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BUILTIN_FIXTURES, type FixtureInstance } from '@stl/fixtures';
import { mapLightingFrame } from '@/scene/mappers/mapLightingFrame';
import { useSmoothedLighting } from '@/scene/mappers/SmoothedLightingProvider';
import { useTransformPreview } from '@/scene/editor/TransformPreviewProvider';

type Props = {
  instance: FixtureInstance;
  selected: boolean;
  onSelect: (id: string) => void;
};

const SPOT_INTENSITY_GAIN = 60;

export function SpotFixture({ instance, selected, onSelect }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.SpotLight>(null);
  const targetObj = useMemo(() => new THREE.Object3D(), []);
  const colorScratch = useMemo(() => new THREE.Color(), []);
  const smoothed = useSmoothedLighting();
  const preview = useTransformPreview();

  const definition = BUILTIN_FIXTURES.find((d) => d.typeId === instance.definitionId);
  const angle = (instance.overrides.angleRad as number) ?? Math.PI / 6;
  const distance = (instance.overrides.distance as number) ?? 30;
  const penumbra = (instance.overrides.penumbra as number) ?? 0.2;

  targetObj.position.set(...instance.target);

  useFrame(() => {
    const light = lightRef.current;
    if (light) {
      const render = mapLightingFrame(instance, definition, smoothed.current, colorScratch);
      light.color.copy(render.color);
      light.intensity = render.intensity * SPOT_INTENSITY_GAIN;
    }
    // In-flight transform preview: while the user drags this fixture's
    // gizmo, follow the proxy live. When idle, snap back to the doc.
    const g = groupRef.current;
    if (!g) return;
    const live = preview.current.fixtureId === instance.id;
    if (live && preview.current.position) {
      g.position.copy(preview.current.position);
    } else {
      g.position.set(...instance.position);
    }
    if (live && preview.current.rotation) {
      g.rotation.copy(preview.current.rotation);
    } else {
      g.rotation.set(...instance.rotation);
    }
  });

  return (
    <group
      ref={groupRef}
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
