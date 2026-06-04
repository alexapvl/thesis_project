import type { BeatUpdate, LightingUpdate, MetricsReport } from '@stl/protocol';
import { useStore } from '@/store';
import { buildExport, defaultMetadata, downloadBenchCsvs } from './export';
import type { BenchSample } from './stats';

export const BENCH_WARMUP_MS = 5000;

export type BenchStatus = 'idle' | 'running' | 'finalizing';

export type BenchLiveStats = {
  elapsedMs: number;
  chunksSent: number;
  beatsReal: number;
  beatsSynthetic: number;
  lightingFrames: number;
  lastRttMs: number | null;
  lastBeatE2eMs: number | null;
  lastLightE2eMs: number | null;
};

type SendBenchStart = (runId: string, configLabel: string) => void;
type SendBenchStop = (runId: string) => void;

type Listener = () => void;

class BenchmarkController {
  private status: BenchStatus = 'idle';
  private runId: string | null = null;
  private configLabel = '';
  private startedAtMs = 0;
  private durationMs: number | null = null;
  private stopTimer: number | null = null;
  private samples: BenchSample[] = [];
  private chunksSent = 0;
  private beatsReal = 0;
  private beatsSynthetic = 0;
  private lightingFrames = 0;
  private lastRttMs: number | null = null;
  private lastBeatE2eMs: number | null = null;
  private lastLightE2eMs: number | null = null;
  private pendingReport: {
    runId: string;
    resolve: (report: MetricsReport) => void;
    reject: (err: Error) => void;
    timer: number;
  } | null = null;
  private sendStart: SendBenchStart | null = null;
  private sendStop: SendBenchStop | null = null;
  private seenDwellKeys = new Set<string>();
  private listeners = new Set<Listener>();

  bindTransport(sendStart: SendBenchStart, sendStop: SendBenchStop): void {
    this.sendStart = sendStart;
    this.sendStop = sendStop;
  }

  subscribe(cb: Listener): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  getStatus(): BenchStatus {
    return this.status;
  }

  getLiveStats(): BenchLiveStats {
    const elapsedMs =
      this.status === 'idle' || this.startedAtMs === 0 ? 0 : Date.now() - this.startedAtMs;
    return {
      elapsedMs,
      chunksSent: this.chunksSent,
      beatsReal: this.beatsReal,
      beatsSynthetic: this.beatsSynthetic,
      lightingFrames: this.lightingFrames,
      lastRttMs: this.lastRttMs,
      lastBeatE2eMs: this.lastBeatE2eMs,
      lastLightE2eMs: this.lastLightE2eMs,
    };
  }

  async start(configLabel: string, durationSec: number | null): Promise<void> {
    if (this.status !== 'idle') return;
    if (!this.sendStart || !this.sendStop) {
      throw new Error('benchmark transport not bound');
    }
    const trimmed = configLabel.trim();
    if (!trimmed) {
      throw new Error('config label is required');
    }

    this.resetCounters();
    this.samples = [];
    this.runId = crypto.randomUUID();
    this.configLabel = trimmed;
    this.startedAtMs = Date.now();
    this.durationMs = durationSec != null && durationSec > 0 ? durationSec * 1000 : null;
    this.status = 'running';
    this.notify();

    this.sendStart(this.runId, trimmed);

    if (this.stopTimer != null) {
      window.clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }
    if (this.durationMs != null) {
      this.stopTimer = window.setTimeout(() => {
        void this.stop();
      }, this.durationMs);
    }
  }

  async stop(): Promise<void> {
    if (this.status !== 'running' || !this.runId || !this.sendStop) return;
    if (this.stopTimer != null) {
      window.clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }

    const runId = this.runId;
    this.status = 'finalizing';
    this.notify();

    try {
      const report = await this.waitForReport(runId);
      this.finish(runId, report);
    } catch (err) {
      this.status = 'idle';
      this.runId = null;
      this.notify();
      throw err;
    }
  }

  onChunkSent(): void {
    if (this.status !== 'running' || this.startedAtMs === 0) return;
    this.chunksSent += 1;
    this.notify();
  }

