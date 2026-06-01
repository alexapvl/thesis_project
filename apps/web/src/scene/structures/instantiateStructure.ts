import { BUILTIN_STRUCTURES, type StructureDefinition } from '@stl/fixtures';
import type { Vec3 } from '@/scene/document/reducer';
import type { StructureInstance } from '@stl/fixtures';

let counter = 0;

export function instantiateStructure(
  def: StructureDefinition,
  id: string,
  position: Vec3,
  rotation: Vec3 = [0, 0, 0],
): StructureInstance {
  counter += 1;
  return {
    id,
    definitionId: def.typeId,
    name: `${def.label} ${counter}`,
    kind: def.kind,
    position,
    rotation,
    dims: { ...def.defaultDims },
  };
}

export function structureDefByTypeId(typeId: string): StructureDefinition | undefined {
  return BUILTIN_STRUCTURES.find((d) => d.typeId === typeId);
}
