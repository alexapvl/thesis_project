import { ensureAudioContext } from './context';
import { ensureAudioGraph } from './graph';
import { createFilePlayer, type FilePlayer } from './fileSource';
import { createMicrophoneSource, type MicrophoneSource } from './microphone';
import type { WorkletChunkMessage } from './types';

/**
 * Singleton, imperative controller used by hooks. Holds the current player /
 * mic and routes lifecycle calls. Lives outside the store so that React
 * re-renders never tear down the audio graph.
 */

type ChunkHandler = (msg: WorkletChunkMessage) => void;

class AudioController {
  private filePlayer: FilePlayer | null = null;
  private mic: MicrophoneSource | null = null;
  private chunkUnsub: (() => void) | null = null;
  private chunkHandler: ChunkHandler | null = null;
  private positionHandler: ((ms: number) => void) | null = null;
  private endedHandler: (() => void) | null = null;

  setChunkHandler(cb: ChunkHandler | null) {
    this.chunkHandler = cb;
  }

  setPositionHandler(cb: ((ms: number) => void) | null) {
    this.positionHandler = cb;
  }

  setEndedHandler(cb: (() => void) | null) {
    this.endedHandler = cb;
  }

  private async ensureChunkSubscription() {
    if (this.chunkUnsub) return;
    const graph = await ensureAudioGraph();
    this.chunkUnsub = graph.onChunk((msg) => {
      this.chunkHandler?.(msg);
    });
  }

  async loadFile(file: File): Promise<{ durationMs: number }> {
    await ensureAudioContext();
    await this.ensureChunkSubscription();
    if (this.filePlayer) {
      this.filePlayer.dispose();
      this.filePlayer = null;
    }
    if (this.mic) {
      await this.mic.stop();
      this.mic = null;
    }
    this.filePlayer = await createFilePlayer(file, {
      onPositionMs: (ms) => this.positionHandler?.(ms),
      onEnded: () => this.endedHandler?.(),
    });
    return { durationMs: this.filePlayer.durationMs };
  }

  async play() {
    if (!this.filePlayer) throw new Error('no file loaded');
    await this.filePlayer.play();
  }

  pause() {
    this.filePlayer?.pause();
  }

  async seek(positionMs: number) {
    if (!this.filePlayer) return;
    await this.filePlayer.seek(positionMs);
  }

  isFilePlaying(): boolean {
    return this.filePlayer?.isPlaying() ?? false;
  }

  filePositionMs(): number {
    return this.filePlayer?.positionMs() ?? 0;
  }

  async startMicrophone() {
    await ensureAudioContext();
    await this.ensureChunkSubscription();
    if (this.filePlayer) {
      this.filePlayer.pause();
    }
    if (!this.mic) {
      this.mic = await createMicrophoneSource();
    }
    await this.mic.start();
  }

  async stopMicrophone() {
    if (!this.mic) return;
    await this.mic.stop();
    this.mic = null;
  }

  hasFile(): boolean {
    return this.filePlayer != null;
  }

  isMicActive(): boolean {
    return this.mic?.isActive() ?? false;
  }

  dispose() {
    this.chunkUnsub?.();
    this.chunkUnsub = null;
    this.filePlayer?.dispose();
    this.filePlayer = null;
    this.mic?.stop();
    this.mic = null;
  }
}

export const audioController = new AudioController();