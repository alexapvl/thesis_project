import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { emptyScene, type SceneDocument } from '@stl/fixtures';
import type {
  AudioState,
  ConnectionStatus,
  DebugLogEntry,
  DebugState,
  EditorState,
  InferenceRunState,
  InferenceState,
  LightingRuntimeState,
  PersistenceState,
  PlaybackMode,
  PlaybackState,
  SceneDocumentState,
  TransportState,
} from './types';

const MAX_LOG_ENTRIES = 200;

type State = {
  transport: TransportState;
  audio: AudioState;
  playback: PlaybackState;
  inference: InferenceState;
  lighting: LightingRuntimeState;
  scene: SceneDocumentState;
  editor: EditorState;
  persistence: PersistenceState;
  debug: DebugState;
};

type Actions = {
  transportSet: (status: ConnectionStatus, error?: string | null) => void;
  transportSetLatency: (latencyMs: number | null) => void;

  audioSetGraphReady: (ready: boolean, contextSampleRate: number | null) => void;

  playbackSetMode: (mode: PlaybackMode) => void;
  playbackSetFile: (fileName: string, durationMs: number | null) => void;
  playbackSetPlaying: (isPlaying: boolean) => void;
  playbackSetPosition: (positionMs: number) => void;

  inferenceSet: (state: InferenceRunState, detail?: string | null) => void;

  lightingApply: (patch: Partial<LightingRuntimeState>) => void;
  lightingReset: () => void;

  sceneReplace: (doc: SceneDocument) => void;

  editorSetPlacement: (typeId: string | null) => void;
  editorSetGridSnap: (enabled: boolean) => void;

  persistenceMarkAutosave: () => void;
  persistenceSetImportError: (msg: string | null) => void;

  debugLog: (level: DebugLogEntry['level'], message: string) => void;
  debugClear: () => void;
};

const initialLighting: LightingRuntimeState = {
  hue: 0,
  value: 0,
  bpm: null,
  beatPhase: null,
  confidence: null,
  lastBeatTimeMs: null,
  lastUpdateTimeMs: null,
};

export const useStore = create<State & Actions>()(
  subscribeWithSelector((set) => ({
    transport: { status: 'disconnected', latencyMs: null, lastError: null },
    audio: { contextSampleRate: null, graphReady: false },
    playback: {
      mode: 'file',
      isPlaying: false,
      positionMs: 0,
      durationMs: null,
      sampleRate: 48000,
      fileName: null,
    },
    inference: { state: 'idle', detail: null },
    lighting: initialLighting,
    scene: { doc: emptyScene(crypto.randomUUID()) },
    editor: { placementMode: 'idle', pendingFixtureTypeId: null, gridSnap: true, gridSize: 0.5 },
    persistence: { lastAutosaveAt: null, lastImportError: null },
    debug: { log: [] },

    transportSet: (status, error = null) =>
      set((s) => ({ transport: { ...s.transport, status, lastError: error ?? s.transport.lastError } })),
    transportSetLatency: (latencyMs) =>
      set((s) => ({ transport: { ...s.transport, latencyMs } })),

    audioSetGraphReady: (graphReady, contextSampleRate) =>
      set(() => ({ audio: { graphReady, contextSampleRate } })),

    playbackSetMode: (mode) => set((s) => ({ playback: { ...s.playback, mode } })),
    playbackSetFile: (fileName, durationMs) =>
      set((s) => ({ playback: { ...s.playback, fileName, durationMs, positionMs: 0 } })),
    playbackSetPlaying: (isPlaying) =>
      set((s) => ({ playback: { ...s.playback, isPlaying } })),
    playbackSetPosition: (positionMs) =>
      set((s) => ({ playback: { ...s.playback, positionMs } })),

    inferenceSet: (state, detail = null) => set(() => ({ inference: { state, detail } })),

    lightingApply: (patch) => set((s) => ({ lighting: { ...s.lighting, ...patch } })),
    lightingReset: () => set(() => ({ lighting: initialLighting })),

    sceneReplace: (doc) => set(() => ({ scene: { doc } })),

    editorSetPlacement: (typeId) =>
      set(() => ({
        editor: {
          placementMode: typeId ? 'click-to-place' : 'idle',
          pendingFixtureTypeId: typeId,
          gridSnap: true,
          gridSize: 0.5,
        },
      })),
    editorSetGridSnap: (enabled) =>
      set((s) => ({ editor: { ...s.editor, gridSnap: enabled } })),

    persistenceMarkAutosave: () =>
      set((s) => ({ persistence: { ...s.persistence, lastAutosaveAt: Date.now() } })),
    persistenceSetImportError: (msg) =>
      set((s) => ({ persistence: { ...s.persistence, lastImportError: msg } })),

    debugLog: (level, message) =>
      set((s) => {
        const next = [...s.debug.log, { ts: Date.now(), level, message }];
        if (next.length > MAX_LOG_ENTRIES) next.splice(0, next.length - MAX_LOG_ENTRIES);
        return { debug: { log: next } };
      }),
    debugClear: () => set(() => ({ debug: { log: [] } })),
  })),
);

export type { State, Actions };
export type StoreState = State & Actions;