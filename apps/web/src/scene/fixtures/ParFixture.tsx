import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BUILTIN_FIXTURES, type FixtureInstance } from '@stl/fixtures';
import { mapLightingFrame } from '@/scene/mappers/mapLightingFrame';
import { useSmoothedLighting } from '@/scene/mappers/SmoothedLightingProvider';
import { downbeatAccent, readOverrideNumber } from '@/scene/mappers/fixtureBehavior';
import { useTransformPreview } from '@/scene/editor/TransformPreviewProvider';
import { useStore } from '@/store';
import {
  fixturePointerHandlers,
  HOVER_TINT,
  SELECTED_TINT,
  type FixtureInteractionProps,
} from './fixture-interaction';

type Props = FixtureInteractionProps & { instance: FixtureInstance };

const PAR_INTENSITY_GAIN = 35;

export function ParFixture({ instance, selected, hovered, onSelect, onHover }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.SpotLight>(null);
  const colorScratch = useMemo(() => new THREE.Color(), []);
  const smoothed = useSmoothedLighting();
  const preview = useTransformPreview();

  const definition = BUILTIN_FIXTURES.find((d) => d.typeId === instance.definitionId);
  const defaults = definition?.defaultProps;
  const angle = readOverrideNumber(instance.overrides, defaults, 'angleRad', Math.PI / 3);
  const distance = readOverrideNumber(instance.overrides, defaults, 'distance', 14);

  useFrame(() => {
    const g = groupRef.current;
    if (!g) return;
    const live = preview.current.fixtureId === instance.id;
    if (live && preview.current.position) g.position.copy(preview.current.position);
    else g.position.set(...instance.position);
    if (live && preview.current.rotation) g.rotation.copy(preview.current.rotation);
    else g.rotation.set(...instance.rotation);

    const render = mapLightingFrame(instance, definition, smoothed.current, colorScratch);
    const accent = downbeatAccent(
      Date.now(),
      useStore.getState().lighting.lastDownbeatTimeMs,
      200,
    );
    const intensity = render.intensity * (1 + accent * 0.25);
    if (lightRef.current) {
      lightRef.current.color.copy(render.color);
      lightRef.current.intensity = intensity * PAR_INTENSITY_GAIN;
    }
  });

  const handlers = fixturePointerHandlers(instance.id, onSelect, onHover);

  return (
    <group ref={groupRef} position={instance.position} rotation={instance.rotation} {...handlers}>
      <spotLight
        ref={lightRef}
        angle={angle}
        penumbra={0.5}
        distance={distance}
        decay={2}
        position={[0, 0.15, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      />
      <mesh position={[0, 0.08, 0]} rotation={[-Math.PI / 6, 0, 0]}>
        <cylinderGeometry args={[0.14, 0.18, 0.22, 16]} />
        <meshStandardMaterial
          color={selected ? SELECTED_TINT : '#64748b'}
          metalness={0.3}
          roughness={0.5}
        />
      </mesh>
      {hovered && !selected && (
        <mesh raycast={() => null}>
          <cylinderGeometry args={[0.2, 0.24, 0.28, 16]} />
          <meshBasicMaterial color={HOVER_TINT} wireframe />
        </mesh>
      )}
    </group>
  );
}
