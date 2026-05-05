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
    session_id: str, sequence: int, beat_time_ms: float, confidence: float | None
) -> BeatUpdate:
    return BeatUpdate(
        version=settings.protocol_version,
        sessionId=session_id,
        timestampMs=now_ms(),
        sequence=sequence,
        beatTimeMs=beat_time_ms,
        confidence=confidence,
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


def lighting_update(
    session_id: str,
    sequence: int,
    *,
    hue: float,
    value: float,
    intensity: float | None = None,
    beat_pulse: float | None = None,
    confidence: float | None = None,
) -> LightingUpdate:
    return LightingUpdate(
        version=settings.protocol_version,
        sessionId=session_id,
        timestampMs=now_ms(),
        sequence=sequence,
        hue=hue,
        value=value,
        beatPulse=beat_pulse,
        intensity=intensity,
        confidence=confidence,
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
