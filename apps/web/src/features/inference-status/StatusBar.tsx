import { useEffect, useState } from 'react';
import { useStore } from '@/store';

export function StatusBar() {
  const transport = useStore((s) => s.transport);
  const inference = useStore((s) => s.inference);
  const lighting = useStore((s) => s.lighting);
  const playback = useStore((s) => s.playback);
  const audio = useStore((s) => s.audio);
  const [, force] = useState(0);

  // Re-render every 500ms so the "chunks/s" view stays live without resubscribing per chunk.
  useEffect(() => {
    const id = window.setInterval(() => force((n) => n + 1), 500);
    return () => window.clearInterval(id);
  }, []);

  const chunkAge =
    audio.lastChunkAtMs != null ? (Date.now() - audio.lastChunkAtMs) / 1000 : null;
  const chunksLive = chunkAge != null && chunkAge < 2;

  return (
    <div className="status-bar">
      <span className={`pill pill-${transport.status}`}>transport: {transport.status}</span>
      <span className={`pill pill-${inference.state}`}>inference: {inference.state}</span>
      <span className="pill">mode: {playback.mode}</span>
      <span className={chunksLive ? 'pill pill-running' : 'pill'}>
        chunks: {audio.chunksEmitted}
      </span>
      {transport.latencyMs != null && (
        <span className="pill">latency: {Math.round(transport.latencyMs)} ms</span>
      )}
      {lighting.bpm != null && <span className="pill">bpm: {lighting.bpm.toFixed(1)}</span>}
      {transport.lastError && <span className="pill pill-error">err: {transport.lastError}</span>}
    </div>
  );
}