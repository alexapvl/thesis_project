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

export const upstreamMessageSchema = z.discriminatedUnion('type', [
  sessionInitSchema,
  audioChunkSchema,
  sessionSeekSchema,
  sessionStopSchema,
  clientPingSchema,
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
});
export type LightingUpdate = z.infer<typeof lightingUpdateSchema>;

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
]);
export type DownstreamMessage = z.infer<typeof downstreamMessageSchema>;
