export type AimingFixtureVisual = {
  intensityGain: number;
  lensEmissiveGain: number;
  poolOpacityGain: number;
  hazeOpacityGain: number;
  hazeMaxLength: number;
  hazeOpacityCap: number;
  downbeatRadiusBoost: number;
  moveMinDistance: number;
  softHaze: boolean;
  saturateColor: boolean;
};

export const SPOT_VISUAL: AimingFixtureVisual = {
  intensityGain: 65,
  lensEmissiveGain: 1.5,
  poolOpacityGain: 0.35,
  hazeOpacityGain: 0.12,
  hazeMaxLength: 30,
  hazeOpacityCap: 0.18,
  downbeatRadiusBoost: 1.6,
  moveMinDistance: 1.5,
  softHaze: false,
  saturateColor: false,
};

export const WASH_VISUAL: AimingFixtureVisual = {
  intensityGain: 50,
  lensEmissiveGain: 1.2,
  poolOpacityGain: 0.5,
  hazeOpacityGain: 0.08,
  hazeMaxLength: 28,
  hazeOpacityCap: 0.13,
  downbeatRadiusBoost: 1.4,
  moveMinDistance: 2,
  softHaze: true,
  saturateColor: false,
};

export const BEAM_VISUAL: AimingFixtureVisual = {
  intensityGain: 100,
  lensEmissiveGain: 2,
  poolOpacityGain: 0.2,
  hazeOpacityGain: 0.18,
  hazeMaxLength: 40,
  hazeOpacityCap: 0.26,
  downbeatRadiusBoost: 2,
  moveMinDistance: 2.5,
  softHaze: false,
  saturateColor: true,
};
