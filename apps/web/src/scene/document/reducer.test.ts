import { describe, expect, it } from 'vitest';
import { emptyScene, TOWER_STRUCTURE } from '@stl/fixtures';
import { applyAction, isHistoricAction } from './reducer';
import { instantiateFixture } from '../fixtures/instantiate';
import { instantiateStructure } from '../structures/instantiateStructure';
import { SPOTLIGHT_FIXTURE } from '@stl/fixtures';
import { socketsForStructure } from '../structures/sockets';

function seed() {
  const doc = emptyScene('s1');
  const f1 = instantiateFixture(SPOTLIGHT_FIXTURE, 'f1', [1, 4, 1]);
  return applyAction(doc, { type: 'fixture.add', fixture: f1 });
}

describe('scene reducer', () => {
  it('adds a fixture and selects it', () => {
    const doc = seed();
    expect(doc.fixtures).toHaveLength(1);
    expect(doc.selectedFixtureId).toBe('f1');
  });

  it('updates a fixture position immutably', () => {
    const doc = seed();
    const next = applyAction(doc, {
      type: 'fixture.update',
      id: 'f1',
      patch: { position: [2, 4, 2] },
    });
    expect(next).not.toBe(doc);
    expect(next.fixtures[0]?.position).toEqual([2, 4, 2]);
    expect(doc.fixtures[0]?.position).toEqual([1, 4, 1]); // original untouched
  });

  it('removing a fixture clears its selection and group membership', () => {
    let doc = seed();
    doc = applyAction(doc, {
      type: 'group.create',
      id: 'g1',
      name: 'left',
      fixtureIds: ['f1'],
    });
    const next = applyAction(doc, { type: 'fixture.remove', id: 'f1' });
    expect(next.fixtures).toEqual([]);
    expect(next.selectedFixtureId).toBeNull();
    expect(next.groups[0]?.fixtureIds).toEqual([]);
  });

  it('duplicate offsets the copy and selects it', () => {
    const doc = seed();
    const next = applyAction(doc, {
      type: 'fixture.duplicate',
      id: 'f1',
      newId: 'f2',
      offset: [1, 0, 0],
    });
    expect(next.fixtures).toHaveLength(2);
    expect(next.selectedFixtureId).toBe('f2');
    expect(next.fixtures[1]?.position).toEqual([2, 4, 1]);
  });

  it('selection is not historic', () => {
    expect(isHistoricAction({ type: 'selection.set', id: 'x' })).toBe(false);
    expect(
      isHistoricAction({ type: 'fixture.update', id: 'x', patch: {} }),
    ).toBe(true);
  });

  it('adds a structure and selects it', () => {
    const doc = emptyScene('s1');
    const tower = instantiateStructure(TOWER_STRUCTURE, 'st1', [0, 0, 0]);
    const next = applyAction(doc, { type: 'structure.add', structure: tower });
    expect(next.structures).toHaveLength(1);
    expect(next.selectedStructureId).toBe('st1');
    expect(next.selectedFixtureId).toBeNull();
  });

  it('mounts a fixture to a structure socket', () => {
    let doc = emptyScene('s1');
    const tower = instantiateStructure(TOWER_STRUCTURE, 'st1', [0, 0, 0]);
    doc = applyAction(doc, { type: 'structure.add', structure: tower });
    const f1 = instantiateFixture(SPOTLIGHT_FIXTURE, 'f1', [1, 4, 1]);
    doc = applyAction(doc, { type: 'fixture.add', fixture: f1 });
    const socketId = socketsForStructure(tower)[0]!.id;
    const next = applyAction(doc, {
      type: 'fixture.mount',
      id: 'f1',
      structureId: 'st1',
      socketId,
    });
    expect(next.fixtures[0]?.mount).toEqual({ structureId: 'st1', socketId });
  });

  it('unmounts a fixture and clears mount', () => {
    let doc = emptyScene('s1');
    const tower = instantiateStructure(TOWER_STRUCTURE, 'st1', [0, 0, 0]);
    doc = applyAction(doc, { type: 'structure.add', structure: tower });
    const f1 = instantiateFixture(SPOTLIGHT_FIXTURE, 'f1', [1, 4, 1]);
    doc = applyAction(doc, { type: 'fixture.add', fixture: f1 });
    const socketId = socketsForStructure(tower)[0]!.id;
    doc = applyAction(doc, {
      type: 'fixture.mount',
      id: 'f1',
      structureId: 'st1',
      socketId,
    });
    const next = applyAction(doc, { type: 'fixture.unmount', id: 'f1' });
    expect(next.fixtures[0]?.mount).toBeNull();
    expect(next.fixtures[0]?.position).toBeDefined();
  });

  it('removing a structure unmounts fixtures on it', () => {
    let doc = emptyScene('s1');
    const tower = instantiateStructure(TOWER_STRUCTURE, 'st1', [0, 0, 0]);
    doc = applyAction(doc, { type: 'structure.add', structure: tower });
    const f1 = instantiateFixture(SPOTLIGHT_FIXTURE, 'f1', [1, 4, 1]);
    doc = applyAction(doc, { type: 'fixture.add', fixture: f1 });
    const socketId = socketsForStructure(tower)[0]!.id;
    doc = applyAction(doc, {
      type: 'fixture.mount',
      id: 'f1',
      structureId: 'st1',
      socketId,
    });
    const next = applyAction(doc, { type: 'structure.remove', id: 'st1' });
    expect(next.structures).toEqual([]);
    expect(next.fixtures[0]?.mount).toBeNull();
  });
});