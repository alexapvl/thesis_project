import { useEffect, useMemo, useRef } from 'react';
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

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

export function MatrixFixture({ instance, selected, hovered, onSelect, onHover }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const colorScratch = useMemo(() => new THREE.Color(), []);
  const smoothed = useSmoothedLighting();
  const { applyBasePose } = useFixtureBase(instance);

  const definition = BUILTIN_FIXTURES.find((d) => d.typeId === instance.definitionId);
  const defaults = definition?.defaultProps;
  const gridSize = Math.round(readOverrideNumber(instance.overrides, defaults, 'gridSize', 8));
  const panelSize = readOverrideNumber(instance.overrides, defaults, 'panelSize', 1.4);
  const count = gridSize * gridSize;

  const cellOffsets = useMemo(() => {
    const out: { x: number; y: number; dist: number }[] = [];
    const step = panelSize / gridSize;
    const cx = (gridSize - 1) / 2;
    const cy = (gridSize - 1) / 2;
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const dx = col - cx;
        const dy = row - cy;
        out.push({
          x: (col - cx) * step,
          y: (cy - row) * step,
          dist: Math.sqrt(dx * dx + dy * dy),
        });
      }
    }
    return out;
  }, [gridSize, panelSize]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    cellOffsets.forEach((cell, i) => {
      _dummy.position.set(cell.x, cell.y, -0.05);
      _dummy.updateMatrix();
      mesh.setMatrixAt(i, _dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [cellOffsets]);

  useFrame(() => {
    const g = groupRef.current;
    if (g) applyBasePose(g);

    const mesh = meshRef.current;
    if (!mesh) return;

    const lighting = useStore.getState().lighting;
    const accent = downbeatAccent(Date.now(), lighting.lastDownbeatTimeMs, 300);
    const render = mapLightingFrame(instance, definition, smoothed.current, colorScratch);
    const maxDist = Math.sqrt(2) * ((gridSize - 1) / 2);

    cellOffsets.forEach((cell, i) => {
      const ripple = accent * Math.max(0, 1 - Math.abs(cell.dist - accent * maxDist * 2) / maxDist);
      const bright = render.intensity * (0.15 + ripple * 0.85);
      _color.copy(render.color);
      _color.offsetHSL(cell.dist * 0.02, 0, bright * 0.1 - 0.05);
      mesh.setColorAt(i, _color);
    });
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  const handlers = fixturePointerHandlers(instance.id, onSelect, onHover);

  return (
    <group ref={groupRef} {...handlers}>
      <mesh position={[0, 0, 0.03]}>
        <boxGeometry args={[panelSize + 0.08, panelSize + 0.08, 0.06]} />
        <meshStandardMaterial color="#0f172a" metalness={0.5} roughness={0.5} />
      </mesh>
      <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
        <boxGeometry args={[panelSize / gridSize * 0.75, panelSize / gridSize * 0.75, 0.04]} />
        <meshStandardMaterial emissive="#000000" emissiveIntensity={1} />
      </instancedMesh>
      {hovered && !selected && (
        <mesh raycast={() => null} position={[0, 0, -0.06]}>
          <boxGeometry args={[panelSize + 0.12, panelSize + 0.12, 0.04]} />
          <meshBasicMaterial color={HOVER_TINT} wireframe />
        </mesh>
      )}
    </group>
  );
}
