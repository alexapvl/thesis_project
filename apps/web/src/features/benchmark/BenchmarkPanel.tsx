import { useEffect, useState } from 'react';
import { audioController } from '@/audio/audioController';
import { benchmarkController } from '@/bench/benchmarkController';
import { useStore } from '@/store';
import { sessionController } from '@/transport';

export function BenchmarkPanel() {
  const [open, setOpen] = useState(false);
  const [configLabel, setConfigLabel] = useState('Mac-local-MPS');
  const [durationSec, setDurationSec] = useState('60');
  const [error, setError] = useState<string | null>(null);
  const [, force] = useState(0);
  const transportStatus = useStore((s) => s.transport.status);
  const fileName = useStore((s) => s.playback.fileName);
  const setPlaying = useStore((s) => s.playbackSetPlaying);

  useEffect(() => {
    if (!open) return;
    const unsub = benchmarkController.subscribe(() => force((n) => n + 1));
    const id = window.setInterval(() => force((n) => n + 1), 250);
    return () => {
      unsub();
      window.clearInterval(id);
    };
  }, [open]);

  if (!open) {
    return (
      <div className="benchmark-panel">
        <button type="button" onClick={() => setOpen(true)}>
          show benchmark
        </button>
      </div>
    );
  }

  const status = benchmarkController.getStatus();
  const live = benchmarkController.getLiveStats();
  const running = status === 'running' || status === 'finalizing';
  const canRun = fileName != null && transportStatus === 'connected';

  const onRun = async () => {
    setError(null);
    const parsed = durationSec.trim() === '' ? null : Number(durationSec);
    if (parsed != null && (!Number.isFinite(parsed) || parsed <= 0)) {
      setError('duration must be a positive number of seconds');
      return;
    }
    if (!fileName) {
      setError('load an audio file first');
      return;
    }
    if (transportStatus !== 'connected') {
      setError('transport must be connected');
      return;
    }
    try {
      await audioController.seek(0);
      sessionController.seek(0);
      await benchmarkController.start(configLabel, parsed);
      await audioController.play();
      setPlaying(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const onStop = async () => {
    setError(null);
    try {
      await benchmarkController.stop();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="benchmark-panel">
      <div className="debug-header">
        <span>benchmark</span>
        <button type="button" onClick={() => setOpen(false)}>
          hide
        </button>
      </div>
      <p className="benchmark-note">
        Load a track, then run benchmark. Start seeks to the beginning, starts the benchmark, and
        plays audio. Summary stats exclude the first 5 s warmup. Two CSV files download
        automatically when the run finishes.
      </p>
      <label className="benchmark-field">
        <span>config label</span>
        <input
          type="text"
          value={configLabel}
          disabled={running}
          onChange={(e) => setConfigLabel(e.target.value)}
          placeholder="Windows-CUDA-LAN"
        />
      </label>
      <label className="benchmark-field">
        <span>duration (s)</span>
        <input
          type="text"
          value={durationSec}
          disabled={running}
          onChange={(e) => setDurationSec(e.target.value)}
          placeholder="60 (blank = manual stop)"
        />
      </label>
      <div className="benchmark-actions">
        <button type="button" disabled={running || !canRun} onClick={() => void onRun()}>
          start benchmark &amp; play
        </button>
        <button type="button" disabled={status !== 'running'} onClick={() => void onStop()}>
          stop
        </button>
      </div>
      {error && <p className="benchmark-error">{error}</p>}
      <dl className="model-debug-list">
        <Row label="status" value={status} />
        <Row label="transport" value={transportStatus} />
        <Row label="file" value={fileName ?? '—'} />
        <Row label="elapsed" value={`${(live.elapsedMs / 1000).toFixed(1)} s`} />
        <Row label="chunks sent" value={`${live.chunksSent}`} />
        <Row label="beats real/synth" value={`${live.beatsReal} / ${live.beatsSynthetic}`} />
        <Row label="lighting frames" value={`${live.lightingFrames}`} />
        <Row
          label="rtt"
          value={live.lastRttMs != null ? `${Math.round(live.lastRttMs)} ms` : '—'}
        />
        <Row
          label="beat e2e"
          value={live.lastBeatE2eMs != null ? `${Math.round(live.lastBeatE2eMs)} ms` : '—'}
        />
        <Row
          label="light e2e"
          value={live.lastLightE2eMs != null ? `${Math.round(live.lastLightE2eMs)} ms` : '—'}
        />
      </dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="model-debug-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
