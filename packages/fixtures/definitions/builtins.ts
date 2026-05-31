import type { FixtureDefinition } from '../schemas/fixture';

export const SPOTLIGHT_FIXTURE: FixtureDefinition = {
  typeId: 'builtin.spot',
  label: 'Spotlight',
  kind: 'spot',
  aims: true,
  mountHeight: 4,
  defaultProps: {
    angleRad: Math.PI / 6,
    penumbra: 0.2,
    distance: 30,
    intensity: 1.0,
    moveRadius: 3.5,
    moveTauSeconds: 0.1,
  },
};

export const WASH_FIXTURE: FixtureDefinition = {
  typeId: 'builtin.wash',
  label: 'Wash',
  kind: 'wash',
  aims: true,
  mountHeight: 4,
  defaultProps: {
    angleRad: Math.PI / 4,
    penumbra: 0.45,
    distance: 28,
    intensity: 1.0,
    moveRadius: 4.5,
    moveTauSeconds: 0.35,
  },
};

export const BEAM_FIXTURE: FixtureDefinition = {
  typeId: 'builtin.beam',
  label: 'Beam',
  kind: 'beam',
  aims: true,
  mountHeight: 5,
  defaultProps: {
    angleRad: 0.06,
    penumbra: 0.05,
    distance: 40,
    intensity: 1.2,
    moveRadius: 5,
    moveTauSeconds: 0.08,
  },
};

export const LASER_FIXTURE: FixtureDefinition = {
  typeId: 'builtin.laser',
  label: 'Laser',
  kind: 'laser',
  aims: true,
  mountHeight: 4.5,
  defaultProps: {
    beamCount: 5,
    fanAngleRad: Math.PI / 3,
    beamLength: 18,
    intensity: 1.0,
    patternSet: 0,
  },
};

export const PAR_FIXTURE: FixtureDefinition = {
  typeId: 'builtin.par',
  label: 'PAR',
  kind: 'par',
  aims: false,
  mountHeight: 0.2,
  defaultProps: {
    angleRad: Math.PI / 3,
    distance: 14,
    intensity: 0.9,
  },
};

export const BLINDER_FIXTURE: FixtureDefinition = {
  typeId: 'builtin.blinder',
  label: 'Blinder',
  kind: 'blinder',
  aims: false,
  mountHeight: 1.2,
  defaultProps: {
    lampRows: 2,
    lampCols: 2,
    intensity: 1.0,
  },
};

export const STROBE_FIXTURE: FixtureDefinition = {
  typeId: 'builtin.strobe',
  label: 'Strobe',
  kind: 'strobe',
  aims: false,
  mountHeight: 2.5,
  defaultProps: {
    flashMs: 80,
    intensity: 1.0,
    useDownbeatOnly: false,
  },
};

export const BAR_FIXTURE: FixtureDefinition = {
  typeId: 'builtin.bar',
  label: 'LED Bar',
  kind: 'bar',
  aims: false,
  mountHeight: 3,
  defaultProps: {
    pixelCount: 8,
    barLength: 1.6,
    intensity: 1.0,
  },
};

export const MATRIX_FIXTURE: FixtureDefinition = {
  typeId: 'builtin.matrix',
  label: 'Pixel Matrix',
  kind: 'matrix',
  aims: false,
  mountHeight: 3.5,
  defaultProps: {
    gridSize: 8,
    panelSize: 1.4,
    intensity: 1.0,
  },
};

export const POINT_DEBUG_FIXTURE: FixtureDefinition = {
  typeId: 'builtin.point',
  label: 'Point (debug)',
  kind: 'point',
  mountHeight: 2,
  defaultProps: {
    distance: 12,
    intensity: 0.6,
  },
};

export const BUILTIN_FIXTURES: ReadonlyArray<FixtureDefinition> = [
  SPOTLIGHT_FIXTURE,
  WASH_FIXTURE,
  BEAM_FIXTURE,
  LASER_FIXTURE,
  PAR_FIXTURE,
  BLINDER_FIXTURE,
  STROBE_FIXTURE,
  BAR_FIXTURE,
  MATRIX_FIXTURE,
  POINT_DEBUG_FIXTURE,
];
