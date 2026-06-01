import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BUILTIN_FIXTURES, type FixtureInstance } from '@stl/fixtures';
import { mapLightingFrame } from '@/scene/mappers/mapLightingFrame';
import { useSmoothedLighting } from '@/scene/mappers/SmoothedLightingProvider';
import { downbeatAccent, readOverrideNumber } from '@/scene/mappers/fixtureBehavior';
import { useFixtureBase } from './useFixtureBase';
import { useStore } from '@/store';
import {
  fixturePointerHandlers,
  HOVER_TINT,
  SELECTED_TINT,
  type FixtureInteractionProps,
} from './fixture-interaction';

type Props = FixtureInteractionProps & { instance: FixtureInstance };

const PAR_INTENSITY_GAIN = 35;

/** 14 LED positions on the PAR face (local XY, front at -Z). */
const PAR_LED_OFFSETS: ReadonlyArray<readonly [number, number]> = (() => {
  const out: [number, number][] = [[0, 0]];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    out.push([Math.cos(a) * 0.1, Math.sin(a) * 0.1]);
  }
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + Math.PI / 14;
    out.push([Math.cos(a) * 0.17, Math.sin(a) * 0.17]);
  }
  return out;
})();

export function ParFixture({ instance, selected, hovered, onSelect, onHover }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.SpotLight>(null);
  const lensMats = useRef<THREE.MeshStandardMaterial[]>([]);
  const colorScratch = useMemo(() => new THREE.Color(), []);
  const smoothed = useSmoothedLighting();
  const { applyBasePose } = useFixtureBase(instance);

  const definition = BUILTIN_FIXTURES.find((d) => d.typeId === instance.definitionId);
  const defaults = definition?.defaultProps;
  const angle = readOverrideNumber(instance.overrides, defaults, 'angleRad', Math.PI / 3);
  const distance = readOverrideNumber(instance.overrides, defaults, 'distance', 14);

  useFrame(() => {
    const g = groupRef.current;
    if (g) applyBasePose(g);

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
    for (const mat of lensMats.current) {
      mat.color.copy(render.color);
      mat.emissive.copy(render.color);
      mat.emissiveIntensity = intensity * 0.8;
    }
  });

  const handlers = fixturePointerHandlers(instance.id, onSelect, onHover);
  const housingColor = selected ? SELECTED_TINT : '#64748b';

  return (
    <group ref={groupRef} {...handlers}>
      <spotLight
        ref={lightRef}
        angle={angle}
        penumbra={0.5}
        distance={distance}
        decay={2}
        position={[0, 0, -0.12]}
        rotation={[-Math.PI / 2, 0, 0]}
      />
      <mesh position={[0, 0, 0.06]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.17, 0.19, 0.1, 16]} />
        <meshStandardMaterial color={housingColor} metalness={0.45} roughness={0.45} />
      </mesh>
      {PAR_LED_OFFSETS.map(([x, y], i) => (
        <mesh key={i} position={[x, y, -0.05]} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.028, 12]} />
          <meshStandardMaterial
            ref={(m) => {
              if (m) lensMats.current[i] = m;
            }}
            color="#334155"
            emissive="#000000"
            emissiveIntensity={0}
            metalness={0.2}
            roughness={0.4}
          />
        </mesh>
      ))}
      <mesh position={[-0.2, 0, 0.08]} rotation={[0, 0, Math.PI / 2]}>
        <boxGeometry args={[0.02, 0.14, 0.04]} />
        <meshStandardMaterial color="#1e293b" metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh position={[0.2, 0, 0.08]} rotation={[0, 0, Math.PI / 2]}>
        <boxGeometry args={[0.02, 0.14, 0.04]} />
        <meshStandardMaterial color="#1e293b" metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh position={[0, -0.12, 0.1]} rotation={[Math.PI / 2, 0, 0]}>
        <boxGeometry args={[0.42, 0.02, 0.04]} />
        <meshStandardMaterial color="#1e293b" metalness={0.5} roughness={0.5} />
      </mesh>
      {hovered && !selected && (
        <mesh raycast={() => null} position={[0, 0, -0.06]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.22, 0.24, 0.12, 16]} />
          <meshBasicMaterial color={HOVER_TINT} wireframe />
        </mesh>
      )}
    </group>
  );
}
