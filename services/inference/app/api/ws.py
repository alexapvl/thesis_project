from __future__ import annotations

import logging
import time
from typing import Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from pydantic import TypeAdapter, ValidationError

from app.api.schemas import (
    InferenceStatus,
    LightingUpdate,
    SessionReady,
    ServerError,
    ServerPong,
    UpstreamMessage,
)
from app.config.settings import settings

log = logging.getLogger("stl.ws")
logging.basicConfig(level=settings.log_level)

app = FastAPI(title="sound-to-light inference", version="0.0.0")

_upstream_adapter: TypeAdapter[UpstreamMessage] = TypeAdapter(UpstreamMessage)


@app.get("/healthz")
async def healthz() -> dict[str, Any]:
    return {
        "ok": True,
        "protocolVersion": settings.protocol_version,
        "sampleRate": settings.canonical_sample_rate,
    }


@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket) -> None:
    await ws.accept()
    session_id: str | None = None
    seq = 0

    def now_ms() -> float:
        return time.time() * 1000.0

    def next_seq() -> int:
        nonlocal seq
        seq += 1
        return seq

    async def send(payload: dict[str, Any]) -> None:
        await ws.send_json(payload)

    try:
        while True:
            raw = await ws.receive_json()
            try:
                msg = _upstream_adapter.validate_python(raw)
            except ValidationError as e:
                err = ServerError(
                    version=settings.protocol_version,
                    sessionId=session_id or "",
                    timestampMs=now_ms(),
                    sequence=next_seq(),
                    code="protocol.invalid",
                    message=str(e),
                )
                await send(err.model_dump())
                continue

            mtype = msg.type

            if mtype == "session.init":
                client_major = msg.protocolVersion.split(".")[0]
                server_major = settings.protocol_version.split(".")[0]
                if client_major != server_major:
                    err = ServerError(
                        version=settings.protocol_version,
                        sessionId=msg.sessionId,
                        timestampMs=now_ms(),
                        sequence=next_seq(),
                        code="protocol.versionMismatch",
                        message=(
                            f"client {msg.protocolVersion} incompatible with "
                            f"server {settings.protocol_version}"
                        ),
                    )
                    await send(err.model_dump())
                    await ws.close(code=1008)
                    return

                session_id = msg.sessionId
                log.info("session.init id=%s mode=%s", session_id, msg.sourceMode)
                ready = SessionReady(
                    version=settings.protocol_version,
                    sessionId=session_id,
                    timestampMs=now_ms(),
                    sequence=next_seq(),
                    protocolVersion=settings.protocol_version,
                )
                await send(ready.model_dump())
                idle = InferenceStatus(
                    version=settings.protocol_version,
                    sessionId=session_id,
                    timestampMs=now_ms(),
                    sequence=next_seq(),
                    state="idle",
                    detail="adapters not yet wired",
                )
                await send(idle.model_dump())

            elif mtype == "audio.chunk":
                # TODO(pipeline): hand off to session pipeline / adapters.
                # Stub: emit a synthetic lighting frame so the frontend has something to draw.
                if session_id is None:
                    continue
                light = LightingUpdate(
                    version=settings.protocol_version,
                    sessionId=session_id,
                    timestampMs=now_ms(),
                    sequence=next_seq(),
                    hue=(msg.sequence * 7) % 360,
                    value=0.6,
                    beatPulse=None,
                    intensity=0.6,
                    confidence=None,
                )
                await send(light.model_dump())

            elif mtype == "session.seek":
                log.info(
                    "session.seek id=%s newMs=%.1f reset=%s",
                    session_id,
                    msg.newPositionMs,
                    msg.resetInference,
                )
                # TODO(pipeline): reset inference context for this session.

            elif mtype == "session.stop":
                log.info("session.stop id=%s", session_id)
                break

            elif mtype == "client.ping":
                pong = ServerPong(
                    version=settings.protocol_version,
                    sessionId=session_id or msg.sessionId,
                    timestampMs=now_ms(),
                    sequence=next_seq(),
                )
                await send(pong.model_dump())

    except WebSocketDisconnect:
        log.info("client disconnected id=%s", session_id)
