import { useStore } from '@/store';
import { audioController } from '@/audio/audioController';
import { sessionController } from '@/transport';

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
  const debugLog = useStore((s) => s.debugLog);

  const disabled = !playback.fileName || playback.mode !== 'file';

  async function onToggle() {
    try {
      if (playback.isPlaying) {
        audioController.pause();
        setPlaying(false);
      } else {
        await audioController.play();
        setPlaying(true);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      debugLog('error', `play/pause failed: ${msg}`);
    }
  }

  async function onSeek(ev: React.ChangeEvent<HTMLInputElement>) {
    const ms = Number(ev.target.value);
    await audioController.seek(ms);
    sessionController.seek(ms);
    // Position handler will push the new position into the store.
  }

  return (
    <div className="playback-controls">
      <button type="button" disabled={disabled} onClick={onToggle}>
        {playback.isPlaying ? 'Pause' : 'Play'}
      </button>
      <input
        type="range"
        min={0}
        max={playback.durationMs ?? 0}
        step={50}
        value={playback.positionMs}
        disabled={disabled || playback.durationMs == null}
        onChange={onSeek}
        className="seek"
      />
      <span className="time">
        {fmt(playback.positionMs)} / {fmt(playback.durationMs)}
      </span>
    </div>
  );
}