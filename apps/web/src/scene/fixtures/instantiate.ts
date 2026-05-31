import { fixturePlacementMeta, type FixtureDefinition, type FixtureInstance } from '@stl/fixtures';
import type { Vec3 } from '@/scene/document/reducer';

let counter = 0;

export type InstantiateFixtureOptions = {
  /** Resting on floor (uplighter aim) vs mounted on structure. */
  onGround?: boolean;
  rotation?: Vec3;
};

export function instantiateFixture(
  def: FixtureDefinition,
  id: string,
  position: Vec3,
  options?: InstantiateFixtureOptions,
): FixtureInstance {
  counter += 1;
  const { aims } = fixturePlacementMeta(def);
  const onGround = options?.onGround ?? false;
  const target: Vec3 = aims
    ? onGround
      ? [position[0] + 4, position[1] + 2, position[2]]
      : [position[0], 0, position[2]]
    : [position[0], position[1], position[2]];

  return {
    id,
    definitionId: def.typeId,
    name: `${def.label} ${counter}`,
    enabled: true,
    position,
    rotation: options?.rotation ?? [0, 0, 0],
    target,
    groupId: null,
    mount: null,
    overrides: {},
  };
}
