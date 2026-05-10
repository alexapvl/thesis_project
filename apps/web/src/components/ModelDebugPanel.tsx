import { useEffect, useState } from 'react';
import { useStore } from '@/store';

/**
 * Live read-out of model-side state. Surfaces what the inference server
 * is actually emitting so the user can tell whether weak fixture motion
 * is "the model isn't producing anything" vs "the model is producing
 * something but the smoothing is hiding it." Collapsed by default; the
 * data is high-frequency and visually noisy when always on.
 *
 * Re-renders on a 250 ms timer instead of subscribing to every store
 * write — the lighting slice updates every ~100 ms with a new prediction,
 * and at 60 Hz subscription would force a layout pass per frame for
 * decorative output.
 */
export function ModelDebugPanel() {
  const [open, setOpen] = useState(false);
  const [, force] = useState(0);

  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => force((n) => n + 1), 250);
    return () => window.clearInterval(id);
  }, [open]);

  if (!open) {
    return (
      <div className="model-debug">
        <button type="button" onClick={() => setOpen(true)}>
          show model details
        </button>
      </div>
    );
  }

  const lighting = useStore.getState().lighting;
  const inference = useStore.getState().inference;
  const transport = useStore.getState().transport;
  const audio = useStore.getState().audio;
  const playback = useStore.getState().playback;

  const lastUpdateAge =
    lighting.lastUpdateTimeMs != null ? Date.now() - lighting.lastUpdateTimeMs : null;
  const lastBeatAge =
    lighting.lastBeatTimeMs != null ? Date.now() - lighting.lastBeatTimeMs : null;
  const lastDownbeatAge =
    lighting.lastDownbeatTimeMs != null ? Date.now() - lighting.lastDownbeatTimeMs : null;
  const chunkAge =
    audio.lastChunkAtMs != null ? Date.now() - audio.lastChunkAtMs : null;
  // Beats-per-second over the rolling 10-second window. Zero is the
  // clearest debug signal: "BeatNet is producing nothing" feels very
  // different from "BeatNet is firing but the rig isn't moving."
  const now = Date.now();
  const recentBeats = lighting.beatEventTimestamps.filter((t) => t >= now - 10_000);
  const beatsPerSec = recentBeats.length / 10;

  return (
    <div className="model-debug">
      <div className="debug-header">
        <span>model output</span>
        <button type="button" onClick={() => setOpen(false)}>
          hide
        </button>
      </div>
      <dl className="model-debug-list">
        <Row label="inference" value={`${inference.state}${inference.detail ? ` — ${inference.detail}` : ''}`} />
        <Row label="hue" value={`${lighting.hue.toFixed(1)}°`} swatch={`hsl(${lighting.hue}, 80%, 50%)`} />
        <Row label="value" value={lighting.value.toFixed(3)} />
        <Row
          label="bpm"
          value={lighting.bpm != null ? lighting.bpm.toFixed(1) : '—'}
        />
        <Row
          label="beat phase"
          value={lighting.beatPhase != null ? lighting.beatPhase.toFixed(2) : '—'}
        />
        <Row
          label="confidence"
          value={lighting.confidence != null ? lighting.confidence.toFixed(2) : '—'}
        />
        <Row
          label="last lighting"
          value={lastUpdateAge != null ? `${lastUpdateAge} ms ago` : '—'}
        />
        <Row
          label="last beat"
          value={lastBeatAge != null ? `${lastBeatAge} ms ago` : '—'}
        />
        <Row
          label="last downbeat"
          value={lastDownbeatAge != null ? `${lastDownbeatAge} ms ago` : '—'}
        />
        <Row
          label="last chunk"
          value={chunkAge != null ? `${chunkAge} ms ago` : '—'}
        />
        <Row label="chunks sent" value={`${audio.chunksEmitted}`} />
        <Row
          label="beats recvd"
          value={`${lighting.beatsReceived} (${beatsPerSec.toFixed(1)}/s)`}
        />
        <Row
          label="beats real/synth"
          value={`${lighting.beatsReceivedReal} / ${lighting.beatsReceivedSynthetic}`}
        />
        <Row label="lighting frames" value={`${lighting.lightingFramesReceived}`} />
        <Row label="transport" value={transport.status} />
        <Row
          label="latency"
          value={transport.latencyMs != null ? `${Math.round(transport.latencyMs)} ms` : '—'}
        />
        <Row label="mode" value={playback.mode} />
        <Row
          label="position"
          value={`${(playback.positionMs / 1000).toFixed(1)} s${
            playback.durationMs != null ? ` / ${(playback.durationMs / 1000).toFixed(1)} s` : ''
          }`}
        />
      </dl>
    </div>
  );
}

function Row({ label, value, swatch }: { label: string; value: string; swatch?: string }) {
  return (
    <div className="model-debug-row">
      <dt>{label}</dt>
      <dd>
        {swatch && <span className="model-debug-swatch" style={{ background: swatch }} />}
        <span>{value}</span>
      </dd>
    </div>
  );
}
