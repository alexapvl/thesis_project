import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BUILTIN_FIXTURES, type FixtureInstance } from '@stl/fixtures';
import { mapLightingFrame } from '@/scene/mappers/mapLightingFrame';
import { useSmoothedLighting } from '@/scene/mappers/SmoothedLightingProvider';
import { chaseIndex, downbeatAccent, readOverrideNumber } from '@/scene/mappers/fixtureBehavior';
import { useTransformPreview } from '@/scene/editor/TransformPreviewProvider';
import { useStore } from '@/store';
import {
  fixturePointerHandlers,
  HOVER_TINT,
  type FixtureInteractionProps,
} from './fixture-interaction';

type Props = FixtureInteractionProps & { instance: FixtureInstance };

export function BarFixture({ instance, selected, hovered, onSelect, onHover }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const pixelMats = useRef<THREE.MeshStandardMaterial[]>([]);
  const colorScratch = useMemo(() => new THREE.Color(), []);
  const smoothed = useSmoothedLighting();
  const preview = useTransformPreview();

  const definition = BUILTIN_FIXTURES.find((d) => d.typeId === instance.definitionId);
  const defaults = definition?.defaultProps;
  const pixelCount = Math.round(
    readOverrideNumber(instance.overrides, defaults, 'pixelCount', 8),
  );
  const barLength = readOverrideNumber(instance.overrides, defaults, 'barLength', 1.6);

  const pixelXs = useMemo(() => {
    const out: number[] = [];
    for (let i = 0; i < pixelCount; i++) {
      out.push((i / Math.max(1, pixelCount - 1) - 0.5) * barLength);
    }
    return out;
  }, [pixelCount, barLength]);

  useFrame(() => {
    const g = groupRef.current;
    if (!g) return;
    const live = preview.current.fixtureId === instance.id;
    if (live && preview.current.position) g.position.copy(preview.current.position);
    else g.position.set(...instance.position);
    if (live && preview.current.rotation) g.rotation.copy(preview.current.rotation);
    else g.rotation.set(...instance.rotation);

    const lighting = useStore.getState().lighting;
    const beatMs = lighting.lastBeatTimeMs ?? 0;
    const head = chaseIndex(beatMs, pixelCount);
    const accent = downbeatAccent(Date.now(), lighting.lastDownbeatTimeMs, 150);
    const render = mapLightingFrame(instance, definition, smoothed.current, colorScratch);
    const base = render.intensity;

    pixelMats.current.forEach((mat, i) => {
      const dist = Math.abs(i - head);
      const trail = dist === 0 ? 1 : dist === 1 ? 0.45 : 0.08;
      const flash = accent > 0.5 ? 1 : trail;
      mat.color.copy(render.color);
      mat.emissive.copy(render.color);
      mat.emissiveIntensity = base * flash * 2.5;
    });
  });

  const handlers = fixturePointerHandlers(instance.id, onSelect, onHover);

  return (
    <group ref={groupRef} position={instance.position} rotation={instance.rotation} {...handlers}>
      <mesh>
        <boxGeometry args={[barLength + 0.1, 0.08, 0.1]} />
        <meshStandardMaterial color="#1e293b" metalness={0.4} roughness={0.5} />
      </mesh>
      {pixelXs.map((x, i) => (
        <mesh key={i} position={[x, 0.06, 0.02]}>
          <boxGeometry args={[barLength / pixelCount * 0.7, 0.06, 0.06]} />
          <meshStandardMaterial
            ref={(m) => {
              if (m) pixelMats.current[i] = m;
            }}
            color="#334155"
            emissive="#000000"
            emissiveIntensity={0}
          />
        </mesh>
      ))}
      {hovered && !selected && (
        <mesh raycast={() => null}>
          <boxGeometry args={[barLength + 0.15, 0.14, 0.14]} />
          <meshBasicMaterial color={HOVER_TINT} wireframe />
        </mesh>
      )}
    </group>
  );
}
