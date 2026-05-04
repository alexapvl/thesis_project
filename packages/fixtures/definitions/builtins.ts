import type { FixtureDefinition } from '../schemas/fixture';

export const SPOTLIGHT_FIXTURE: FixtureDefinition = {
  typeId: 'builtin.spot',
  label: 'Spotlight',
  kind: 'spot',
  defaultProps: {
    angleRad: Math.PI / 6,
    penumbra: 0.2,
    distance: 30,
    intensity: 1.0,
  },
};

export const POINT_DEBUG_FIXTURE: FixtureDefinition = {
  typeId: 'builtin.point',
  label: 'Point (debug)',
  kind: 'point',
  defaultProps: {
    distance: 12,
    intensity: 0.6,
  },
};

export const BUILTIN_FIXTURES: ReadonlyArray<FixtureDefinition> = [
  SPOTLIGHT_FIXTURE,
  POINT_DEBUG_FIXTURE,
];
