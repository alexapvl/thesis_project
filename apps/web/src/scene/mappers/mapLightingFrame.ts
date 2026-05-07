import * as THREE from 'three';
import type { FixtureDefinition, FixtureInstance } from '@stl/fixtures';

/**
 * Runtime render state for a single fixture, derived from the live
 * lighting frame plus the fixture-document state. This is the only
 * surface the R3F fixture components are allowed to consume from
 * runtime lighting — keeps document state and runtime state separate
 * (PLAN: scene-document state and runtime lighting state are separate
 * but compatible; mapping happens in scene/mappers/).
 */
export type FixtureRenderState = {
  fixtureId: string;
  color: THREE.Color;
  intensity: number;
  target: readonly [number, number, number];
};

export type LightingFrame = {
  hue: number;
  value: number;
};

/** Floor for `value` so a fixture is visible even when no prediction has arrived yet. */
export const IDLE_VALUE_FLOOR = 0.4;

const SATURATION = 0.7;
const LIGHTNESS = 0.5;

function readNumber(record: Record<string, unknown>, key: string): number | undefined {
  const v = record[key];
  return typeof v === 'number' ? v : undefined;
}

function resolveBaseIntensity(instance: FixtureInstance, definition: FixtureDefinition | undefined): number {
  return (
    readNumber(instance.overrides, 'intensity') ??
    (definition && readNumber(definition.defaultProps, 'intensity')) ??
    1
  );
}

/**
 * Pure mapping from one lighting frame + one fixture to its render state.
 *
 * - `intensity` is normalized 0..1; the fixture component scales by its
 *   physical falloff (spot ≈ ×60, point ≈ ×30).
 * - When `value` is 0 (no prediction yet) we fall back to `IDLE_VALUE_FLOOR`
 *   so an enabled fixture is never invisible — a usability choice, not
 *   a property of the model. Real predictions override it immediately.
 * - Disabled fixtures emit zero intensity but keep their color/target so
 *   re-enabling does not flash.
 */
export function mapLightingFrame(
  instance: FixtureInstance,
  definition: FixtureDefinition | undefined,
  lighting: LightingFrame,
  out: THREE.Color = new THREE.Color(),
): FixtureRenderState {
  const baseIntensity = resolveBaseIntensity(instance, definition);
  const value = lighting.value > 0 ? lighting.value : IDLE_VALUE_FLOOR;
  const intensity = instance.enabled ? baseIntensity * value : 0;

  const hue = (((lighting.hue % 360) + 360) % 360) / 360;
  out.setHSL(hue, SATURATION, LIGHTNESS);

  return {
    fixtureId: instance.id,
    color: out,
    intensity,
    target: instance.target,
  };
}
