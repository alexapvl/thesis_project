import {
  CANONICAL_SAMPLE_RATE,
  PROTOCOL_VERSION,
  type AudioChunk,
  type BenchStart,
  type BenchStop,
  type ClientPing,
  type SessionInit,
  type SessionSeek,
  type SessionStop,
  type SourceMode,
} from '@stl/protocol';
import { pcmFloat32ToBase64 } from '@/audio/chunkEncoder';

type EnvelopeArgs = {
  sessionId: string;
  sequence: number;
  timestampMs?: number;
};

function nowMs(): number {
  return Date.now();
}

function envelope({ sessionId, sequence, timestampMs }: EnvelopeArgs) {
  return {
    version: PROTOCOL_VERSION,
    sessionId,
    sequence,
    timestampMs: timestampMs ?? nowMs(),
  };
}

export function buildSessionInit(args: {
  sessionId: string;
  sequence: number;
  sourceMode: SourceMode;
  chunkSize: number;
  fileMetadata?: { fileName: string; durationMs: number | null };
}): SessionInit {
  return {
    type: 'session.init',
    ...envelope(args),
    sourceMode: args.sourceMode,
    chunkSize: args.chunkSize,
    sampleRate: CANONICAL_SAMPLE_RATE,
    fileMetadata: args.fileMetadata,
    protocolVersion: PROTOCOL_VERSION,
  };
}

export function buildAudioChunk(args: {
  sessionId: string;
  sequence: number;
  pcm: Float32Array;
  startOffsetMs: number | null;
  playbackPositionMs: number | null;
}): AudioChunk {
  return {
    type: 'audio.chunk',
    ...envelope(args),
    startOffsetMs: args.startOffsetMs,
    playbackPositionMs: args.playbackPositionMs,
    channels: 1,
    sampleRate: CANONICAL_SAMPLE_RATE,
    pcm: pcmFloat32ToBase64(args.pcm),
  };
}

export function buildSessionSeek(args: {
  sessionId: string;
  sequence: number;
  newPositionMs: number;
  resetInference: boolean;
  sourceMode: SourceMode;
}): SessionSeek {
  return {
    type: 'session.seek',
    ...envelope(args),
    newPositionMs: args.newPositionMs,
    resetInference: args.resetInference,
    sourceMode: args.sourceMode,
  };
}

export function buildSessionStop(args: { sessionId: string; sequence: number }): SessionStop {
  return {
    type: 'session.stop',
    ...envelope(args),
  };
}

export function buildClientPing(args: { sessionId: string; sequence: number }): ClientPing {
  return {
    type: 'client.ping',
    ...envelope(args),
  };
}

export function buildBenchStart(args: {
  sessionId: string;
  sequence: number;
  runId: string;
  configLabel: string;
}): BenchStart {
  return {
    type: 'bench.start',
    ...envelope(args),
    runId: args.runId,
    configLabel: args.configLabel,
  };
}

export function buildBenchStop(args: {
  sessionId: string;
  sequence: number;
  runId: string;
}): BenchStop {
  return {
    type: 'bench.stop',
    ...envelope(args),
    runId: args.runId,
  };
}
