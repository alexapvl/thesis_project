import { z } from 'zod';
import { fixtureGroupSchema, fixtureInstanceSchema } from './fixture';
import { structureInstanceSchema } from './structure';

export const SCENE_SCHEMA_VERSION = '1.0.0' as const;

export const sceneDocumentSchema = z.object({
  schemaVersion: z.string(),
  id: z.string(),
  name: z.string(),
  fixtures: z.array(fixtureInstanceSchema),
  groups: z.array(fixtureGroupSchema),
  structures: z.array(structureInstanceSchema).default([]),
  selectedFixtureId: z.string().nullable(),
  selectedStructureId: z.string().nullable().default(null),
});
export type SceneDocument = z.infer<typeof sceneDocumentSchema>;
