"""Factory functions for downstream protocol envelopes.

Centralised so pipeline and api code never construct envelopes by hand;
mistakes there leak straight to the wire.
"""

from __future__ import annotations

import time

from app.api.schemas import (
    BeatUpdate,
    InferenceStatus,
    LightingUpdate,
    ServerError,
    ServerPong,
    SessionReady,
    TempoUpdate,
)
from app.config.settings import settings


def now_ms() -> float:
    return time.time() * 1000.0


def session_ready(session_id: str, sequence: int) -> SessionReady:
    return SessionReady(
        version=settings.protocol_version,
        sessionId=session_id,
        timestampMs=now_ms(),
        sequence=sequence,
        protocolVersion=settings.protocol_version,
    )


def beat_update(
    session_id: str,
    sequence: int,
    beat_time_ms: float,
    confidence: float | None,
    is_downbeat: bool = False,
    synthetic: bool = False,
    *,
    origin_chunk_timestamp_ms: float | None = None,
    server_processing_ms: float | None = None,
) -> BeatUpdate:
    return BeatUpdate(
        version=settings.protocol_version,
        sessionId=session_id,
        timestampMs=now_ms(),
        sequence=sequence,
        beatTimeMs=beat_time_ms,
        confidence=confidence,
        isDownbeat=is_downbeat,
        synthetic=synthetic,
        originChunkTimestampMs=origin_chunk_timestamp_ms,
        serverProcessingMs=server_processing_ms,
    )


def tempo_update(
    session_id: str, sequence: int, bpm: float, confidence: float | None
) -> TempoUpdate:
    return TempoUpdate(
        version=settings.protocol_version,
        sessionId=session_id,
        timestampMs=now_ms(),
        sequence=sequence,
        bpm=bpm,
        confidence=confidence,
    )


def _clamp01(v: float) -> float:
    if v < 0:
        return 0.0
    if v > 1:
        return 1.0
    return v


def _clamp01_opt(v: float | None) -> float | None:
    return None if v is None else _clamp01(v)


def _wrap_hue(h: float) -> float:
    # Adapters occasionally emit slightly out-of-range hues (e.g. 360.0
    # exactly, or a negative value from a circular subtraction). Wrap into
    # [0, 360) so the schema validator never has to reject them.
    return h % 360.0


def lighting_update(
    session_id: str,
    sequence: int,
    *,
    hue: float,
    value: float,
    intensity: float | None = None,
    beat_pulse: float | None = None,
    confidence: float | None = None,
    origin_chunk_timestamp_ms: float | None = None,
    server_processing_ms: float | None = None,
) -> LightingUpdate:
    return LightingUpdate(
        version=settings.protocol_version,
        sessionId=session_id,
        timestampMs=now_ms(),
        sequence=sequence,
        hue=_wrap_hue(hue),
        value=_clamp01(value),
        beatPulse=_clamp01_opt(beat_pulse),
        intensity=_clamp01_opt(intensity),
        confidence=_clamp01_opt(confidence),
        originChunkTimestampMs=origin_chunk_timestamp_ms,
        serverProcessingMs=server_processing_ms,
    )


def inference_status(
    session_id: str,
    sequence: int,
    state: str,
    detail: str | None = None,
) -> InferenceStatus:
    return InferenceStatus(
        version=settings.protocol_version,
        sessionId=session_id,
        timestampMs=now_ms(),
        sequence=sequence,
        state=state,  # type: ignore[arg-type]
        detail=detail,
    )


def server_error(session_id: str, sequence: int, code: str, message: str) -> ServerError:
    return ServerError(
        version=settings.protocol_version,
        sessionId=session_id,
        timestampMs=now_ms(),
        sequence=sequence,
        code=code,
        message=message,
    )


def server_pong(session_id: str, sequence: int) -> ServerPong:
    return ServerPong(
        version=settings.protocol_version,
        sessionId=session_id,
        timestampMs=now_ms(),
        sequence=sequence,
    )
