import { useRef } from 'react';
import { useStore } from '@/store';

const ACCEPTED = '.wav,.mp3,.flac,.ogg,.m4a,audio/*';

export function FileUpload() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const fileName = useStore((s) => s.playback.fileName);
  const playbackSetFile = useStore((s) => s.playbackSetFile);
  const debugLog = useStore((s) => s.debugLog);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Decoding & playback land in a follow-up step. For now we just record metadata.
    playbackSetFile(file.name, null);
    debugLog('info', `selected file: ${file.name} (${file.size} bytes)`);
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
      <button type="button" onClick={() => inputRef.current?.click()}>
        {fileName ? 'Replace audio file' : 'Choose audio file'}
      </button>
      {fileName && <span className="file-name" title={fileName}>{fileName}</span>}
    </div>
  );
}