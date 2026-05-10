import type { SceneDocument } from '@stl/fixtures';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export type TransportState = {
  status: ConnectionStatus;
  latencyMs: number | null;
  lastError: string | null;
};

export type AudioState = {
  contextSampleRate: number | null;
  graphReady: boolean;
  chunksEmitted: number;
  lastChunkAtMs: number | null;
};

export type PlaybackMode = 'file' | 'microphone';

export type PlaybackState = {
  mode: PlaybackMode;
  isPlaying: boolean;
  positionMs: number;
  durationMs: number | null;
  sampleRate: number;
  fileName: string | null;
};

export type InferenceRunState = 'idle' | 'warming' | 'running' | 'stalled' | 'error';

export type InferenceState = {
  state: InferenceRunState;
  detail: string | null;
};

export type LightingRuntimeState = {
  hue: number;
  value: number;
  bpm: number | null;
  beatPhase: number | null;
  confidence: number | null;
  lastBeatTimeMs: number | null;
  // Most recent downbeat timestamp from BeatNet. Distinct from lastBeatTimeMs
  // because every downbeat is also a beat — fixtures that want to accent the
  // "1" of each bar (bigger sweep, intensity flash) read this separately.
  lastDownbeatTimeMs: number | null;
  lastUpdateTimeMs: number | null;
  // Counters and rolling rates for the debug panel — let the user see at
  // a glance whether beats are actually arriving from the server.
  beatsReceived: number;
  beatsReceivedReal: number;
  beatsReceivedSynthetic: number;
  beatEventTimestamps: number[]; // wall-clock receive times, last ~10 s
  lightingFramesReceived: number;
};

export type EditorState = {
  placementMode: 'idle' | 'click-to-place';
  pendingFixtureTypeId: string | null;
  gridSnap: boolean;
  gridSize: number;
};

export type PersistenceState = {
  lastAutosaveAt: number | null;
  lastImportError: string | null;
};

export type DebugLogEntry = {
  ts: number;
  level: 'info' | 'warn' | 'error';
  message: string;
};

export type DebugState = {
  log: DebugLogEntry[];
};

export type SceneDocumentState = {
  doc: SceneDocument;
};