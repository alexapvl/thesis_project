import { z } from 'zod';
import { envelopeSchema } from './envelope';

export const sourceModeSchema = z.enum(['file', 'microphone']);
export type SourceMode = z.infer<typeof sourceModeSchema>;

// ──────────────────────────────────────────────────────────────────────────────
// Upstream (browser → server)
// ──────────────────────────────────────────────────────────────────────────────

export const sessionInitSchema = envelopeSchema.extend({
  type: z.literal('session.init'),
  sourceMode: sourceModeSchema,
  chunkSize: z.number().int().positive(),
  sampleRate: z.number().int().positive(),
  fileMetadata: z
    .object({
      fileName: z.string(),
      durationMs: z.number().nonnegative().nullable(),
    })
    .optional(),
  protocolVersion: z.string(),
});
export type SessionInit = z.infer<typeof sessionInitSchema>;

export const audioChunkSchema = envelopeSchema.extend({
  type: z.literal('audio.chunk'),
  startOffsetMs: z.number().nullable(),
  playbackPositionMs: z.number().nullable(),
  channels: z.literal(1),
  sampleRate: z.literal(48000),
  pcm: z.string(), // base64-encoded Float32 PCM
});
export type AudioChunk = z.infer<typeof audioChunkSchema>;

export const sessionSeekSchema = envelopeSchema.extend({
  type: z.literal('session.seek'),
  newPositionMs: z.number().nonnegative(),
  resetInference: z.boolean(),
  sourceMode: sourceModeSchema,
});
export type SessionSeek = z.infer<typeof sessionSeekSchema>;

export const sessionStopSchema = envelopeSchema.extend({
  type: z.literal('session.stop'),
});
export type SessionStop = z.infer<typeof sessionStopSchema>;

export const clientPingSchema = envelopeSchema.extend({
  type: z.literal('client.ping'),
});
export type ClientPing = z.infer<typeof clientPingSchema>;

export const benchStartSchema = envelopeSchema.extend({
  type: z.literal('bench.start'),
  runId: z.string(),
  configLabel: z.string(),
});
export type BenchStart = z.infer<typeof benchStartSchema>;

export const benchStopSchema = envelopeSchema.extend({
  type: z.literal('bench.stop'),
  runId: z.string(),
});
export type BenchStop = z.infer<typeof benchStopSchema>;

export const upstreamMessageSchema = z.discriminatedUnion('type', [
  sessionInitSchema,
  audioChunkSchema,
  sessionSeekSchema,
  sessionStopSchema,
  clientPingSchema,
  benchStartSchema,
  benchStopSchema,
]);
export type UpstreamMessage = z.infer<typeof upstreamMessageSchema>;

// ──────────────────────────────────────────────────────────────────────────────
// Downstream (server → browser)
// ──────────────────────────────────────────────────────────────────────────────

export const sessionReadySchema = envelopeSchema.extend({
  type: z.literal('session.ready'),
  protocolVersion: z.string(),
});
export type SessionReady = z.infer<typeof sessionReadySchema>;

export const beatUpdateSchema = envelopeSchema.extend({
  type: z.literal('beat.update'),
  beatTimeMs: z.number(),
  confidence: z.number().min(0).max(1).nullable(),
  // BeatNet labels each beat as either a downbeat (the "1" of a bar) or
  // a regular beat. Optional so older servers without the field still
  // validate; clients that want to accent downbeats should treat
  // missing as `false`.
  isDownbeat: z.boolean().optional(),
  // True when the beat was synthesized by the backend's tempo-locked
  // phase predictor rather than emitted by BeatNet itself. We synthesize
  // when the predicted next beat passes without a real BeatNet beat —
  // this keeps fixture movement at the right cadence on tracks where
  // the model misses beats. Real beats resync the predictor's phase.
  synthetic: z.boolean().optional(),
  // Frontend clock time (ms) of the audio chunk that produced this beat.
  // Used for end-to-end latency measurement on the client.
  originChunkTimestampMs: z.number().optional(),
  serverProcessingMs: z.number().optional(),
});
export type BeatUpdate = z.infer<typeof beatUpdateSchema>;

export const tempoUpdateSchema = envelopeSchema.extend({
  type: z.literal('tempo.update'),
  bpm: z.number().positive(),
  confidence: z.number().min(0).max(1).nullable(),
});
export type TempoUpdate = z.infer<typeof tempoUpdateSchema>;

export const lightingUpdateSchema = envelopeSchema.extend({
  type: z.literal('lighting.update'),
  hue: z.number().min(0).max(360),
  value: z.number().min(0).max(1),
  beatPulse: z.number().min(0).max(1).nullable(),
  intensity: z.number().min(0).max(1).nullable(),
  confidence: z.number().min(0).max(1).nullable(),
  originChunkTimestampMs: z.number().optional(),
  serverProcessingMs: z.number().optional(),
});
export type LightingUpdate = z.infer<typeof lightingUpdateSchema>;

const stageSummarySchema = z.object({
  count: z.number().int(),
  n: z.number().int(),
  min_ms: z.number(),
  p50_ms: z.number(),
  p95_ms: z.number(),
  max_ms: z.number(),
  avg_ms: z.number(),
});

export const metricsReportSchema = envelopeSchema.extend({
  type: z.literal('metrics.report'),
  runId: z.string(),
  stages: z.record(stageSummarySchema),
  stageSamples: z.record(z.array(z.number())),
  chunksReceived: z.number().int().nonnegative(),
  device: z.string(),
  beatTrackerKind: z.string(),
  skipBartKind: z.string(),
});
export type MetricsReport = z.infer<typeof metricsReportSchema>;

export const inferenceStatusSchema = envelopeSchema.extend({
  type: z.literal('inference.status'),
  state: z.enum(['idle', 'warming', 'running', 'stalled', 'error']),
  detail: z.string().nullable(),
});
export type InferenceStatus = z.infer<typeof inferenceStatusSchema>;

export const serverErrorSchema = envelopeSchema.extend({
  type: z.literal('server.error'),
  code: z.string(),
  message: z.string(),
});
export type ServerError = z.infer<typeof serverErrorSchema>;

export const serverPongSchema = envelopeSchema.extend({
  type: z.literal('server.pong'),
});
export type ServerPong = z.infer<typeof serverPongSchema>;

export const downstreamMessageSchema = z.discriminatedUnion('type', [
  sessionReadySchema,
  beatUpdateSchema,
  tempoUpdateSchema,
  lightingUpdateSchema,
  inferenceStatusSchema,
  serverErrorSchema,
  serverPongSchema,
  metricsReportSchema,
]);
export type DownstreamMessage = z.infer<typeof downstreamMessageSchema>;
