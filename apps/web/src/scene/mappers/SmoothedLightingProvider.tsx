import { createContext, useContext, useMemo, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { useStore } from '@/store';
import { IDLE_VALUE_FLOOR, type LightingFrame } from './mapLightingFrame';
import {
  HUE_TAU_SECONDS,
  VALUE_TAU_SECONDS,
  exponentialAlpha,
  smoothHue,
  smoothScalar,
} from './smoothing';

/**
 * Container for the smoothed lighting frame. We expose a ref (not state)
 * so per-frame updates do not trigger React re-renders — fixtures read
 * the ref inside their own `useFrame` and apply values directly to
 * Three.js material/light objects. This is the standard r3f animation
 * pattern and keeps the React render loop quiet at 10 Hz prediction
 * rates running through 60 Hz display.
 */
export type SmoothedLightingRef = { current: LightingFrame };

const SmoothedLightingContext = createContext<SmoothedLightingRef | null>(null);

/**
 * Mounted inside `<Canvas>`. Reads the latest raw lighting frame from
 * the store every frame and steps the smoothed frame toward it. One
 * smoother shared by all fixtures so they stay phase-locked — running a
 * smoother per fixture would also work mathematically but would multiply
 * the per-frame cost for no visual benefit.
 *
 * `priority={-1}` makes this run before any default-priority useFrame so
 * fixture render hooks read the *current* frame's smoothed value, not
 * last frame's.
 */
export function SmoothedLightingProvider({ children }: { children: ReactNode }) {
  // Pre-seed value at IDLE_VALUE_FLOOR so the very first frame already
  // matches what mapLightingFrame would emit for "no prediction yet".
  // Without this seed, value=0 → smoother climbs toward target through
  // tiny positive numbers that bypass the floor in the mapper, producing
  // a visible dim flash on the first prediction after session start.
  const ref = useRef<LightingFrame>({ hue: 0, value: IDLE_VALUE_FLOOR });

  useFrame((_state, delta) => {
    const target = useStore.getState().lighting;
    // Pin to the idle floor whenever no prediction is current — this
    // covers pre-session warmup, post-stop, and seek-reset (each of
    // which sets lastUpdateTimeMs back to null). Without this branch
    // the smoother would track target.value=0 and dim the scene.
    if (target.lastUpdateTimeMs == null) {
      ref.current.value = IDLE_VALUE_FLOOR;
      return;
    }
    const aHue = exponentialAlpha(delta, HUE_TAU_SECONDS);
    const aValue = exponentialAlpha(delta, VALUE_TAU_SECONDS);
    ref.current.hue = smoothHue(ref.current.hue, target.hue, aHue);
    ref.current.value = smoothScalar(ref.current.value, target.value, aValue);
  }, -1);

  const value = useMemo(() => ref, []);
  return <SmoothedLightingContext.Provider value={value}>{children}</SmoothedLightingContext.Provider>;
}

export function useSmoothedLighting(): SmoothedLightingRef {
  const ctx = useContext(SmoothedLightingContext);
  if (!ctx) {
    throw new Error('useSmoothedLighting must be used inside <SmoothedLightingProvider>');
  }
  return ctx;
}
