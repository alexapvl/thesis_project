import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { emptyScene, type FixtureInstance, type SceneDocument } from '@stl/fixtures';
import {
  applyAction,
  isHistoricAction,
  type SceneAction,
} from '@/scene/document/reducer';
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
  TransportState,
} from './types';

const MAX_LOG_ENTRIES = 200;
const MAX_HISTORY = 100;

type HistoryState = {
  past: SceneDocument[];
  future: SceneDocument[];
};

type State = {
  transport: TransportState;
  audio: AudioState;
  playback: PlaybackState;
  inference: InferenceState;
  lighting: LightingRuntimeState;
  scene: { doc: SceneDocument };
  history: HistoryState;
  editor: EditorState;
  persistence: PersistenceState;
  debug: DebugState;
};

type Actions = {
  transportSet: (status: ConnectionStatus, error?: string | null) => void;
  transportSetLatency: (latencyMs: number | null) => void;

  audioSetGraphReady: (ready: boolean, contextSampleRate: number | null) => void;
  audioBumpChunkCount: () => void;
  audioResetChunkCount: () => void;

  playbackSetMode: (mode: PlaybackMode) => void;
  playbackSetFile: (fileName: string, durationMs: number | null) => void;
  playbackSetPlaying: (isPlaying: boolean) => void;
  playbackSetPosition: (positionMs: number) => void;

  inferenceSet: (state: InferenceRunState, detail?: string | null) => void;

  lightingApply: (patch: Partial<LightingRuntimeState>) => void;
  lightingReset: () => void;

  sceneDispatch: (action: SceneAction) => void;
  sceneReplace: (doc: SceneDocument) => void;
  sceneUndo: () => void;
  sceneRedo: () => void;
  sceneCanUndo: () => boolean;
  sceneCanRedo: () => boolean;
  newFixtureId: () => string;
  getFixtureById: (id: string) => FixtureInstance | undefined;

  editorSetPlacement: (typeId: string | null) => void;
  editorSetGridSnap: (enabled: boolean) => void;
  editorSetGridSize: (size: number) => void;

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
  lastDownbeatTimeMs: null,
  lastUpdateTimeMs: null,
  beatsReceived: 0,
  beatsReceivedReal: 0,
  beatsReceivedSynthetic: 0,
  beatEventTimestamps: [],
  lightingFramesReceived: 0,
};

function pushHistory(history: HistoryState, prev: SceneDocument): HistoryState {
  const past = [...history.past, prev];
  if (past.length > MAX_HISTORY) past.splice(0, past.length - MAX_HISTORY);
  return { past, future: [] };
}

export const useStore = create<State & Actions>()(
  subscribeWithSelector((set, get) => ({
    transport: { status: 'disconnected', latencyMs: null, lastError: null },
    audio: { contextSampleRate: null, graphReady: false, chunksEmitted: 0, lastChunkAtMs: null },
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
    history: { past: [], future: [] },
    editor: { placementMode: 'idle', pendingFixtureTypeId: null, gridSnap: true, gridSize: 0.5 },
    persistence: { lastAutosaveAt: null, lastImportError: null },
    debug: { log: [] },

    transportSet: (status, error = null) =>
      set((s) => ({ transport: { ...s.transport, status, lastError: error ?? s.transport.lastError } })),
    transportSetLatency: (latencyMs) =>
      set((s) => ({ transport: { ...s.transport, latencyMs } })),

    audioSetGraphReady: (graphReady, contextSampleRate) =>
      set((s) => ({ audio: { ...s.audio, graphReady, contextSampleRate } })),
    audioBumpChunkCount: () =>
      set((s) => ({
        audio: {
          ...s.audio,
          chunksEmitted: s.audio.chunksEmitted + 1,
          lastChunkAtMs: Date.now(),
        },
      })),
    audioResetChunkCount: () =>
      set((s) => ({ audio: { ...s.audio, chunksEmitted: 0, lastChunkAtMs: null } })),

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

    sceneDispatch: (action) =>
      set((s) => {
        const prev = s.scene.doc;
        const next = applyAction(prev, action);
        if (next === prev) return {};
        const history = isHistoricAction(action) ? pushHistory(s.history, prev) : s.history;
        return { scene: { doc: next }, history };
      }),

    sceneReplace: (doc) =>
      set((s) => ({
        scene: { doc },
        history: pushHistory(s.history, s.scene.doc),
      })),

    sceneUndo: () =>
      set((s) => {
        const last = s.history.past.at(-1);
        if (!last) return {};
        return {
          scene: { doc: last },
          history: {
            past: s.history.past.slice(0, -1),
            future: [s.scene.doc, ...s.history.future],
          },
        };
      }),

    sceneRedo: () =>
      set((s) => {
        const next = s.history.future[0];
        if (!next) return {};
        return {
          scene: { doc: next },
          history: {
            past: [...s.history.past, s.scene.doc],
            future: s.history.future.slice(1),
          },
        };
      }),

    sceneCanUndo: () => get().history.past.length > 0,
    sceneCanRedo: () => get().history.future.length > 0,

    newFixtureId: () => crypto.randomUUID(),
    getFixtureById: (id) => get().scene.doc.fixtures.find((f) => f.id === id),

    editorSetPlacement: (typeId) =>
      set((s) => ({
        editor: {
          ...s.editor,
          placementMode: typeId ? 'click-to-place' : 'idle',
          pendingFixtureTypeId: typeId,
        },
      })),
    editorSetGridSnap: (enabled) =>
      set((s) => ({ editor: { ...s.editor, gridSnap: enabled } })),
    editorSetGridSize: (gridSize) => set((s) => ({ editor: { ...s.editor, gridSize } })),

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

if (import.meta.env.DEV && typeof window !== 'undefined') {
  // Dev convenience: poke the store from the DevTools console as
  // `useStore.getState()`. Stripped from production bundles by Vite.
  (window as unknown as { useStore: typeof useStore }).useStore = useStore;
}