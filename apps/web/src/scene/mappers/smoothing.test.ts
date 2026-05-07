import { describe, expect, it } from 'vitest';
import { exponentialAlpha, smoothHue, smoothScalar } from './smoothing';

describe('exponentialAlpha', () => {
  it('returns ~0 for tiny dt and ~1 for huge dt', () => {
    expect(exponentialAlpha(0, 0.1)).toBeCloseTo(0);
    expect(exponentialAlpha(10, 0.1)).toBeGreaterThan(0.99);
  });

  it('hits ~63% at dt = tau (the time-constant definition)', () => {
    expect(exponentialAlpha(0.1, 0.1)).toBeCloseTo(1 - Math.exp(-1), 3);
  });

  it('clamps to 1 when tau is non-positive', () => {
    expect(exponentialAlpha(0.016, 0)).toBe(1);
  });
});

describe('smoothScalar', () => {
  it('moves a fraction of the gap toward target', () => {
    expect(smoothScalar(0, 1, 0.5)).toBeCloseTo(0.5);
    expect(smoothScalar(0, 1, 1)).toBeCloseTo(1);
    expect(smoothScalar(0.4, 0.4, 0.3)).toBeCloseTo(0.4);
  });
});

describe('smoothHue', () => {
  it('takes the short way around the circle', () => {
    // 350 -> 10 should go forward through 0, not backward through 180
    const next = smoothHue(350, 10, 0.5);
    // After 50% of a 20° forward step, we should be at 0
    expect(next).toBeCloseTo(0, 1);
  });

  it('takes the short way in the other direction', () => {
    // 10 -> 350 should go backward through 0
    const next = smoothHue(10, 350, 0.5);
    expect(next).toBeCloseTo(0, 1);
  });

  it('keeps output in [0, 360)', () => {
    for (const [cur, tgt] of [
      [0, 359],
      [359, 0],
      [180, 270],
      [270, 90],
    ] as const) {
      const next = smoothHue(cur, tgt, 0.3);
      expect(next).toBeGreaterThanOrEqual(0);
      expect(next).toBeLessThan(360);
    }
  });

  it('is stable when current already equals target', () => {
    expect(smoothHue(120, 120, 0.5)).toBeCloseTo(120);
  });
});
