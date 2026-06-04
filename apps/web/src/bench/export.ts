import { PROTOCOL_VERSION } from '@stl/protocol';
import { CANONICAL_CHUNK_SIZE } from '@/audio/types';
import type { MetricsReport } from '@stl/protocol';
import type { BenchSample, MetricStats } from './stats';
import { computeStats, lightingFps, statsByMetric } from './stats';

/** Rename backend stage keys for clearer thesis CSV columns. */
const SERVER_STAGE_EXPORT: Record<string, string> = {
  'beat.ingest': 'server.beat.ingest_ms',
  'beat.drain': 'server.beat.drain_ms',
  'skip.ingest': 'server.skip.ingest_queue_ms',
  'skip.drain': 'server.skip.drain_queue_ms',
  'skip.inference': 'server.skip.inference_ms',
};

function exportStageName(stage: string): string {
  return SERVER_STAGE_EXPORT[stage] ?? `server.${stage}`;
}

export type BenchMetadata = {
  runId: string;
  configLabel: string;
  startedAtIso: string;
  durationMs: number;
  warmupMs: number;
  protocolVersion: string;
  fileName: string | null;
  fileDurationMs: number | null;
  chunkSize: number;
  sampleRate: number;
  chunksSent: number;
  chunksReceived: number;
  beatsReal: number;
  beatsSynthetic: number;
  lightingFrames: number;
  device: string;
  beatTrackerKind: string;
  skipBartKind: string;
};

export type BenchExport = {
  metadata: BenchMetadata;
  summary: Map<string, MetricStats>;
  raw: BenchSample[];
};

function slugify(label: string): string {
  const trimmed = label.trim().replace(/\s+/g, '-');
  return trimmed.length > 0 ? trimmed.replace(/[^a-zA-Z0-9._-]+/g, '_') : 'bench';
}

function timestampSlug(iso: string): string {
  return iso.replace(/[:.]/g, '-');
}

export function buildExport(
  metadata: BenchMetadata,
  samples: BenchSample[],
  report: MetricsReport | null,
  warmupMs: number,
): BenchExport {
  const raw = [...samples];
  if (report) {
    for (const [stage, values] of Object.entries(report.stageSamples)) {
      const metric = exportStageName(stage);
      values.forEach((value) => {
        raw.push({ tMs: -1, metric, value });
      });
    }
  }
  const summary = statsByMetric(samples, warmupMs);
  summary.delete('lighting.frame');
  const fps = lightingFps(samples, warmupMs);
  if (fps != null) {
    summary.set('lighting.fps', {
      mean: fps,
      p50: fps,
      p95: fps,
      p99: fps,
      min: fps,
      max: fps,
      stddev: 0,
      n: 1,
    });
  }
  if (report) {
    const stages = new Set([
      ...Object.keys(report.stageSamples),
      ...Object.keys(report.stages),
    ]);
    for (const stage of stages) {
      const metric = exportStageName(stage);
      const sampleValues = report.stageSamples[stage] ?? [];
      const sampleStats = sampleValues.length > 0 ? computeStats(sampleValues) : null;
      if (sampleStats) {
        summary.set(metric, sampleStats);
        continue;
      }
      const stats = report.stages[stage];
      if (!stats) continue;
      summary.set(metric, {
        mean: stats.avg_ms,
        p50: stats.p50_ms,
        p95: stats.p95_ms,
        p99: stats.p95_ms,
        min: stats.min_ms,
        max: stats.max_ms,
        stddev: 0,
        n: stats.n,
      });
    }
  }
  return { metadata, summary, raw };
}

