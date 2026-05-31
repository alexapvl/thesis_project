import { useMemo } from 'react';
import * as THREE from 'three';
import type { FixtureInstance } from '@stl/fixtures';
import { HazeBeam, SelectionBoxes } from './aiming-parts';
import { WASH_VISUAL } from './aiming-visual';
import { LedParWashHead, LedParWashStatic } from './bodies';
import type { FixtureInteractionProps } from './fixture-interaction';
import { useAimingFixture } from './useAimingFixture';

const HEAD_COLOR = '#1e293b';

type Props = FixtureInteractionProps & { instance: FixtureInstance };

export function WashFixture({ instance, selected, hovered, onSelect, onHover }: Props) {
  const lensMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: HEAD_COLOR }),
    [],
  );

  const {
    groupRef,
    headRef,
    lightRef,
    hazeConeRef,
    hazeConeGeom,
    hazeConeTexture,
    targetObj,
    angle,
    penumbra,
    distance,
    handlers,
  } = useAimingFixture(instance, WASH_VISUAL, onSelect, onHover, { lensMaterial });

  return (
    <group ref={groupRef} position={instance.position} rotation={instance.rotation} {...handlers}>
      <spotLight
        ref={lightRef}
        angle={angle}
        penumbra={penumbra}
        distance={distance}
        decay={2}
        target={targetObj}
        castShadow={false}
      />
      <LedParWashStatic selected={selected} />
      <group ref={headRef} position={[0, 0.05, 0]}>
        <LedParWashHead lensMaterial={lensMaterial} />
        <HazeBeam
          meshRef={hazeConeRef}
          geometry={hazeConeGeom}
          texture={hazeConeTexture}
          position={[0, 0, -0.14]}
        />
      </group>
      <SelectionBoxes selected={selected} hovered={hovered} size={[0.85, 0.75, 0.85]} />
    </group>
  );
}
