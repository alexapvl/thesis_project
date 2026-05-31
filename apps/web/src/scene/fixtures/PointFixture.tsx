import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BUILTIN_FIXTURES, type FixtureInstance } from '@stl/fixtures';
import { mapLightingFrame } from '@/scene/mappers/mapLightingFrame';
import { useSmoothedLighting } from '@/scene/mappers/SmoothedLightingProvider';
import { useFixtureBase } from './useFixtureBase';
import { fixturePointerHandlers, HOVER_TINT, SELECTED_TINT, type FixtureInteractionProps } from './fixture-interaction';

const POINT_INTENSITY_GAIN = 30;

type Props = FixtureInteractionProps & { instance: FixtureInstance };

export function PointFixture({ instance, selected, hovered, onSelect, onHover }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const colorScratch = useMemo(() => new THREE.Color(), []);
  const smoothed = useSmoothedLighting();
  const { applyBasePose } = useFixtureBase(instance);
  const handlers = fixturePointerHandlers(instance.id, onSelect, onHover);

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
    if (g) applyBasePose(g);
  });

  return (
    <group ref={groupRef} position={instance.position} {...handlers}>
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
