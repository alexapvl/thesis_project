from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class AudioChunk:
    session_id: str
    sequence: int
    timestamp_ms: float
    playback_position_ms: float | None
    sample_rate: int
    channels: int
    pcm: bytes  # raw Float32 little-endian


@dataclass(frozen=True)
class SessionConfig:
    session_id: str
    source_mode: str  # "file" | "microphone"
    chunk_size: int
    sample_rate: int


@dataclass(frozen=True)
class SeekEvent:
    session_id: str
    new_position_ms: float
    reset_inference: bool


@dataclass(frozen=True)
class BeatEvent:
    session_id: str
    beat_time_ms: float
    confidence: float | None
    is_downbeat: bool = False


@dataclass(frozen=True)
class LightingPrediction:
    session_id: str
    hue: float
    value: float
    intensity: float | None
    beat_pulse: float | None
    confidence: float | None
    # Absolute frame timestamp in milliseconds (transport-time). Optional so
    # the dataclass remains compatible with synthetic / unit-test predictions.
    frame_time_ms: float | None = None
