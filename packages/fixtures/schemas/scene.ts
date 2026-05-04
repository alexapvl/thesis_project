import { z } from 'zod';
import { fixtureGroupSchema, fixtureInstanceSchema } from './fixture';

export const SCENE_SCHEMA_VERSION = '1.0.0' as const;

export const sceneDocumentSchema = z.object({
  schemaVersion: z.string(),
  id: z.string(),
  name: z.string(),
  fixtures: z.array(fixtureInstanceSchema),
  groups: z.array(fixtureGroupSchema),
  selectedFixtureId: z.string().nullable(),
});
export type SceneDocument = z.infer<typeof sceneDocumentSchema>;
