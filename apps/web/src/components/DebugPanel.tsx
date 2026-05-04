import { useStore } from '@/store';

export function DebugPanel() {
  const log = useStore((s) => s.debug.log);
  const clear = useStore((s) => s.debugClear);

  return (
    <div className="debug-panel">
      <div className="debug-header">
        <span>debug log</span>
        <button type="button" onClick={clear}>clear</button>
      </div>
      <ol className="debug-list">
        {log.length === 0 && <li className="debug-empty">no events yet</li>}
        {log.slice(-50).map((e, i) => (
          <li key={`${e.ts}-${i}`} className={`debug-line debug-${e.level}`}>
            <span className="debug-ts">{new Date(e.ts).toLocaleTimeString()}</span>
            <span>{e.message}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}