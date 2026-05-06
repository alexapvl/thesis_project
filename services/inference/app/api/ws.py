from __future__ import annotations

import logging
from typing import Any

from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, TypeAdapter, ValidationError

from app.api.schemas import UpstreamMessage
from app.config.settings import settings
from app.pipeline.event_builder import server_error, server_pong
from app.services.model_registry import resolve_adapters
from app.services.session_manager import session_manager
from app.services.startup_validation import issues_block_startup, validate_setup

log = logging.getLogger("stl.ws")
logging.basicConfig(level=settings.log_level)


@asynccontextmanager
async def lifespan(_: FastAPI):
    issues = validate_setup()
    for issue in issues:
        if issue.severity == "error":
            log.error("startup %s: %s", issue.code, issue.message)
        else:
            log.warning("startup %s: %s", issue.code, issue.message)
    if issues_block_startup(issues):
        raise RuntimeError(
            "model setup validation failed; "
            "set STL_REQUIRE_REAL_MODELS=false to run on mock adapters"
        )
    adapters = resolve_adapters()
    log.info(
        "adapters resolved: beat=%s skip-bart=%s",
        adapters.beat_tracker_kind,
        adapters.skip_bart_kind,
    )
    yield


app = FastAPI(title="sound-to-light inference", version="0.0.0", lifespan=lifespan)

_upstream_adapter: TypeAdapter[UpstreamMessage] = TypeAdapter(UpstreamMessage)


@app.get("/healthz")
async def healthz() -> dict[str, Any]:
    return {
        "ok": True,
        "protocolVersion": settings.protocol_version,
        "sampleRate": settings.canonical_sample_rate,
        "activeSessions": session_manager.active_count(),
    }


@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket) -> None:
    await ws.accept()
    session_id: str | None = None
    fallback_seq = 0

    def next_fallback_seq() -> int:
        nonlocal fallback_seq
        fallback_seq += 1
        return fallback_seq

    async def send(envelope: BaseModel) -> None:
        await ws.send_json(envelope.model_dump())

    try:
        while True:
            raw = await ws.receive_json()
            try:
                msg = _upstream_adapter.validate_python(raw)
            except ValidationError as e:
                err = server_error(
                    session_id or "",
                    next_fallback_seq(),
                    "protocol.invalid",
                    str(e),
                )
                await send(err)
                continue

            mtype = msg.type

            if mtype == "session.init":
                client_major = msg.protocolVersion.split(".")[0]
                server_major = settings.protocol_version.split(".")[0]
                if client_major != server_major:
                    err = server_error(
                        msg.sessionId,
                        next_fallback_seq(),
                        "protocol.versionMismatch",
                        f"client {msg.protocolVersion} incompatible with "
                        f"server {settings.protocol_version}",
                    )
                    await send(err)
                    await ws.close(code=1008)
                    return

                # Replace any prior session bound to this socket.
                if session_id is not None and session_id != msg.sessionId:
                    session_manager.drop(session_id)

                session_id = msg.sessionId
                pipeline = session_manager.create(session_id)
                log.info("session.init id=%s mode=%s", session_id, msg.sourceMode)
                for env in pipeline.on_session_init(msg):
                    await send(env)

            elif mtype == "audio.chunk":
                if session_id is None:
                    continue
                pipeline = session_manager.get(session_id)
                if pipeline is None:
                    continue
                for env in pipeline.on_audio_chunk(msg):
                    await send(env)

            elif mtype == "session.seek":
                if session_id is None:
                    continue
                pipeline = session_manager.get(session_id)
                if pipeline is None:
                    continue
                log.info(
                    "session.seek id=%s newMs=%.1f reset=%s",
                    session_id,
                    msg.newPositionMs,
                    msg.resetInference,
                )
                for env in pipeline.on_seek(msg):
                    await send(env)

            elif mtype == "session.stop":
                log.info("session.stop id=%s", session_id)
                if session_id is not None:
                    session_manager.drop(session_id)
                    session_id = None
                break

            elif mtype == "client.ping":
                sid = session_id or msg.sessionId
                pipeline = session_manager.get(sid) if session_id else None
                seq = (
                    pipeline.state.next_seq()
                    if pipeline is not None and pipeline.state is not None
                    else next_fallback_seq()
                )
                await send(server_pong(sid, seq))

    except WebSocketDisconnect:
        log.info("client disconnected id=%s", session_id)
    finally:
        if session_id is not None:
            session_manager.drop(session_id)
