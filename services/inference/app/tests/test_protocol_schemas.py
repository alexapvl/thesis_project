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
