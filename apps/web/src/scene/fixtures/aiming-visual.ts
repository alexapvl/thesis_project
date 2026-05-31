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
  intensityGain: 60,
  lensEmissiveGain: 1.5,
  poolOpacityGain: 0.35,
  hazeOpacityGain: 0.09,
  hazeMaxLength: 30,
  hazeOpacityCap: 0.14,
  downbeatRadiusBoost: 1.6,
  moveMinDistance: 1.5,
  softHaze: false,
  saturateColor: false,
};

export const WASH_VISUAL: AimingFixtureVisual = {
  intensityGain: 45,
  lensEmissiveGain: 1.2,
  poolOpacityGain: 0.5,
  hazeOpacityGain: 0.06,
  hazeMaxLength: 28,
  hazeOpacityCap: 0.1,
  downbeatRadiusBoost: 1.4,
  moveMinDistance: 2,
  softHaze: true,
  saturateColor: false,
};

export const BEAM_VISUAL: AimingFixtureVisual = {
  intensityGain: 90,
  lensEmissiveGain: 2,
  poolOpacityGain: 0.2,
  hazeOpacityGain: 0.14,
  hazeMaxLength: 40,
  hazeOpacityCap: 0.2,
  downbeatRadiusBoost: 2,
  moveMinDistance: 2.5,
  softHaze: false,
  saturateColor: true,
};