  onRtt(rttMs: number): void {
    if (this.status !== 'running' || this.startedAtMs === 0) return;
    this.lastRttMs = rttMs;
    this.pushSample('network.rtt_ms', rttMs);
    this.notify();
  }

  onBeatUpdate(msg: BeatUpdate): void {
    if (this.status !== 'running' || this.startedAtMs === 0) return;
    if (msg.synthetic) this.beatsSynthetic += 1;
    else this.beatsReal += 1;
    if (msg.originChunkTimestampMs != null) {
      const e2e = Date.now() - msg.originChunkTimestampMs;
      this.lastBeatE2eMs = e2e;
      this.pushSample('beat.e2e_ms', e2e);
    }
    this.maybeRecordDwell(msg.originChunkTimestampMs, msg.serverProcessingMs);
    this.notify();
  }

  onLightingUpdate(msg: LightingUpdate): void {
    if (this.status !== 'running' || this.startedAtMs === 0) return;
    this.lightingFrames += 1;
    this.pushSample('lighting.frame', this.lightingFrames);
    if (msg.originChunkTimestampMs != null) {
      const e2e = Date.now() - msg.originChunkTimestampMs;
      this.lastLightE2eMs = e2e;
      this.pushSample('lighting.e2e_ms', e2e);
    }
    this.maybeRecordDwell(msg.originChunkTimestampMs, msg.serverProcessingMs);
    this.notify();
  }

  onMetricsReport(msg: MetricsReport): void {
    if (this.pendingReport?.runId === msg.runId) {
      window.clearTimeout(this.pendingReport.timer);
      this.pendingReport.resolve(msg);
      this.pendingReport = null;
    }
  }

  private finish(runId: string, report: MetricsReport): void {
    const playbackState = useStore.getState().playback;
    const playback = {
      fileName: playbackState.fileName,
      durationMs: playbackState.durationMs,
    };

    const durationMs = Date.now() - this.startedAtMs;
    const metadata = defaultMetadata(
      runId,
      this.configLabel,
      this.startedAtMs,
      durationMs,
      BENCH_WARMUP_MS,
      {
        chunksSent: this.chunksSent,
        beatsReal: this.beatsReal,
        beatsSynthetic: this.beatsSynthetic,
        lightingFrames: this.lightingFrames,
      },
      playback,
      report,
    );
    const exportData = buildExport(metadata, this.samples, report, BENCH_WARMUP_MS);
    downloadBenchCsvs(exportData);

    this.status = 'idle';
    this.runId = null;
    this.notify();
  }

  private waitForReport(runId: string): Promise<MetricsReport> {
    return new Promise((resolve, reject) => {
      if (this.pendingReport) {
        window.clearTimeout(this.pendingReport.timer);
        this.pendingReport.reject(new Error('superseded benchmark report'));
      }
      const timer = window.setTimeout(() => {
        this.pendingReport = null;
        reject(new Error('timed out waiting for metrics.report'));
      }, 10_000);
      this.pendingReport = { runId, resolve, reject, timer };
      this.sendStop?.(runId);
    });
  }

  private pushSample(metric: string, value: number): void {
    this.samples.push({
      tMs: Date.now() - this.startedAtMs,
      metric,
      value,
    });
  }

  private maybeRecordDwell(
    originChunkTimestampMs: number | undefined,
    serverProcessingMs: number | undefined,
  ): void {
    if (serverProcessingMs == null) return;
    const key = `${originChunkTimestampMs ?? 'na'}:${serverProcessingMs.toFixed(3)}`;
    if (this.seenDwellKeys.has(key)) return;
    this.seenDwellKeys.add(key);
    this.pushSample('server.dwell_ms', serverProcessingMs);
  }

  private resetCounters(): void {
    this.chunksSent = 0;
    this.beatsReal = 0;
    this.beatsSynthetic = 0;
    this.lightingFrames = 0;
    this.lastRttMs = null;
    this.lastBeatE2eMs = null;
    this.lastLightE2eMs = null;
    this.seenDwellKeys.clear();
  }

  private notify(): void {
    for (const cb of this.listeners) cb();
  }
}

export const benchmarkController = new BenchmarkController();
