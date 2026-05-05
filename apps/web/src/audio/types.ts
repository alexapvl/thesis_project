import { CANONICAL_SAMPLE_RATE } from '@stl/protocol';

/** Canonical chunk size at 48 kHz: 2048 samples ≈ 42.7 ms. */
export const CANONICAL_CHUNK_SIZE = 2048;
export { CANONICAL_SAMPLE_RATE };

/** Payload posted from the worklet to the main thread, one per finished chunk. */
export type WorkletChunkMessage = {
  type: 'chunk';
  /** Float32 PCM, mono, exactly CANONICAL_CHUNK_SIZE samples. */
  pcm: Float32Array;
  /** Worklet-side monotonic chunk counter. */
  sequence: number;
  /** Worklet currentTime when the chunk's *first* sample was processed. */
  startTimeS: number;
};

export type WorkletMessage = WorkletChunkMessage;