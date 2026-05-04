"""Deterministic mock adapters used until real models are wired in."""

from __future__ import annotations

from app.domain.models import AudioChunk, BeatEvent, LightingPrediction


class MockBeatTracker:
    def __init__(self) -> None:
        self._events: list[BeatEvent] = []

    def load(self) -> None: ...
    def reset(self) -> None:
        self._events.clear()

    def ingest(self, chunk: AudioChunk) -> None:
        # Emit a fake beat every 16 chunks (~1.6 s at 100 ms chunks).
        if chunk.sequence % 16 == 0:
            self._events.append(
                BeatEvent(
                    session_id=chunk.session_id,
                    beat_time_ms=chunk.timestamp_ms,
                    confidence=0.7,
                )
            )

    def get_events(self) -> list[BeatEvent]:
        out, self._events = self._events, []
        return out


class MockSkipBart:
    def load(self) -> None: ...
    def warmup(self) -> None: ...
    def reset(self) -> None: ...

    def predict(self, context: object) -> LightingPrediction | None:
        del context
        return None