function metadataLines(metadata: BenchMetadata): string[] {
  return [
    `# run_id=${metadata.runId}`,
    `# config_label=${metadata.configLabel}`,
    `# started_at=${metadata.startedAtIso}`,
    `# duration_ms=${metadata.durationMs}`,
    `# warmup_ms=${metadata.warmupMs}`,
    `# protocol_version=${metadata.protocolVersion}`,
    `# file_name=${metadata.fileName ?? ''}`,
    `# file_duration_ms=${metadata.fileDurationMs ?? ''}`,
    `# chunk_size=${metadata.chunkSize}`,
    `# sample_rate=${metadata.sampleRate}`,
    `# chunks_sent=${metadata.chunksSent}`,
    `# chunks_received=${metadata.chunksReceived}`,
    `# beats_real=${metadata.beatsReal}`,
    `# beats_synthetic=${metadata.beatsSynthetic}`,
    `# lighting_frames=${metadata.lightingFrames}`,
    `# device=${metadata.device}`,
    `# beat_tracker=${metadata.beatTrackerKind}`,
    `# skip_bart=${metadata.skipBartKind}`,
    '# note_server_skip_ingest_queue_ms=time to enqueue chunk (not inference)',
    '# note_server_skip_drain_queue_ms=time to dequeue predictions (not inference)',
    '# note_server_skip_inference_ms=OpenL3 embed + Skip-BART decode on worker thread',
    '# note_server_stage_raw_t_ms=blank for backend samples (no client clock)',
  ];
}

export function summaryCsv(exportData: BenchExport): string {
  const lines = [
    ...metadataLines(exportData.metadata),
    'metric,mean,p50,p95,p99,min,max,stddev,n',
  ];
  for (const [metric, stats] of [...exportData.summary.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    lines.push(
      [
        metric,
        stats.mean.toFixed(3),
        stats.p50.toFixed(3),
        stats.p95.toFixed(3),
        stats.p99.toFixed(3),
        stats.min.toFixed(3),
        stats.max.toFixed(3),
        stats.stddev.toFixed(3),
        String(stats.n),
      ].join(','),
    );
  }
  return `${lines.join('\n')}\n`;
}

export function rawCsv(exportData: BenchExport): string {
  const lines = [...metadataLines(exportData.metadata), 't_ms,metric,value'];
  for (const sample of exportData.raw) {
    const tMs = sample.tMs < 0 ? '' : String(sample.tMs);
    lines.push(`${tMs},${sample.metric},${sample.value.toFixed(3)}`);
  }
  return `${lines.join('\n')}\n`;
}

export function downloadBenchCsvs(exportData: BenchExport): void {
  const stamp = timestampSlug(exportData.metadata.startedAtIso);
  const label = slugify(exportData.metadata.configLabel);
  downloadText(`${label}_${stamp}_summary.csv`, summaryCsv(exportData), 'text/csv');
  downloadText(`${label}_${stamp}_raw.csv`, rawCsv(exportData), 'text/csv');
}

function downloadText(filename: string, contents: string, mime: string): void {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function defaultMetadata(
  runId: string,
  configLabel: string,
  startedAtMs: number,
  durationMs: number,
  warmupMs: number,
  counters: {
    chunksSent: number;
    beatsReal: number;
    beatsSynthetic: number;
    lightingFrames: number;
  },
  playback: { fileName: string | null; durationMs: number | null },
  report: MetricsReport | null,
): BenchMetadata {
  return {
    runId,
    configLabel,
    startedAtIso: new Date(startedAtMs).toISOString(),
    durationMs,
    warmupMs,
    protocolVersion: PROTOCOL_VERSION,
    fileName: playback.fileName,
    fileDurationMs: playback.durationMs,
    chunkSize: CANONICAL_CHUNK_SIZE,
    sampleRate: 48000,
    chunksSent: counters.chunksSent,
    chunksReceived: report?.chunksReceived ?? 0,
    beatsReal: counters.beatsReal,
    beatsSynthetic: counters.beatsSynthetic,
    lightingFrames: counters.lightingFrames,
    device: report?.device ?? 'unknown',
    beatTrackerKind: report?.beatTrackerKind ?? 'unknown',
    skipBartKind: report?.skipBartKind ?? 'unknown',
  };
}
