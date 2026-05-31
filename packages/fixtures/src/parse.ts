import { sceneDocumentSchema, type SceneDocument } from '../schemas/scene';

export type SceneParseResult =
  | { ok: true; value: SceneDocument }
  | { ok: false; error: string };

export function parseSceneDocument(raw: unknown): SceneParseResult {
  const result = sceneDocumentSchema.safeParse(raw);
  if (result.success) return { ok: true, value: result.data };
  return { ok: false, error: result.error.message };
}

export function emptyScene(id: string, name = 'Untitled scene'): SceneDocument {
  return {
    schemaVersion: '1.0.0',
    id,
    name,
    fixtures: [],
    groups: [],
    structures: [],
    selectedFixtureId: null,
    selectedStructureId: null,
  };
}