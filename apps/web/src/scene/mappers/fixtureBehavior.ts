/**
 * Deterministic presentation-layer behaviors derived from beat/downbeat
 * timestamps and a per-fixture seed. Same audio + same scene => same show.
 */

export function seedFrom(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashBeat(seed: number, beatMs: number): number {
  let h = seed ^ beatMs;
  h = Math.imul(h ^ (h >>> 16), 2246822519);
  h = Math.imul(h ^ (h >>> 13), 3266489917);
  return (h ^ (h >>> 16)) >>> 0;
}

export type BeatAimOptions = {
  radius: number;
  downbeatBoost: number;
  minDistance: number;
  currentX: number;
  currentZ: number;
  isDownbeat: boolean;
};

/** Deterministic XZ offset for a new beat (replaces Math.random in spot sweep). */
export function beatAimOffset(
  fixtureSeed: number,
  beatMs: number,
  opts: BeatAimOptions,
): { x: number; z: number } {
  const radius = opts.isDownbeat ? opts.radius * opts.downbeatBoost : opts.radius;
  const rng = mulberry32(hashBeat(fixtureSeed, beatMs));
  let x = 0;
  let z = 0;
  for (let i = 0; i < 8; i++) {
    x = (rng() * 2 - 1) * radius;
    z = (rng() * 2 - 1) * radius;
    const dx = x - opts.currentX;
    const dz = z - opts.currentZ;
    if (dx * dx + dz * dz >= opts.minDistance * opts.minDistance) break;
  }
  return { x, z };
}

/** Pixel/chase index that advances once per beat. */
export function chaseIndex(beatMs: number, count: number): number {
  if (count <= 0) return 0;
  return Math.abs(beatMs) % count;
}

/** Fast attack / exponential decay flash envelope on beat. */
export function strobeEnvelope(
  nowMs: number,
  lastBeatMs: number | null,
  flashMs: number,
): number {
  if (lastBeatMs == null) return 0;
  const elapsed = nowMs - lastBeatMs;
  if (elapsed < 0 || elapsed > flashMs * 4) return 0;
  if (elapsed < flashMs * 0.15) return 1;
  const t = (elapsed - flashMs * 0.15) / (flashMs * 0.85);
  return Math.max(0, 1 - t);
}

/** Transient intensity multiplier on downbeat. */
export function downbeatAccent(
  nowMs: number,
  downbeatMs: number | null,
  tauMs: number,
): number {
  if (downbeatMs == null) return 0;
  const elapsed = nowMs - downbeatMs;
  if (elapsed < 0 || elapsed > tauMs * 3) return 0;
  return Math.exp(-elapsed / tauMs);
}

/** Pattern step for laser (0..steps-1) from beat. */
export function patternStep(beatMs: number, steps: number): number {
  if (steps <= 1) return 0;
  return chaseIndex(beatMs, steps);
}

/** Pattern index swaps on downbeat. */
export function patternIndex(
  fixtureSeed: number,
  downbeatMs: number | null,
  patternCount: number,
): number {
  if (downbeatMs == null || patternCount <= 1) return 0;
  return hashBeat(fixtureSeed, downbeatMs) % patternCount;
}

export function readOverrideNumber(
  overrides: Record<string, unknown>,
  defaults: Record<string, unknown> | undefined,
  key: string,
  fallback: number,
): number {
  const o = overrides[key];
  if (typeof o === 'number') return o;
  const d = defaults?.[key];
  if (typeof d === 'number') return d;
  return fallback;
}
