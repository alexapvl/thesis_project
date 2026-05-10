import { ensureAudioContext } from './context';
import workletUrl from './chunk-worklet.js?url';
import type { WorkletChunkMessage } from './types';

/**
 * The shared audio graph. There is exactly one of each node — file playback
 * and microphone capture both rewire their source into `inputBus`, and the
 * downstream analyser + worklet feed the same chunk emitter regardless of
 * the source. This is what gives us "file and mic converge before transport".
 *
 *   currentSource ─→ inputBus ─┬─→ analyser ─→ monitorGain ─→ destination
 *                              └─→ worklet ─→ (silent sink)
 *
 * `monitorGain` gates speaker output without affecting the analyser/worklet
 * paths. File mode turns it on; mic mode turns it off so the mic doesn't
 * loop back through the speakers and cause feedback.
 */
export type AudioGraph = {
  ctx: AudioContext;
  inputBus: GainNode;
  analyser: AnalyserNode;
  monitorGain: GainNode;
  worklet: AudioWorkletNode;
  destination: AudioDestinationNode;
  /** Replaces the connected source. Disconnects the previous one. */
  setSource: (node: AudioNode | null) => void;
  /** Toggle whether the source is audible through the speakers. */
  setMonitor: (enabled: boolean) => void;
  /** Subscribe to canonical mono 48 kHz chunks. Returns an unsubscribe. */
  onChunk: (cb: (msg: WorkletChunkMessage) => void) => () => void;
  /** Tear down all nodes. The AudioContext stays alive for re-use. */
  dispose: () => void;
};

let cached: Promise<AudioGraph> | null = null;
let workletRegistered = false;

export async function ensureAudioGraph(): Promise<AudioGraph> {
  if (cached) return cached;
  cached = build();
  return cached;
}

async function build(): Promise<AudioGraph> {
  const ctx = await ensureAudioContext();
  if (!workletRegistered) {
    await ctx.audioWorklet.addModule(workletUrl);
    workletRegistered = true;
  }

  const inputBus = ctx.createGain();
  inputBus.gain.value = 1.0;

  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;

  // Default ON; mic source flips it off to avoid feedback loops on
  // built-in laptop speakers. File source explicitly turns it on so
  // switching mic → file restores monitoring.
  const monitorGain = ctx.createGain();
  monitorGain.gain.value = 1.0;

  const worklet = new AudioWorkletNode(ctx, 'chunk-processor', {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    channelCount: 1,
    channelCountMode: 'explicit',
  });
  // The worklet's output is unused, but Web Audio prunes nodes whose output
  // isn't connected anywhere — so route it through a silent gain into the
  // destination to keep the processor running.
  const sink = ctx.createGain();
  sink.gain.value = 0;
  worklet.connect(sink).connect(ctx.destination);

  inputBus.connect(analyser);
  analyser.connect(monitorGain);
  monitorGain.connect(ctx.destination);
  inputBus.connect(worklet);

  let currentSource: AudioNode | null = null;
  const listeners = new Set<(msg: WorkletChunkMessage) => void>();

  worklet.port.onmessage = (ev) => {
    const data = ev.data as WorkletChunkMessage | undefined;
    if (!data || data.type !== 'chunk') return;
    for (const cb of listeners) cb(data);
  };

  return {
    ctx,
    inputBus,
    analyser,
    monitorGain,
    worklet,
    destination: ctx.destination,
    setSource(node) {
      if (currentSource) {
        try {
          currentSource.disconnect(inputBus);
        } catch {
          /* already disconnected */
        }
      }
      currentSource = node;
      if (node) node.connect(inputBus);
    },
    setMonitor(enabled) {
      monitorGain.gain.value = enabled ? 1.0 : 0.0;
    },
    onChunk(cb) {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    dispose() {
      listeners.clear();
      try {
        worklet.port.onmessage = null;
        worklet.disconnect();
        analyser.disconnect();
        monitorGain.disconnect();
        inputBus.disconnect();
        sink.disconnect();
      } catch {
        /* noop */
      }
      cached = null;
    },
  };
}