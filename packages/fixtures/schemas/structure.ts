import { z } from 'zod';

export const structureKindSchema = z.enum(['tower', 'beam', 'goalpost', 'baseplate']);
export type StructureKind = z.infer<typeof structureKindSchema>;

const vec3 = z.tuple([z.number(), z.number(), z.number()]);

export const structureDimsSchema = z.object({
  height: z.number().optional(),
  length: z.number().optional(),
  span: z.number().optional(),
  width: z.number().optional(),
});
export type StructureDims = z.infer<typeof structureDimsSchema>;

export const structureDefinitionSchema = z.object({
  typeId: z.string(),
  label: z.string(),
  kind: structureKindSchema,
  defaultDims: structureDimsSchema,
});
export type StructureDefinition = z.infer<typeof structureDefinitionSchema>;

export const structureInstanceSchema = z.object({
  id: z.string(),
  definitionId: z.string(),
  name: z.string(),
  kind: structureKindSchema,
  position: vec3,
  rotation: vec3,
  dims: structureDimsSchema,
});
export type StructureInstance = z.infer<typeof structureInstanceSchema>;

export const fixtureMountSchema = z.object({
  structureId: z.string(),
  socketId: z.string(),
});
export type FixtureMount = z.infer<typeof fixtureMountSchema>;
