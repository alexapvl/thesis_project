import { ensureAudioGraph } from './graph';

export type MicrophoneSource = {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  isActive: () => boolean;
};

/**
 * Captures the user's microphone, connects it through the shared graph as
 * the current source. The downstream worklet emits canonical mono 48 kHz
 * chunks identical to file mode — that's the whole point.
 *
 * Browser sample rate may not equal 48 kHz; the worklet handles resampling.
 */
export async function createMicrophoneSource(): Promise<MicrophoneSource> {
  const graph = await ensureAudioGraph();
  let stream: MediaStream | null = null;
  let node: MediaStreamAudioSourceNode | null = null;
  let active = false;

  return {
    async start() {
      if (active) return;
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      node = graph.ctx.createMediaStreamSource(stream);
      graph.setSource(node);
      // Mute speakers in mic mode — laptop mic + speakers loop back through
      // the air and create runaway feedback when input is loud enough.
      graph.setMonitor(false);
      active = true;
    },
    async stop() {
      if (!active) return;
      try {
        graph.setSource(null);
        node?.disconnect();
      } catch {
        /* noop */
      }
      stream?.getTracks().forEach((t) => t.stop());
      node = null;
      stream = null;
      active = false;
    },
    isActive: () => active,
  };
}