import type { StructureDefinition } from '../schemas/structure';

export const TOWER_STRUCTURE: StructureDefinition = {
  typeId: 'builtin.structure.tower',
  label: 'Truss tower',
  kind: 'tower',
  defaultDims: { height: 4 },
};

export const BEAM_STRUCTURE: StructureDefinition = {
  typeId: 'builtin.structure.beam',
  label: 'Truss beam',
  kind: 'beam',
  defaultDims: { length: 4 },
};

export const GOALPOST_STRUCTURE: StructureDefinition = {
  typeId: 'builtin.structure.goalpost',
  label: 'Goalpost',
  kind: 'goalpost',
  defaultDims: { span: 4, height: 4 },
};

export const BASEPLATE_STRUCTURE: StructureDefinition = {
  typeId: 'builtin.structure.baseplate',
  label: 'Base plate',
  kind: 'baseplate',
  defaultDims: { width: 0.8 },
};

export const BUILTIN_STRUCTURES: ReadonlyArray<StructureDefinition> = [
  TOWER_STRUCTURE,
  BEAM_STRUCTURE,
  GOALPOST_STRUCTURE,
  BASEPLATE_STRUCTURE,
];

export function isStructureTypeId(typeId: string): boolean {
  return BUILTIN_STRUCTURES.some((d) => d.typeId === typeId);
}
