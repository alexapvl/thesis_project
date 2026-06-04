from __future__ import annotations

import logging
from typing import Any

from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, TypeAdapter, ValidationError

try:
    # Uvicorn raises this when the underlying TCP connection drops mid-write.
    # Treat it the same as a starlette WebSocketDisconnect.
    from uvicorn.protocols.utils import ClientDisconnected
except ImportError:  # pragma: no cover — older uvicorn
    class ClientDisconnected(Exception):  # type: ignore[no-redef]
        ...


# Tuple of "client is gone" exceptions. Anywhere we'd otherwise try to send
# on a dead socket, catch these instead — emitting an error envelope back
# would just throw "Cannot call send once close has been sent."
_DISCONNECT_EXCEPTIONS = (WebSocketDisconnect, ClientDisconnected)

from app.api.schemas import UpstreamMessage
from app.config.settings import settings
from app.pipeline.event_builder import server_error, server_pong
from app.services.bench_report import build_metrics_report
from app.services.model_registry import eager_load_adapters
from app.services.session_manager import session_manager
from app.services.startup_validation import issues_block_startup, validate_setup
from app.utils.logging_setup import configure_logging, kv
from app.utils.profiling import metrics

log = logging.getLogger("stl.ws")
configure_logging(settings.log_level)


@asynccontextmanager
async def lifespan(_: FastAPI):
    issues = validate_setup()
    for issue in issues:
        line = kv(code=issue.code, severity=issue.severity, msg=issue.message)
        if issue.severity == "error":
            log.error("startup.issue %s", line)
        else:
            log.warning("startup.issue %s", line)
    if issues_block_startup(issues):
        raise RuntimeError(
            "model setup validation failed; "
            "set STL_REQUIRE_REAL_MODELS=false to run on mock adapters"
        )
    # Load weights and JIT-compile the heavy paths up front so the first
    # user-visible play does not stall on a cold model. Subsequent
    # session.init handlers reuse these warm adapters; their .load() and
    # .warmup() calls become no-ops thanks to the _loaded short-circuit.
    adapters = eager_load_adapters()
    log.info(
        "adapters.resolved %s",
        kv(beat=adapters.beat_tracker_kind, skip=adapters.skip_bart_kind),
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


@app.get("/metrics")
async def metrics_endpoint() -> dict[str, Any]:
    """Stage-by-stage rolling-window timings.

    Not Prometheus-formatted — this is a research tool, not a production
    surface. Returns the most recent ~64 samples per stage as
    p50/p95/min/max/avg in milliseconds.
    """
    return {
        "stages": metrics.summary(),
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

    async def emit_error(stage: str, code: str, message: str) -> None:
        # Used both for per-message validation failures and for unhandled
        # internal errors. The WebSocket stays open so a single bad frame
        # cannot kill an in-flight session — the client decides what to do
        # next.
        log.error("ws.error %s", kv(stage=stage, session_id=session_id, code=code, msg=message))
        await send(server_error(session_id or "", next_fallback_seq(), code, message))

    try:
        while True:
            raw = await ws.receive_json()
            try:
                msg = _upstream_adapter.validate_python(raw)
            except ValidationError as e:
                await emit_error("validate", "protocol.invalid", str(e))
                continue

            mtype = msg.type

            try:
                if mtype == "session.init":
                    client_major = msg.protocolVersion.split(".")[0]
                    server_major = settings.protocol_version.split(".")[0]
                    if client_major != server_major:
                        await emit_error(
                            "session.init",
                            "protocol.versionMismatch",
                            f"client {msg.protocolVersion} incompatible with "
                            f"server {settings.protocol_version}",
                        )
                        await ws.close(code=1008)
                        return

                    if session_id is not None and session_id != msg.sessionId:
                        session_manager.drop(session_id)

                    session_id = msg.sessionId
                    pipeline = session_manager.create(session_id)
                    log.info(
                        "session.init %s",
                        kv(
                            session_id=session_id,
                            mode=msg.sourceMode,
                            proto=msg.protocolVersion,
                            chunk=msg.chunkSize,
                        ),
                    )
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
                        "session.seek %s",
                        kv(
                            session_id=session_id,
                            new_ms=round(msg.newPositionMs, 1),
                            reset=msg.resetInference,
                        ),
                    )
                    for env in pipeline.on_seek(msg):
                        await send(env)

                elif mtype == "session.stop":
                    log.info("session.stop %s", kv(session_id=session_id))
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

                elif mtype == "bench.start":
                    metrics.begin_benchmark()
                    if session_id is not None:
                        pipeline = session_manager.get(session_id)
                        if pipeline is not None and pipeline.state is not None:
                            pipeline.state.chunks_received = 0
                    log.info(
                        "bench.start %s",
                        kv(session_id=session_id, run_id=msg.runId, label=msg.configLabel),
                    )

                elif mtype == "bench.stop":
                    sid = session_id or msg.sessionId
                    pipeline = session_manager.get(sid) if session_id else None
                    seq = (
                        pipeline.state.next_seq()
                        if pipeline is not None and pipeline.state is not None
                        else next_fallback_seq()
                    )
                    chunks_received = (
                        pipeline.state.chunks_received
                        if pipeline is not None and pipeline.state is not None
                        else 0
                    )
                    stage_samples = metrics.end_benchmark_capture()
                    log.info(
                        "bench.stop %s",
                        kv(session_id=session_id, run_id=msg.runId, chunks=chunks_received),
                    )
                    await send(
                        build_metrics_report(
                            sid,
                            seq,
                            msg.runId,
                            chunks_received,
                            stage_samples=stage_samples,
                        )
                    )

            except _DISCONNECT_EXCEPTIONS:
                # Client went away while we were mid-handler. Don't try to
                # emit an error envelope (the socket is already closed);
                # just bubble out to the outer handler for clean teardown.
                raise
            except Exception as e:  # noqa: BLE001
                # Catch-all so an exception in one message handler does not
                # tear down the WebSocket. Log with the full traceback for
                # the operator, send a sanitized code/message to the client.
                log.exception(
                    "ws.dispatch.failure %s",
                    kv(stage=mtype, session_id=session_id, exc=type(e).__name__),
                )
                try:
                    await emit_error(mtype, "internal.unhandled", type(e).__name__)
                except _DISCONNECT_EXCEPTIONS:
                    # Connection went away between the original error and
                    # our attempt to report it. Abandon and let the outer
                    # handler clean up the session.
                    raise

    except _DISCONNECT_EXCEPTIONS:
        log.info("ws.disconnect %s", kv(session_id=session_id))
    finally:
        if session_id is not None:
            session_manager.drop(session_id)
