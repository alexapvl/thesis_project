import type { FixtureGroup, FixtureInstance, SceneDocument } from '@stl/fixtures';

export type Vec3 = [number, number, number];

export type SceneAction =
  | { type: 'fixture.add'; fixture: FixtureInstance }
  | { type: 'fixture.remove'; id: string }
  | { type: 'fixture.update'; id: string; patch: Partial<Omit<FixtureInstance, 'id'>> }
  | { type: 'fixture.duplicate'; id: string; newId: string; offset?: Vec3 }
  | { type: 'selection.set'; id: string | null }
  | { type: 'group.create'; id: string; name: string; fixtureIds: string[] }
  | { type: 'group.update'; id: string; patch: Partial<Omit<FixtureGroup, 'id'>> }
  | { type: 'group.remove'; id: string }
  | { type: 'scene.rename'; name: string }
  | { type: 'scene.replace'; doc: SceneDocument };

function patchFixture(f: FixtureInstance, p: Partial<Omit<FixtureInstance, 'id'>>): FixtureInstance {
  return { ...f, ...p, overrides: { ...f.overrides, ...(p.overrides ?? {}) } };
}

export function applyAction(doc: SceneDocument, action: SceneAction): SceneDocument {
  switch (action.type) {
    case 'fixture.add':
      return { ...doc, fixtures: [...doc.fixtures, action.fixture], selectedFixtureId: action.fixture.id };

    case 'fixture.remove': {
      const fixtures = doc.fixtures.filter((f) => f.id !== action.id);
      const groups = doc.groups.map((g) => ({
        ...g,
        fixtureIds: g.fixtureIds.filter((id) => id !== action.id),
      }));
      const selectedFixtureId = doc.selectedFixtureId === action.id ? null : doc.selectedFixtureId;
      return { ...doc, fixtures, groups, selectedFixtureId };
    }

    case 'fixture.update':
      return {
        ...doc,
        fixtures: doc.fixtures.map((f) => (f.id === action.id ? patchFixture(f, action.patch) : f)),
      };

    case 'fixture.duplicate': {
      const src = doc.fixtures.find((f) => f.id === action.id);
      if (!src) return doc;
      const off = action.offset ?? [0.5, 0, 0.5];
      const copy: FixtureInstance = {
        ...src,
        id: action.newId,
        name: `${src.name} copy`,
        position: [src.position[0] + off[0], src.position[1] + off[1], src.position[2] + off[2]],
        target: [src.target[0] + off[0], src.target[1] + off[1], src.target[2] + off[2]],
      };
      return { ...doc, fixtures: [...doc.fixtures, copy], selectedFixtureId: copy.id };
    }

    case 'selection.set':
      return { ...doc, selectedFixtureId: action.id };

    case 'group.create':
      return {
        ...doc,
        groups: [...doc.groups, { id: action.id, name: action.name, fixtureIds: action.fixtureIds }],
      };

    case 'group.update':
      return {
        ...doc,
        groups: doc.groups.map((g) => (g.id === action.id ? { ...g, ...action.patch } : g)),
      };

    case 'group.remove':
      return {
        ...doc,
        groups: doc.groups.filter((g) => g.id !== action.id),
        fixtures: doc.fixtures.map((f) => (f.groupId === action.id ? { ...f, groupId: null } : f)),
      };

    case 'scene.rename':
      return { ...doc, name: action.name };

    case 'scene.replace':
      return action.doc;
  }
}

/** Actions that should not push to undo history (e.g. selection or transient UI state). */
export function isHistoricAction(action: SceneAction): boolean {
  switch (action.type) {
    case 'selection.set':
      return false;
    default:
      return true;
  }
}