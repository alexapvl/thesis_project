import { useStore } from '@/store';

function fmt(ms: number | null): string {
  if (ms == null) return '—';
  const s = Math.floor(ms / 1000);
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export function PlaybackControls() {
  const playback = useStore((s) => s.playback);
  const setPlaying = useStore((s) => s.playbackSetPlaying);

  const disabled = !playback.fileName;

  return (
    <div className="playback-controls">
      <button type="button" disabled={disabled} onClick={() => setPlaying(!playback.isPlaying)}>
        {playback.isPlaying ? 'Pause' : 'Play'}
      </button>
      <span className="time">
        {fmt(playback.positionMs)} / {fmt(playback.durationMs)}
      </span>
    </div>
  );
}