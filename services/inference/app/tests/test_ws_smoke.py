"""End-to-end smoke test for the core runtime path.

Drives the FastAPI app through its real WebSocket route using
`TestClient.websocket_connect`. Adapters resolve through the registry as
they would in production; we force `STL_USE_REAL_BEAT_TRACKER=false` and
leave `STL_USE_REAL_SKIP_BART` at its default of `false`, so this exercises
the wiring (validation → dispatch → pipeline → envelope serialization)
without dragging in BeatNet or Skip-BART.

If this test goes red, the runtime path is broken end-to-end — the unit
tests can stay green and the system still won't talk to a real client.
"""

from __future__ import annotations

import base64

import pytest
from fastapi.testclient import TestClient

from app.api.ws import app
from app.config.settings import settings


def _envelope(mtype: str, session_id: str, sequence: int, **fields) -> dict:
    base = {
        "type": mtype,
        "version": settings.protocol_version,
        "sessionId": session_id,
        "timestampMs": 0.0,
        "sequence": sequence,
    }
    base.update(fields)
    return base


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    # Force mock adapters so the smoke test runs without ML deps installed.
    monkeypatch.setattr(settings, "use_real_beat_tracker", False)
    monkeypatch.setattr(settings, "use_real_skip_bart", False)
    monkeypatch.setattr(settings, "require_real_models", False)
    return TestClient(app)


def test_full_session_emits_ready_lighting_and_beat(client: TestClient) -> None:
    sid = "smoke-session"
    pcm = base64.b64encode(b"\x00" * 16).decode("ascii")
    received: list[dict] = []
    with client.websocket_connect("/ws") as ws:
        ws.send_json(
            _envelope(
                "session.init",
                sid,
                1,
                sourceMode="file",
                chunkSize=2048,
                sampleRate=48000,
                protocolVersion=settings.protocol_version,
                fileMetadata=None,
            )
        )
        # Drain session.ready + initial inference.status
        for _ in range(2):
            received.append(ws.receive_json())

        for seq in range(1, 33):
            ws.send_json(
                _envelope(
                    "audio.chunk",
                    sid,
                    seq,
                    timestampMs=float(seq),
                    startOffsetMs=None,
                    playbackPositionMs=float(seq) * 10.0,
                    channels=1,
                    sampleRate=48000,
                    pcm=pcm,
                )
            )

        # Mock emits one lighting per chunk + a beat every 16 chunks. Drain
        # everything currently queued.
        deadline_msgs = 80
        while len(received) < deadline_msgs:
            try:
                received.append(ws.receive_json())
            except Exception:
                break
            # Quick exit: enough lighting + at least one beat seen
            kinds = [m["type"] for m in received]
            if kinds.count("lighting.update") >= 32 and "beat.update" in kinds:
                break

        ws.send_json(_envelope("session.stop", sid, 99))

    kinds = [m["type"] for m in received]
    assert "session.ready" in kinds
    assert kinds.count("lighting.update") >= 32
    assert "beat.update" in kinds


def test_invalid_message_emits_server_error_and_keeps_socket_open(
    client: TestClient,
) -> None:
    with client.websocket_connect("/ws") as ws:
        ws.send_json({"type": "session.init"})  # missing all required fields
        msg = ws.receive_json()
        assert msg["type"] == "server.error"
        assert msg["code"] == "protocol.invalid"

        # Socket still alive: a follow-up ping should round-trip.
        ws.send_json(_envelope("client.ping", "ping-sid", 1))
        pong = ws.receive_json()
        assert pong["type"] == "server.pong"


def test_metrics_endpoint_reflects_pipeline_activity(client: TestClient) -> None:
    # Reset the process-wide metrics registry so the assertion below
    # measures *this* test's pipeline activity, not residue from earlier
    # tests in the same pytest run.
    from app.utils.profiling import metrics

    metrics.reset()

    sid = "metrics-session"
    pcm = base64.b64encode(b"\x00" * 16).decode("ascii")
    with client.websocket_connect("/ws") as ws:
        ws.send_json(
            _envelope(
                "session.init",
                sid,
                1,
                sourceMode="file",
                chunkSize=2048,
                sampleRate=48000,
                protocolVersion=settings.protocol_version,
                fileMetadata=None,
            )
        )
        ws.receive_json()
        ws.receive_json()
        for seq in range(1, 5):
            ws.send_json(
                _envelope(
                    "audio.chunk",
                    sid,
                    seq,
                    timestampMs=float(seq),
                    startOffsetMs=None,
                    playbackPositionMs=float(seq) * 10.0,
                    channels=1,
                    sampleRate=48000,
                    pcm=pcm,
                )
            )
            ws.receive_json()  # one lighting.update per chunk
        ws.send_json(_envelope("session.stop", sid, 99))

    payload = client.get("/metrics").json()
    assert "stages" in payload
    # All four wired stages must be present and report exactly the four
    # samples this test produced. Counting (not just presence) catches
    # both registry drift and accidental skips of a stage in the pipeline.
    expected = {"beat.ingest", "beat.drain", "skip.ingest", "skip.drain"}
    assert expected <= set(payload["stages"].keys())
    for stage in expected:
        assert payload["stages"][stage]["count"] == 4, payload["stages"][stage]
