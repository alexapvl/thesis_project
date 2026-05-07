/**
 * Single-pole exponential smoothing toward a target, framerate-independent.
 *
 * `tauSeconds` is the time-constant: after `tau` seconds the output has
 * closed ~63% of the gap. Picked empirically for the lighting pipeline:
 * - hue: ~80 ms. Skip-BART's RSTC sampling is jittery frame-to-frame; this
 *   removes single-frame strobing without visibly lagging beat-aligned cuts.
 * - value: ~50 ms. Faster so beat-driven swells feel responsive.
 */
export function exponentialAlpha(deltaSeconds: number, tauSeconds: number): number {
  if (tauSeconds <= 0) return 1;
  return 1 - Math.exp(-deltaSeconds / tauSeconds);
}

/**
 * Step a scalar smoother toward `target` by `alpha` (0..1). Pure, returns
 * the new value.
 */
export function smoothScalar(current: number, target: number, alpha: number): number {
  return current + (target - current) * alpha;
}

/**
 * Step a hue smoother along the *shortest* circular path. Hue is in degrees
 * 0..360 and wraps; without circular handling, a jump from 350 → 10 would
 * sweep all the way back through 180.
 */
export function smoothHue(currentDeg: number, targetDeg: number, alpha: number): number {
  const cur = ((currentDeg % 360) + 360) % 360;
  const tgt = ((targetDeg % 360) + 360) % 360;
  let diff = tgt - cur;
  if (diff > 180) diff -= 360;
  else if (diff < -180) diff += 360;
  return ((cur + diff * alpha) % 360 + 360) % 360;
}

export const HUE_TAU_SECONDS = 0.08;
export const VALUE_TAU_SECONDS = 0.05;
