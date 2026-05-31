import type {
  FixtureGroup,
  FixtureInstance,
  SceneDocument,
  StructureInstance,
} from '@stl/fixtures';
import { resolveMountTransform } from '@/scene/structures/sockets';

export type { Vec3 } from './vec3';
import type { Vec3 } from './vec3';

export type SceneAction =
  | { type: 'fixture.add'; fixture: FixtureInstance }
  | { type: 'fixture.remove'; id: string }
  | { type: 'fixture.update'; id: string; patch: Partial<Omit<FixtureInstance, 'id'>> }
  | { type: 'fixture.duplicate'; id: string; newId: string; offset?: Vec3 }
  | { type: 'fixture.mount'; id: string; structureId: string; socketId: string }
  | { type: 'fixture.unmount'; id: string; bakedPosition?: Vec3; bakedRotation?: Vec3 }
  | { type: 'selection.set'; id: string | null }
  | { type: 'structure.select'; id: string | null }
  | { type: 'structure.add'; structure: StructureInstance }
  | { type: 'structure.remove'; id: string }
  | { type: 'structure.update'; id: string; patch: Partial<Omit<StructureInstance, 'id'>> }
  | { type: 'structure.duplicate'; id: string; newId: string; offset?: Vec3 }
  | { type: 'group.create'; id: string; name: string; fixtureIds: string[] }
  | { type: 'group.update'; id: string; patch: Partial<Omit<FixtureGroup, 'id'>> }
  | { type: 'group.remove'; id: string }
  | { type: 'scene.rename'; name: string }
  | { type: 'scene.replace'; doc: SceneDocument };

function patchFixture(f: FixtureInstance, p: Partial<Omit<FixtureInstance, 'id'>>): FixtureInstance {
  return { ...f, ...p, overrides: { ...f.overrides, ...(p.overrides ?? {}) } };
}

function bakeMountedFixture(
  fixture: FixtureInstance,
  structure: StructureInstance,
): FixtureInstance {
  const mount = fixture.mount;
  if (!mount) return fixture;
  const resolved = resolveMountTransform(structure, mount.socketId);
  if (!resolved) return { ...fixture, mount: null };
  return {
    ...fixture,
    mount: null,
    position: resolved.position,
    rotation: resolved.rotation,
  };
}

function unmountFixturesOnStructure(doc: SceneDocument, structureId: string): FixtureInstance[] {
  const structure = doc.structures.find((s) => s.id === structureId);
  return doc.fixtures.map((f) => {
    if (f.mount?.structureId !== structureId) return f;
    if (!structure) return { ...f, mount: null };
    return bakeMountedFixture(f, structure);
  });
}

export function applyAction(doc: SceneDocument, action: SceneAction): SceneDocument {
  switch (action.type) {
    case 'fixture.add':
      return {
        ...doc,
        fixtures: [...doc.fixtures, action.fixture],
        selectedFixtureId: action.fixture.id,
        selectedStructureId: null,
      };

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
        mount: null,
        position: [src.position[0] + off[0], src.position[1] + off[1], src.position[2] + off[2]],
        target: [src.target[0] + off[0], src.target[1] + off[1], src.target[2] + off[2]],
      };
      return {
        ...doc,
        fixtures: [...doc.fixtures, copy],
        selectedFixtureId: copy.id,
        selectedStructureId: null,
      };
    }

    case 'fixture.mount': {
      const structure = doc.structures.find((s) => s.id === action.structureId);
      if (!structure) return doc;
      const resolved = resolveMountTransform(structure, action.socketId);
      if (!resolved) return doc;
      return {
        ...doc,
        fixtures: doc.fixtures.map((f) =>
          f.id === action.id
            ? {
                ...f,
                mount: { structureId: action.structureId, socketId: action.socketId },
                position: resolved.position,
                rotation: resolved.rotation,
              }
            : f,
        ),
        selectedFixtureId: action.id,
        selectedStructureId: null,
      };
    }

    case 'fixture.unmount': {
      const fixture = doc.fixtures.find((f) => f.id === action.id);
      if (!fixture?.mount) return doc;
      const structure = doc.structures.find((s) => s.id === fixture.mount!.structureId);
      let position = action.bakedPosition;
      let rotation = action.bakedRotation;
      if (!position || !rotation) {
        if (structure) {
          const resolved = resolveMountTransform(structure, fixture.mount.socketId);
          if (resolved) {
            position = position ?? resolved.position;
            rotation = rotation ?? resolved.rotation;
          }
        }
        position = position ?? fixture.position;
        rotation = rotation ?? fixture.rotation;
      }
      return {
        ...doc,
        fixtures: doc.fixtures.map((f) =>
          f.id === action.id
            ? { ...f, mount: null, position, rotation }
            : f,
        ),
      };
    }

    case 'selection.set':
      return {
        ...doc,
        selectedFixtureId: action.id,
        selectedStructureId: action.id ? null : doc.selectedStructureId,
      };

    case 'structure.select':
      return {
        ...doc,
        selectedStructureId: action.id,
        selectedFixtureId: action.id ? null : doc.selectedFixtureId,
      };

    case 'structure.add':
      return {
        ...doc,
        structures: [...doc.structures, action.structure],
        selectedStructureId: action.structure.id,
        selectedFixtureId: null,
      };

    case 'structure.remove': {
      const structures = doc.structures.filter((s) => s.id !== action.id);
      const fixtures = unmountFixturesOnStructure(doc, action.id);
      const selectedStructureId =
        doc.selectedStructureId === action.id ? null : doc.selectedStructureId;
      return { ...doc, structures, fixtures, selectedStructureId };
    }

    case 'structure.update':
      return {
        ...doc,
        structures: doc.structures.map((s) =>
          s.id === action.id ? { ...s, ...action.patch, dims: { ...s.dims, ...action.patch.dims } } : s,
        ),
      };

    case 'structure.duplicate': {
      const src = doc.structures.find((s) => s.id === action.id);
      if (!src) return doc;
      const off = action.offset ?? [1, 0, 0];
      const copy: StructureInstance = {
        ...src,
        id: action.newId,
        name: `${src.name} copy`,
        position: [
          src.position[0] + off[0],
          src.position[1] + off[1],
          src.position[2] + off[2],
        ],
      };
      return {
        ...doc,
        structures: [...doc.structures, copy],
        selectedStructureId: copy.id,
        selectedFixtureId: null,
      };
    }

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
    case 'structure.select':
      return false;
    default:
      return true;
  }
}
