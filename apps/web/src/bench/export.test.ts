import { describe, expect, it } from 'vitest';
import { buildExport } from './export';
import type { BenchSample } from './stats';

describe('bench export', () => {
  it('excludes lighting.frame from summary and renames server queue metrics', () => {
    const samples: BenchSample[] = [
      { tMs: 6000, metric: 'lighting.frame', value: 1 },
      { tMs: 6000, metric: 'lighting.e2e_ms', value: 40 },
    ];
    const report = {
      type: 'metrics.report' as const,
      version: '1.0.0',
      sessionId: 's1',
      timestampMs: 0,
      sequence: 1,
      runId: 'run-1',
      stages: {
        'skip.drain': {
          count: 2,
          n: 2,
          min_ms: 0.01,
          p50_ms: 0.02,
          p95_ms: 0.03,
          max_ms: 0.04,
          avg_ms: 0.025,
        },
        'skip.inference': {
          count: 1,
          n: 1,
          min_ms: 120,
          p50_ms: 120,
          p95_ms: 120,
          max_ms: 120,
          avg_ms: 120,
        },
      },
      stageSamples: {
        'skip.drain': [0.01, 0.03],
        'skip.inference': [120],
      },
      chunksReceived: 10,
      device: 'mps',
      beatTrackerKind: 'beatnet',
      skipBartKind: 'skipbart',
    };
    const metadata = {
      runId: 'run-1',
      configLabel: 'test',
      startedAtIso: '2026-01-01T00:00:00.000Z',
      durationMs: 10000,
      warmupMs: 5000,
      protocolVersion: '1.0.0',
      fileName: 'x.wav',
      fileDurationMs: 1000,
      chunkSize: 2048,
      sampleRate: 48000,
      chunksSent: 10,
      chunksReceived: 10,
      beatsReal: 0,
      beatsSynthetic: 0,
      lightingFrames: 1,
      device: 'mps',
      beatTrackerKind: 'beatnet',
      skipBartKind: 'skipbart',
    };
    const out = buildExport(metadata, samples, report, 5000);
    expect(out.summary.has('lighting.frame')).toBe(false);
    expect(out.summary.has('server.skip.drain_queue_ms')).toBe(true);
    expect(out.summary.has('server.skip.inference_ms')).toBe(true);
    expect(out.raw.some((s) => s.metric === 'server.skip.inference_ms')).toBe(true);
  });

  it('uses full stageSamples for server summary stats, not rolling window n', () => {
    const fullSamples = Array.from({ length: 200 }, (_, i) => 1 + i * 0.01);
    const report = {
      type: 'metrics.report' as const,
      version: '1.0.0',
      sessionId: 's1',
      timestampMs: 0,
      sequence: 1,
      runId: 'run-2',
      stages: {
        'beat.ingest': {
          count: 200,
          n: 64,
          min_ms: 50,
          p50_ms: 50,
          p95_ms: 50,
          max_ms: 50,
          avg_ms: 50,
        },
      },
      stageSamples: {
        'beat.ingest': fullSamples,
      },
      chunksReceived: 200,
      device: 'mps',
      beatTrackerKind: 'beatnet',
      skipBartKind: 'skipbart',
    };
    const metadata = {
      runId: 'run-2',
      configLabel: 'test',
      startedAtIso: '2026-01-01T00:00:00.000Z',
      durationMs: 10000,
      warmupMs: 5000,
      protocolVersion: '1.0.0',
      fileName: 'x.wav',
      fileDurationMs: 1000,
      chunkSize: 2048,
      sampleRate: 48000,
      chunksSent: 200,
      chunksReceived: 200,
      beatsReal: 0,
      beatsSynthetic: 0,
      lightingFrames: 0,
      device: 'mps',
      beatTrackerKind: 'beatnet',
      skipBartKind: 'skipbart',
    };
    const out = buildExport(metadata, [], report, 5000);
    const stats = out.summary.get('server.beat.ingest_ms');
    expect(stats?.n).toBe(200);
    expect(stats?.min).toBeCloseTo(1, 3);
    expect(stats?.max).toBeCloseTo(2.99, 2);
    expect(stats?.mean).not.toBe(50);
  });
});
