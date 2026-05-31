import type { FixtureInstance } from '@stl/fixtures';
import { HazeBeam, SelectionBoxes } from './aiming-parts';
import { SPOT_VISUAL } from './aiming-visual';
import { FresnelSpotHead, FresnelSpotStatic } from './bodies';
import type { FixtureInteractionProps } from './fixture-interaction';
import { useAimingFixture } from './useAimingFixture';

type Props = FixtureInteractionProps & { instance: FixtureInstance };

export function SpotFixture({ instance, selected, hovered, onSelect, onHover }: Props) {
  const {
    groupRef,
    headRef,
    lightRef,
    lensMatRef,
    hazeConeRef,
    hazeConeGeom,
    hazeConeTexture,
    targetObj,
    angle,
    penumbra,
    distance,
    handlers,
  } = useAimingFixture(instance, SPOT_VISUAL, onSelect, onHover);

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
      <FresnelSpotStatic selected={selected} />
      <group ref={headRef} position={[0, 0.05, 0]}>
        <FresnelSpotHead lensMatRef={lensMatRef} />
        <HazeBeam
          meshRef={hazeConeRef}
          geometry={hazeConeGeom}
          texture={hazeConeTexture}
          position={[0, 0, -0.28]}
        />
      </group>
      <SelectionBoxes selected={selected} hovered={hovered} size={[0.7, 0.75, 0.7]} />
    </group>
  );
}
