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


UpstreamMessage = Annotated[
    Union[SessionInit, AudioChunk, SessionSeek, SessionStop, ClientPing],
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
