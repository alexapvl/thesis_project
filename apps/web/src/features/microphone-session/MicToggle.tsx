import { useState } from 'react';
import { useStore } from '@/store';
import { audioController } from '@/audio/audioController';

export function MicToggle() {
  const mode = useStore((s) => s.playback.mode);
  const playbackSetMode = useStore((s) => s.playbackSetMode);
  const playbackSetPlaying = useStore((s) => s.playbackSetPlaying);
  const audioSetGraphReady = useStore((s) => s.audioSetGraphReady);
  const audioResetChunkCount = useStore((s) => s.audioResetChunkCount);
  const debugLog = useStore((s) => s.debugLog);
  const [busy, setBusy] = useState(false);

  const isMic = mode === 'microphone';

  async function onToggle() {
    setBusy(true);
    try {
      if (isMic) {
        await audioController.stopMicrophone();
        playbackSetMode('file');
        debugLog('info', 'microphone stopped');
      } else {
        await audioController.startMicrophone();
        playbackSetMode('microphone');
        playbackSetPlaying(false);
        audioResetChunkCount();
        audioSetGraphReady(true, 48000);
        debugLog('info', 'microphone started');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      debugLog('error', `mic toggle failed: ${msg}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={onToggle} disabled={busy} title="Toggle microphone capture">
      {busy ? '…' : isMic ? '⏺ Mic on' : '🎙 Mic'}
    </button>
  );
}