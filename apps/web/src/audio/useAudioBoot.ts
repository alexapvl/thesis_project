import { useEffect } from 'react';
import { useStore } from '@/store';
import { sessionController } from '@/transport';
import { audioController } from './audioController';
import { CANONICAL_SAMPLE_RATE } from './types';

/**
 * Mounts at app boot. Connects the audio controller's chunk / position /
 * ended callbacks to the store. Does NOT create the AudioContext — that
 * happens lazily on the first user gesture.
 */
export function useAudioBoot() {
  const audioBumpChunkCount = useStore((s) => s.audioBumpChunkCount);
  const playbackSetPosition = useStore((s) => s.playbackSetPosition);
  const playbackSetPlaying = useStore((s) => s.playbackSetPlaying);

  useEffect(() => {
    audioController.setChunkHandler((msg) => {
      audioBumpChunkCount();
      const { mode, positionMs } = useStore.getState().playback;
      sessionController.pushChunk(msg.pcm, mode === 'file' ? positionMs : null);
    });
    audioController.setPositionHandler((ms) => {
      playbackSetPosition(ms);
    });
    audioController.setEndedHandler(() => {
      playbackSetPlaying(false);
    });
    useStore.getState().audioSetGraphReady(false, CANONICAL_SAMPLE_RATE);
    return () => {
      audioController.setChunkHandler(null);
      audioController.setPositionHandler(null);
      audioController.setEndedHandler(null);
    };
  }, [audioBumpChunkCount, playbackSetPosition, playbackSetPlaying]);
}