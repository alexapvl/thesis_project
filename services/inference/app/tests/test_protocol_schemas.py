from __future__ import annotations

from pydantic import TypeAdapter

from app.api.schemas import UpstreamMessage


def test_session_init_roundtrips() -> None:
    adapter: TypeAdapter[UpstreamMessage] = TypeAdapter(UpstreamMessage)
    raw = {
        "type": "session.init",
        "version": "1.0.0",
        "sessionId": "s1",
        "timestampMs": 0.0,
        "sequence": 0,
        "sourceMode": "file",
        "chunkSize": 4800,
        "sampleRate": 48000,
        "protocolVersion": "1.0.0",
    }
    msg = adapter.validate_python(raw)
    assert msg.type == "session.init"


def test_audio_chunk_requires_canonical_format() -> None:
    adapter: TypeAdapter[UpstreamMessage] = TypeAdapter(UpstreamMessage)
    raw = {
        "type": "audio.chunk",
        "version": "1.0.0",
        "sessionId": "s1",
        "timestampMs": 1.0,
        "sequence": 1,
        "channels": 1,
        "sampleRate": 48000,
        "pcm": "",
    }
    msg = adapter.validate_python(raw)
    assert msg.type == "audio.chunk"


def test_bench_start_roundtrips() -> None:
    adapter: TypeAdapter[UpstreamMessage] = TypeAdapter(UpstreamMessage)
    raw = {
        "type": "bench.start",
        "version": "1.0.0",
        "sessionId": "s1",
        "timestampMs": 0.0,
        "sequence": 0,
        "runId": "run-1",
        "configLabel": "Mac-local-MPS",
    }
    msg = adapter.validate_python(raw)
    assert msg.type == "bench.start"
    assert msg.runId == "run-1"


def test_beat_update_accepts_benchmark_fields() -> None:
    from app.api.schemas import BeatUpdate

    msg = BeatUpdate.model_validate(
        {
            "type": "beat.update",
            "version": "1.0.0",
            "sessionId": "s1",
            "timestampMs": 1.0,
            "sequence": 1,
            "beatTimeMs": 100.0,
            "originChunkTimestampMs": 50.0,
            "serverProcessingMs": 12.5,
        }
    )
    assert msg.originChunkTimestampMs == 50.0
    assert msg.serverProcessingMs == 12.5
