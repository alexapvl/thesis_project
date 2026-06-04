/** Internal counter samples — used for fps only, not exported in summary. */
export const SUMMARY_EXCLUDE = new Set(['lighting.frame']);

export type BenchSample = {
  tMs: number;
  metric: string;
  value: number;
};

export type MetricStats = {
  mean: number;
  p50: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  stddev: number;
  n: number;
};

export function computeStats(values: number[]): MetricStats | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = sorted.reduce((sum, v) => sum + v, 0) / n;
  const variance = sorted.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n;
    const p = (q: number) => sorted[Math.min(n - 1, Math.max(0, Math.floor(q * n)))] ?? 0;
    return {
      mean,
      p50: p(0.5),
      p95: p(0.95),
      p99: p(0.99),
      min: sorted[0] ?? 0,
      max: sorted[n - 1] ?? 0,
    stddev: Math.sqrt(variance),
    n,
  };
}

export function statsByMetric(
  samples: BenchSample[],
  warmupMs: number,
): Map<string, MetricStats> {
  const grouped = new Map<string, number[]>();
  for (const sample of samples) {
    if (sample.tMs < warmupMs) continue;
    if (SUMMARY_EXCLUDE.has(sample.metric)) continue;
    const bucket = grouped.get(sample.metric) ?? [];
    bucket.push(sample.value);
    grouped.set(sample.metric, bucket);
  }
  const out = new Map<string, MetricStats>();
  for (const [metric, values] of grouped) {
    const stats = computeStats(values);
    if (stats) out.set(metric, stats);
  }
  return out;
}

export function lightingFps(samples: BenchSample[], warmupMs: number, windowMs = 1000): number | null {
  const stamps = samples
    .filter((s) => s.metric === 'lighting.frame' && s.tMs >= warmupMs)
    .map((s) => s.tMs);
  if (stamps.length < 2) return stamps.length === 1 ? 1 : null;
  const span = stamps[stamps.length - 1]! - stamps[0]!;
  if (span <= 0) return null;
  return ((stamps.length - 1) / span) * windowMs;
}
