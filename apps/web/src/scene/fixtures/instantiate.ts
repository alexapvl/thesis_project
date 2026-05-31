import { fixturePlacementMeta, type FixtureDefinition, type FixtureInstance } from '@stl/fixtures';
import type { Vec3 } from '@/scene/document/reducer';

let counter = 0;

export function instantiateFixture(
  def: FixtureDefinition,
  id: string,
  position: Vec3,
): FixtureInstance {
  counter += 1;
  const { aims } = fixturePlacementMeta(def);
  const target: Vec3 = aims
    ? [position[0], 0, position[2]]
    : [position[0], position[1], position[2]];

  return {
    id,
    definitionId: def.typeId,
    name: `${def.label} ${counter}`,
    enabled: true,
    position,
    rotation: [0, 0, 0],
    target,
    groupId: null,
    overrides: {},
  };
}
