import { useRef, useState } from 'react';
import { useStore } from '@/store';
import { audioController } from '@/audio/audioController';

const ACCEPTED = '.wav,.mp3,.flac,.ogg,.m4a,audio/*';

export function FileUpload() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const fileName = useStore((s) => s.playback.fileName);
  const playbackSetFile = useStore((s) => s.playbackSetFile);
  const playbackSetMode = useStore((s) => s.playbackSetMode);
  const playbackSetPlaying = useStore((s) => s.playbackSetPlaying);
  const audioResetChunkCount = useStore((s) => s.audioResetChunkCount);
  const audioSetGraphReady = useStore((s) => s.audioSetGraphReady);
  const debugLog = useStore((s) => s.debugLog);
  const [busy, setBusy] = useState(false);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setBusy(true);
    debugLog('info', `decoding ${file.name} (${file.size} bytes)`);
    try {
      const { durationMs } = await audioController.loadFile(file);
      playbackSetFile(file.name, durationMs);
      playbackSetMode('file');
      playbackSetPlaying(false);
      audioResetChunkCount();
      audioSetGraphReady(true, 48000);
      debugLog('info', `decoded ${file.name}: ${(durationMs / 1000).toFixed(2)}s`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      debugLog('error', `decode failed: ${msg}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="file-upload">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        onChange={onPick}
        style={{ display: 'none' }}
      />
      <button type="button" onClick={() => inputRef.current?.click()} disabled={busy}>
        {busy ? 'Decoding…' : fileName ? 'Replace audio file' : 'Choose audio file'}
      </button>
      {fileName && <span className="file-name" title={fileName}>{fileName}</span>}
    </div>
  );
}