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
  type FixtureInteractionProps,
} from './fixture-interaction';

type Props = FixtureInteractionProps & { instance: FixtureInstance };

const WARM = new THREE.Color('#fcd34d');

export function BlinderFixture({ instance, selected, hovered, onSelect, onHover }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const lampsRef = useRef<THREE.MeshStandardMaterial[]>([]);
  const colorScratch = useMemo(() => new THREE.Color(), []);
  const smoothed = useSmoothedLighting();
  const { applyBasePose } = useFixtureBase(instance);

  const definition = BUILTIN_FIXTURES.find((d) => d.typeId === instance.definitionId);
  const defaults = definition?.defaultProps;
  const rows = Math.round(readOverrideNumber(instance.overrides, defaults, 'lampRows', 2));
  const cols = Math.round(readOverrideNumber(instance.overrides, defaults, 'lampCols', 2));

  const lampPositions = useMemo(() => {
    const out: [number, number, number][] = [];
    const spacing = 0.22;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        out.push([
          (c - (cols - 1) / 2) * spacing,
          (r - (rows - 1) / 2) * spacing * 0.8,
          0.12,
        ]);
      }
    }
    return out;
  }, [rows, cols]);

  useFrame(() => {
    const g = groupRef.current;
    if (g) applyBasePose(g);

    const render = mapLightingFrame(instance, definition, smoothed.current, colorScratch);
    const accent = downbeatAccent(
      Date.now(),
      useStore.getState().lighting.lastDownbeatTimeMs,
      250,
    );
    const emissive = render.intensity * (0.6 + accent * 1.4);
    for (const mat of lampsRef.current) {
      mat.emissive.copy(WARM);
      mat.emissiveIntensity = emissive;
      mat.color.copy(WARM);
    }
  });

  const handlers = fixturePointerHandlers(instance.id, onSelect, onHover);

  return (
    <group ref={groupRef} position={instance.position} rotation={instance.rotation} {...handlers}>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.5 + cols * 0.1, 0.4 + rows * 0.08, 0.08]} />
        <meshStandardMaterial color="#1e293b" metalness={0.4} roughness={0.6} />
      </mesh>
      {lampPositions.map((pos, i) => (
        <mesh key={i} position={pos}>
          <sphereGeometry args={[0.08, 12, 12]} />
          <meshStandardMaterial
            ref={(m) => {
              if (m) lampsRef.current[i] = m;
            }}
            color={WARM}
            emissive={WARM}
            emissiveIntensity={0}
          />
        </mesh>
      ))}
      {hovered && !selected && (
        <mesh raycast={() => null}>
          <boxGeometry args={[0.55 + cols * 0.1, 0.45 + rows * 0.08, 0.12]} />
          <meshBasicMaterial color={HOVER_TINT} wireframe />
        </mesh>
      )}
    </group>
  );
}
