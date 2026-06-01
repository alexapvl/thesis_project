import type { Camera } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * World-space distance the camera dollies per unit of wheel/drag delta.
 * The default OrbitControls zoom is multiplicative (a fixed *ratio* of the
 * current distance per scroll), which feels like it accelerates when far and
 * crawls when close. We instead move a fixed number of world units per scroll
 * so the zoom rate is constant at any distance.
 */
const ZOOM_WORLD_PER_DELTA = 0.5;

/** Keep the orbit radius away from zero so the dolly factor can't explode. */
export const MIN_ORBIT_DISTANCE = 1.5;
export const MAX_ORBIT_DISTANCE = 60;
/** Hard cap on a single dolly step so a tiny radius can't snap the view. */
const MAX_STEP_RATIO = 4;

type OrbitInternals = OrbitControls & {
  _getZoomScale: (delta: number) => number;
};

/**
 * Patch OrbitControls so the wheel/drag dolly moves a constant world-space
 * amount regardless of camera distance. Pan and rotate keep their default
 * (cursor-locked) behavior.
 *
 * `_getZoomScale` must return a magnitude factor < 1; OrbitControls decides
 * direction via `_dollyIn` (scale *= f) vs `_dollyOut` (scale /= f) based on
 * the wheel sign, so we use the absolute delta here.
 */
export function applyConstantSpeedBehavior(controls: OrbitControls): void {
  const c = controls as OrbitInternals;

  c._getZoomScale = (delta: number) => {
    const radius = Math.max(c.getDistance(), MIN_ORBIT_DISTANCE);
    // Cap the step relative to radius so a near-min radius can't produce a
    // huge zoom-out factor (which previously snapped the whole view).
    const rawStep = Math.abs(delta) * 0.01 * ZOOM_WORLD_PER_DELTA * c.zoomSpeed;
    const step = Math.min(rawStep, radius * MAX_STEP_RATIO);
    // radius/(radius+step): dollyIn -> radius - step, dollyOut -> radius + step.
    return radius / (radius + step);
  };
}

export function createConstantSpeedOrbitControls(
  camera: Camera,
  domElement: HTMLElement,
): OrbitControls {
  const controls = new OrbitControls(camera, domElement);
  controls.minDistance = MIN_ORBIT_DISTANCE;
  controls.maxDistance = MAX_ORBIT_DISTANCE;
  applyConstantSpeedBehavior(controls);
  return controls;
}
