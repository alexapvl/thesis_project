import { describe, expect, it } from 'vitest';
import { computeStats, statsByMetric } from './stats';

describe('bench stats', () => {
  it('computes percentiles', () => {
    const stats = computeStats([10, 20, 30, 40, 50]);
    expect(stats).not.toBeNull();
    expect(stats?.p50).toBe(30);
    expect(stats?.n).toBe(5);
  });

  it('excludes warmup samples from summary', () => {
    const samples = [
      { tMs: 1000, metric: 'network.rtt_ms', value: 999 },
      { tMs: 6000, metric: 'network.rtt_ms', value: 20 },
      { tMs: 7000, metric: 'network.rtt_ms', value: 30 },
    ];
    const summary = statsByMetric(samples, 5000);
    const rtt = summary.get('network.rtt_ms');
    expect(rtt?.n).toBe(2);
    expect(rtt?.min).toBe(20);
  });
});
