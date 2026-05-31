import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BUILTIN_FIXTURES, type FixtureInstance } from '@stl/fixtures';
import { mapLightingFrame } from '@/scene/mappers/mapLightingFrame';
import { useSmoothedLighting } from '@/scene/mappers/SmoothedLightingProvider';
import { useTransformPreview } from '@/scene/editor/TransformPreviewProvider';

const HOVER_TINT = '#22d3ee';
const SELECTED_TINT = '#fbbf24';

type Props = {
  instance: FixtureInstance;
  selected: boolean;
  hovered: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
};

const POINT_INTENSITY_GAIN = 30;

export function PointFixture({ instance, selected, hovered, onSelect, onHover }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const colorScratch = useMemo(() => new THREE.Color(), []);
  const smoothed = useSmoothedLighting();
  const preview = useTransformPreview();

  const definition = BUILTIN_FIXTURES.find((d) => d.typeId === instance.definitionId);
  const distance = (instance.overrides.distance as number) ?? 12;

  useFrame(() => {
    const light = lightRef.current;
    if (light) {
      const render = mapLightingFrame(instance, definition, smoothed.current, colorScratch);
      light.color.copy(render.color);
      light.intensity = render.intensity * POINT_INTENSITY_GAIN;
    }
    const g = groupRef.current;
    if (!g) return;
    const live = preview.current.fixtureId === instance.id;
    if (live && preview.current.position) {
      g.position.copy(preview.current.position);
    } else {
      g.position.set(...instance.position);
    }
    // Point fixtures have no rotation in v1, but apply for consistency.
    if (live && preview.current.rotation) {
      g.rotation.copy(preview.current.rotation);
    }
  });

  return (
    <group
      ref={groupRef}
      position={instance.position}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(instance.id);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover(instance.id);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        onHover(null);
        document.body.style.cursor = 'default';
      }}
    >
      <pointLight ref={lightRef} distance={distance} />
      <mesh>
        <sphereGeometry args={[0.18, 16, 16]} />
        <meshBasicMaterial color={selected ? SELECTED_TINT : '#cbd5e1'} />
      </mesh>
      {hovered && !selected && (
        <mesh raycast={() => null}>
          <sphereGeometry args={[0.24, 16, 16]} />
          <meshBasicMaterial color={HOVER_TINT} wireframe />
        </mesh>
      )}
    </group>
  );
}
