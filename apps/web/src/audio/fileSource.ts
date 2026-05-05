import { ensureAudioGraph } from './graph';

export type FilePlayerEvents = {
  onPositionMs: (positionMs: number) => void;
  onEnded: () => void;
};

export type FilePlayer = {
  durationMs: number;
  isPlaying: () => boolean;
  positionMs: () => number;
  play: () => Promise<void>;
  pause: () => void;
  seek: (positionMs: number) => Promise<void>;
  dispose: () => void;
};

/**
 * Decode the file in the browser, attach an AudioBufferSourceNode through the
 * shared graph, and expose imperative controls. Web Audio sources are
 * one-shot, so play / pause / seek each tear down and recreate the node — the
 * graph always sees a freshly wired source so file ↔ mic switches are clean.
 */
export async function createFilePlayer(file: File, events: FilePlayerEvents): Promise<FilePlayer> {
  const graph = await ensureAudioGraph();
  const arrayBuf = await file.arrayBuffer();
  const audioBuffer = await graph.ctx.decodeAudioData(arrayBuf);

  let source: AudioBufferSourceNode | null = null;
  let playing = false;
  let startedAtCtxTime = 0;
  let resumeOffsetS = 0;
  let rafId: number | null = null;
  let endingByEnded = false;

  function detach() {
    if (!source) return;
    try {
      graph.setSource(null);
      source.disconnect();
      source.onended = null;
    } catch {
      /* noop */
    }
    source = null;
  }

  function tickPosition() {
    if (!playing || !graph.ctx) return;
    const elapsed = graph.ctx.currentTime - startedAtCtxTime + resumeOffsetS;
    const clamped = Math.max(0, Math.min(elapsed, audioBuffer.duration));
    events.onPositionMs(clamped * 1000);
    rafId = requestAnimationFrame(tickPosition);
  }

  async function play() {
    if (playing) return;
    if (resumeOffsetS >= audioBuffer.duration) resumeOffsetS = 0;
    if (graph.ctx.state === 'suspended') await graph.ctx.resume();

    const node = graph.ctx.createBufferSource();
    node.buffer = audioBuffer;
    node.onended = () => {
      // Fires both for natural end and for stop() during pause/seek. Distinguish.
      if (endingByEnded) {
        endingByEnded = false;
        return;
      }
      if (!playing) return;
      playing = false;
      detach();
      resumeOffsetS = 0;
      if (rafId != null) cancelAnimationFrame(rafId);
      rafId = null;
      events.onPositionMs(0);
      events.onEnded();
    };
    graph.setSource(node);
    source = node;
    startedAtCtxTime = graph.ctx.currentTime;
    node.start(0, resumeOffsetS);
    playing = true;
    rafId = requestAnimationFrame(tickPosition);
  }

  function pause() {
    if (!playing || !source) return;
    const elapsed = graph.ctx.currentTime - startedAtCtxTime + resumeOffsetS;
    resumeOffsetS = Math.max(0, Math.min(elapsed, audioBuffer.duration));
    endingByEnded = true;
    try {
      source.stop();
    } catch {
      /* already stopped */
    }
    detach();
    playing = false;
    if (rafId != null) cancelAnimationFrame(rafId);
    rafId = null;
    events.onPositionMs(resumeOffsetS * 1000);
  }

  async function seek(positionMs: number) {
    const wasPlaying = playing;
    if (playing) pause();
    resumeOffsetS = Math.max(0, Math.min(positionMs / 1000, audioBuffer.duration));
    events.onPositionMs(resumeOffsetS * 1000);
    if (wasPlaying) await play();
  }

  return {
    durationMs: audioBuffer.duration * 1000,
    isPlaying: () => playing,
    positionMs: () => resumeOffsetS * 1000,
    play,
    pause,
    seek,
    dispose() {
      pause();
    },
  };
}