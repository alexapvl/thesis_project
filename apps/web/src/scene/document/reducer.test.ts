import { describe, expect, it } from 'vitest';
import { emptyScene } from '@stl/fixtures';
import { applyAction, isHistoricAction } from './reducer';
import { instantiateFixture } from '../fixtures/instantiate';
import { SPOTLIGHT_FIXTURE } from '@stl/fixtures';

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
});