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
    """Deterministic synthetic lighting frames (one per ingested chunk).

    Hue cycles with chunk sequence so the frontend has visible motion when the
    real Skip-BART is not loaded. Mirrors the streaming Protocol so the
    pipeline does not branch on adapter kind.
    """

    def __init__(self) -> None:
        self._session_id: str = ""
        self._pending: list[LightingPrediction] = []

    def load(self) -> None: ...
    def warmup(self) -> None: ...

    def reset(self) -> None:
        self._pending.clear()

    def ingest(self, chunk: AudioChunk) -> None:
        self._session_id = chunk.session_id
        hue = float((chunk.sequence * 7) % 360)
        self._pending.append(
            LightingPrediction(
                session_id=chunk.session_id,
                hue=hue,
                value=0.6,
                intensity=0.6,
                beat_pulse=None,
                confidence=None,
                frame_time_ms=chunk.timestamp_ms,
            )
        )

    def get_predictions(self) -> list[LightingPrediction]:
        out, self._pending = self._pending, []
        return out
