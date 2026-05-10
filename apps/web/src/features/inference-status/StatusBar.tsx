import { useStore } from '@/store';

/**
 * Topbar at-a-glance health check. Detailed live stats (inference state,
 * BPM, latency, chunk counters, etc.) live in the collapsible model-output
 * panel; this stays narrow on purpose so the user only sees the "am I
 * connected and is anything broken" answer here.
 */
export function StatusBar() {
  const status = useStore((s) => s.transport.status);
  const lastError = useStore((s) => s.transport.lastError);

  return (
    <div className="status-bar">
      <span className={`pill pill-${status}`}>transport: {status}</span>
      {lastError && <span className="pill pill-error">err: {lastError}</span>}
    </div>
  );
}