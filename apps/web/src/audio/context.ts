import { CANONICAL_SAMPLE_RATE } from './types';

/**
 * The shared AudioContext is created lazily, because browsers throw if you
 * construct one before a user gesture. Call `ensureAudioContext()` from any
 * click/keydown handler. Subsequent calls return the same instance.
 *
 * We request 48 kHz so file and microphone paths share the same context rate.
 * If the browser ignores the hint (Safari sometimes does), the worklet still
 * emits canonical 48 kHz by resampling — see chunk-worklet.ts.
 */
let ctx: AudioContext | null = null;

export function getAudioContext(): AudioContext | null {
  return ctx;
}

export async function ensureAudioContext(): Promise<AudioContext> {
  if (ctx && ctx.state !== 'closed') {
    if (ctx.state === 'suspended') await ctx.resume();
    return ctx;
  }
  ctx = new AudioContext({ sampleRate: CANONICAL_SAMPLE_RATE, latencyHint: 'interactive' });
  if (ctx.state === 'suspended') await ctx.resume();
  return ctx;
}

export async function closeAudioContext(): Promise<void> {
  if (!ctx) return;
  await ctx.close();
  ctx = null;
}