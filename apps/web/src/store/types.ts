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
  lastUpdateTimeMs: number | null;
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