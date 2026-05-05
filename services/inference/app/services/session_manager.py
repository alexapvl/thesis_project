"""Tracks active SessionPipeline instances by session id.

For v1 there is exactly one session per WebSocket connection, but the
manager exists so future multi-tenant routing or admin introspection has a
stable seam.
"""

from __future__ import annotations

from app.adapters.mock import MockBeatTracker, MockSkipBart
from app.pipeline.session_pipeline import SessionPipeline


class SessionManager:
    def __init__(self) -> None:
        self._pipelines: dict[str, SessionPipeline] = {}

    def create(self, session_id: str) -> SessionPipeline:
        pipeline = SessionPipeline(MockBeatTracker(), MockSkipBart())
        self._pipelines[session_id] = pipeline
        return pipeline

    def get(self, session_id: str) -> SessionPipeline | None:
        return self._pipelines.get(session_id)

    def drop(self, session_id: str) -> None:
        pipeline = self._pipelines.pop(session_id, None)
        if pipeline is not None:
            pipeline.on_stop()

    def active_count(self) -> int:
        return len(self._pipelines)


session_manager = SessionManager()
