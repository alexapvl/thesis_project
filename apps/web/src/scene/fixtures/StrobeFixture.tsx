import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BUILTIN_FIXTURES, type FixtureInstance } from '@stl/fixtures';
import { mapLightingFrame } from '@/scene/mappers/mapLightingFrame';
import { useSmoothedLighting } from '@/scene/mappers/SmoothedLightingProvider';
import { readOverrideNumber, strobeEnvelope } from '@/scene/mappers/fixtureBehavior';
import { useTransformPreview } from '@/scene/editor/TransformPreviewProvider';
import { useStore } from '@/store';
import {
  fixturePointerHandlers,
  HOVER_TINT,
  type FixtureInteractionProps,
} from './fixture-interaction';

type Props = FixtureInteractionProps & { instance: FixtureInstance };

export function StrobeFixture({ instance, selected, hovered, onSelect, onHover }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const panelRef = useRef<THREE.MeshStandardMaterial>(null);
  const colorScratch = useMemo(() => new THREE.Color(), []);
  const smoothed = useSmoothedLighting();
  const preview = useTransformPreview();

  const definition = BUILTIN_FIXTURES.find((d) => d.typeId === instance.definitionId);
  const defaults = definition?.defaultProps;
  const flashMs = readOverrideNumber(instance.overrides, defaults, 'flashMs', 80);
  const useDownbeatOnly =
    (instance.overrides.useDownbeatOnly as boolean) ??
    (defaults?.useDownbeatOnly as boolean) ??
    false;

  useFrame(() => {
    const g = groupRef.current;
    if (!g) return;
    const live = preview.current.fixtureId === instance.id;
    if (live && preview.current.position) g.position.copy(preview.current.position);
    else g.position.set(...instance.position);
    if (live && preview.current.rotation) g.rotation.copy(preview.current.rotation);
    else g.rotation.set(...instance.rotation);

    const lighting = useStore.getState().lighting;
    const now = Date.now();
    const triggerMs = useDownbeatOnly ? lighting.lastDownbeatTimeMs : lighting.lastBeatTimeMs;
    const flash = strobeEnvelope(now, triggerMs, flashMs);
    const render = mapLightingFrame(instance, definition, smoothed.current, colorScratch);
    const brightness = render.intensity * flash;

    if (panelRef.current) {
      panelRef.current.color.set('#e2e8f0');
      panelRef.current.emissive.copy(render.color);
      panelRef.current.emissiveIntensity = brightness * 4;
    }
  });

  const handlers = fixturePointerHandlers(instance.id, onSelect, onHover);

  return (
    <group ref={groupRef} position={instance.position} rotation={instance.rotation} {...handlers}>
      <mesh>
        <boxGeometry args={[0.35, 0.28, 0.12]} />
        <meshStandardMaterial color="#0f172a" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0, 0.07]}>
        <planeGeometry args={[0.3, 0.22]} />
        <meshStandardMaterial ref={panelRef} color="#1e293b" emissive="#000000" emissiveIntensity={0} />
      </mesh>
      {hovered && !selected && (
        <mesh raycast={() => null}>
          <boxGeometry args={[0.4, 0.32, 0.16]} />
          <meshBasicMaterial color={HOVER_TINT} wireframe />
        </mesh>
      )}
    </group>
  );
}
