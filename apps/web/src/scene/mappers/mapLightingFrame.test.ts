import { describe, expect, it } from 'vitest';
import { SPOTLIGHT_FIXTURE, POINT_DEBUG_FIXTURE, type FixtureInstance } from '@stl/fixtures';
import { IDLE_VALUE_FLOOR, mapLightingFrame } from './mapLightingFrame';

function makeInstance(overrides: Partial<FixtureInstance> = {}): FixtureInstance {
  return {
    id: 'f1',
    definitionId: SPOTLIGHT_FIXTURE.typeId,
    name: 'Spot 1',
    enabled: true,
    position: [0, 4, 0],
    rotation: [0, 0, 0],
    target: [0, 0, 0],
    groupId: null,
    mount: null,
    overrides: {},
    ...overrides,
  };
}

describe('mapLightingFrame', () => {
  it('multiplies override intensity by lighting value', () => {
    const inst = makeInstance({ overrides: { intensity: 2 } });
    const render = mapLightingFrame(inst, SPOTLIGHT_FIXTURE, { hue: 0, value: 0.5 });
    expect(render.intensity).toBeCloseTo(1.0);
  });

  it('falls back to definition default intensity when no override is set', () => {
    const inst = makeInstance();
    const render = mapLightingFrame(inst, SPOTLIGHT_FIXTURE, { hue: 0, value: 1 });
    // SPOTLIGHT_FIXTURE.defaultProps.intensity === 1.0
    expect(render.intensity).toBeCloseTo(1.0);
  });

  it('floors zero value at IDLE_VALUE_FLOOR so an enabled fixture is never invisible', () => {
    const inst = makeInstance({ overrides: { intensity: 1 } });
    const render = mapLightingFrame(inst, SPOTLIGHT_FIXTURE, { hue: 0, value: 0 });
    expect(render.intensity).toBeCloseTo(IDLE_VALUE_FLOOR);
  });

  it('emits zero intensity for disabled fixtures regardless of value', () => {
    const inst = makeInstance({ enabled: false, overrides: { intensity: 5 } });
    const render = mapLightingFrame(inst, SPOTLIGHT_FIXTURE, { hue: 200, value: 0.9 });
    expect(render.intensity).toBe(0);
  });

  it('wraps hue into [0, 360) and produces a valid RGB color', () => {
    const inst = makeInstance();
    const render = mapLightingFrame(inst, SPOTLIGHT_FIXTURE, { hue: -90, value: 0.5 });
    expect(render.color.r).toBeGreaterThanOrEqual(0);
    expect(render.color.r).toBeLessThanOrEqual(1);
    expect(render.color.g).toBeGreaterThanOrEqual(0);
    expect(render.color.b).toBeGreaterThanOrEqual(0);
  });

  it('handles point fixtures using the same code path', () => {
    const inst = makeInstance({
      definitionId: POINT_DEBUG_FIXTURE.typeId,
      overrides: {},
    });
    const render = mapLightingFrame(inst, POINT_DEBUG_FIXTURE, { hue: 120, value: 1 });
    // POINT_DEBUG_FIXTURE.defaultProps.intensity === 0.6
    expect(render.intensity).toBeCloseTo(0.6);
  });

  it('passes the fixture target through verbatim', () => {
    const inst = makeInstance({ target: [1, 2, 3] });
    const render = mapLightingFrame(inst, SPOTLIGHT_FIXTURE, { hue: 0, value: 0.5 });
    expect(render.target).toEqual([1, 2, 3]);
  });
});
