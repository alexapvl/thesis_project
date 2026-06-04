from __future__ import annotations

from typing import Annotated, Literal, Union

from pydantic import BaseModel, Field


class Envelope(BaseModel):
    type: str
    version: str
    sessionId: str
    timestampMs: float
    sequence: int


# ── Upstream ──────────────────────────────────────────────────────────────────


class FileMetadata(BaseModel):
    fileName: str
    durationMs: float | None = None


class SessionInit(Envelope):
    type: Literal["session.init"]
    sourceMode: Literal["file", "microphone"]
    chunkSize: int
    sampleRate: int
    fileMetadata: FileMetadata | None = None
    protocolVersion: str


class AudioChunk(Envelope):
    type: Literal["audio.chunk"]
    startOffsetMs: float | None = None
    playbackPositionMs: float | None = None
    channels: Literal[1]
    sampleRate: Literal[48000]
    pcm: str  # base64 Float32 PCM


class SessionSeek(Envelope):
    type: Literal["session.seek"]
    newPositionMs: float
    resetInference: bool
    sourceMode: Literal["file", "microphone"]


class SessionStop(Envelope):
    type: Literal["session.stop"]


class ClientPing(Envelope):
    type: Literal["client.ping"]


class BenchStart(Envelope):
    type: Literal["bench.start"]
    runId: str
    configLabel: str


class BenchStop(Envelope):
    type: Literal["bench.stop"]
    runId: str


UpstreamMessage = Annotated[
    Union[SessionInit, AudioChunk, SessionSeek, SessionStop, ClientPing, BenchStart, BenchStop],
    Field(discriminator="type"),
]


# ── Downstream ────────────────────────────────────────────────────────────────


class SessionReady(Envelope):
    type: Literal["session.ready"] = "session.ready"
    protocolVersion: str


class BeatUpdate(Envelope):
    type: Literal["beat.update"] = "beat.update"
    beatTimeMs: float
    confidence: float | None = None
    isDownbeat: bool = False
    synthetic: bool = False
    originChunkTimestampMs: float | None = None
    serverProcessingMs: float | None = None


class TempoUpdate(Envelope):
    type: Literal["tempo.update"] = "tempo.update"
    bpm: float
    confidence: float | None = None


class LightingUpdate(Envelope):
    type: Literal["lighting.update"] = "lighting.update"
    # Bounds mirror the zod schema in packages/protocol/src/messages.ts. If
    # an adapter produces an out-of-range value the pydantic validator
    # raises here rather than letting it slip onto the wire — without this
    # the browser's zod check would reject every subsequent frame.
    hue: float = Field(ge=0, le=360)
    value: float = Field(ge=0, le=1)
    beatPulse: float | None = Field(default=None, ge=0, le=1)
    intensity: float | None = Field(default=None, ge=0, le=1)
    confidence: float | None = Field(default=None, ge=0, le=1)
    originChunkTimestampMs: float | None = None
    serverProcessingMs: float | None = None


class StageSummary(BaseModel):
    count: int
    n: int
    min_ms: float
    p50_ms: float
    p95_ms: float
    max_ms: float
    avg_ms: float


class MetricsReport(Envelope):
    type: Literal["metrics.report"] = "metrics.report"
    runId: str
    stages: dict[str, StageSummary]
    stageSamples: dict[str, list[float]]
    chunksReceived: int
    device: str
    beatTrackerKind: str
    skipBartKind: str


class InferenceStatus(Envelope):
    type: Literal["inference.status"] = "inference.status"
    state: Literal["idle", "warming", "running", "stalled", "error"]
    detail: str | None = None


class ServerError(Envelope):
    type: Literal["server.error"] = "server.error"
    code: str
    message: str


class ServerPong(Envelope):
    type: Literal["server.pong"] = "server.pong"
