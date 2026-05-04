import { useStore } from '@/store';

export function StatusBar() {
  const transport = useStore((s) => s.transport);
  const inference = useStore((s) => s.inference);
  const lighting = useStore((s) => s.lighting);
  const playback = useStore((s) => s.playback);

  return (
    <div className="status-bar">
      <span className={`pill pill-${transport.status}`}>transport: {transport.status}</span>
      <span className={`pill pill-${inference.state}`}>inference: {inference.state}</span>
      <span className="pill">mode: {playback.mode}</span>
      {transport.latencyMs != null && (
        <span className="pill">latency: {Math.round(transport.latencyMs)} ms</span>
      )}
      {lighting.bpm != null && <span className="pill">bpm: {lighting.bpm.toFixed(1)}</span>}
      {transport.lastError && <span className="pill pill-error">err: {transport.lastError}</span>}
    </div>
  );
}