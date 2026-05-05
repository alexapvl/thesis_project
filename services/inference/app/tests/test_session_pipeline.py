from __future__ import annotations

import base64

from app.adapters.mock import MockBeatTracker, MockSkipBart
from app.api.schemas import (
    AudioChunk,
    BeatUpdate,
    InferenceStatus,
    LightingUpdate,
    SessionInit,
    SessionReady,
    SessionSeek,
)
from app.config.settings import settings
from app.pipeline.session_pipeline import SessionPipeline


def _init(session_id: str = "s1") -> SessionInit:
    return SessionInit(
        type="session.init",
        version=settings.protocol_version,
        sessionId=session_id,
        timestampMs=0.0,
        sequence=1,
        sourceMode="file",
        chunkSize=2048,
        sampleRate=48000,
        protocolVersion=settings.protocol_version,
        fileMetadata=None,
    )


def _chunk(sequence: int, session_id: str = "s1") -> AudioChunk:
    pcm = base64.b64encode(b"\x00" * 16).decode("ascii")
    return AudioChunk(
        type="audio.chunk",
        version=settings.protocol_version,
        sessionId=session_id,
        timestampMs=float(sequence),
        sequence=sequence,
        startOffsetMs=None,
        playbackPositionMs=float(sequence) * 10.0,
        channels=1,
        sampleRate=48000,
        pcm=pcm,
    )


def make_pipeline() -> SessionPipeline:
    return SessionPipeline(MockBeatTracker(), MockSkipBart())


def test_session_init_emits_ready_and_idle_status() -> None:
    pipeline = make_pipeline()
    out = pipeline.on_session_init(_init())
    assert any(isinstance(e, SessionReady) for e in out)
    assert any(isinstance(e, InferenceStatus) and e.state == "idle" for e in out)


def test_audio_chunk_emits_lighting_and_periodic_beats() -> None:
    pipeline = make_pipeline()
    pipeline.on_session_init(_init())
    lighting = 0
    beats = 0
    for seq in range(1, 33):
        for env in pipeline.on_audio_chunk(_chunk(seq)):
            if isinstance(env, LightingUpdate):
                lighting += 1
            elif isinstance(env, BeatUpdate):
                beats += 1
    assert lighting == 32
    # MockBeatTracker emits a beat every 16 chunks.
    assert beats >= 2


def test_seek_reset_emits_idle_status_and_drops_buffer() -> None:
    pipeline = make_pipeline()
    pipeline.on_session_init(_init())
    for seq in range(1, 5):
        pipeline.on_audio_chunk(_chunk(seq))
    state_before = pipeline.state
    assert state_before is not None and state_before.chunks_received == 4

    out = pipeline.on_seek(
        SessionSeek(
            type="session.seek",
            version=settings.protocol_version,
            sessionId="s1",
            timestampMs=0.0,
            sequence=99,
            newPositionMs=12345.0,
            resetInference=True,
            sourceMode="file",
        )
    )
    assert any(isinstance(e, InferenceStatus) and e.state == "idle" for e in out)
    assert pipeline.state is not None
    assert pipeline.state.chunks_received == 0
    assert pipeline.state.last_playback_position_ms == 12345.0
    assert pipeline.state.seek_count == 1


def test_chunks_before_init_are_ignored() -> None:
    pipeline = make_pipeline()
    out = pipeline.on_audio_chunk(_chunk(1))
    assert out == []
