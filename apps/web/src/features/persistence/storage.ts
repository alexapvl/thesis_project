import { parseSceneDocument, type SceneDocument } from '@stl/fixtures';

export const AUTOSAVE_KEY = 'stl.scene.v1';

export function loadAutosave(): SceneDocument | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return null;
    const parsed = parseSceneDocument(JSON.parse(raw));
    return parsed.ok ? parsed.value : null;
  } catch {
    return null;
  }
}

export function saveAutosave(doc: SceneDocument): void {
  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(doc));
  } catch {
    // Quota or privacy mode — silent. The store still has the doc in memory.
  }
}

export function clearAutosave(): void {
  try {
    localStorage.removeItem(AUTOSAVE_KEY);
  } catch {
    /* noop */
  }
}