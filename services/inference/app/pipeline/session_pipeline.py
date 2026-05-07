"""Session pipeline: ingests upstream events, emits downstream envelopes.

The pipeline is sync and pure-ish: it returns a list of envelopes per call.
The api layer is responsible for actually shipping them over the WebSocket.
This split keeps the WebSocket handler free of model logic and lets us unit
test the whole flow without a network.
"""

from __future__ import annotations

import base64

from app.adapters.base import BeatTrackerAdapter, SkipBartAdapter
from app.api.schemas import (
    AudioChunk as AudioChunkMsg,
    BeatUpdate,
    InferenceStatus,
    LightingUpdate,
    SessionInit,
    SessionReady,
    SessionSeek,
    TempoUpdate,
)
from app.domain.models import AudioChunk, SessionConfig
from app.pipeline.audio_buffer import AudioRingBuffer
from app.pipeline.event_builder import (
    beat_update,
    inference_status,
    lighting_update,
    session_ready,
    tempo_update,
)
from app.pipeline.session_state import SessionState

# Cap rolling buffer at ~4 s of mono float32 @ 48 kHz = 4 * 48000 * 4 ≈ 768 KB.
DEFAULT_BUFFER_BYTES = 4 * 48_000 * 4

# Window of recent beat times used for BPM estimation.
TEMPO_WINDOW_SIZE = 8
TEMPO_MIN_BEATS = 4
TEMPO_MIN_BPM = 40.0
TEMPO_MAX_BPM = 220.0


DownstreamEnvelope = SessionReady | BeatUpdate | TempoUpdate | LightingUpdate | InferenceStatus


class SessionPipeline:
    """One pipeline per WebSocket session."""

    def __init__(
        self,
        beat_tracker: BeatTrackerAdapter,
        skip_bart: SkipBartAdapter,
    ) -> None:
        self._beat = beat_tracker
        self._skip = skip_bart
        self._state: SessionState | None = None
        self._buffer = AudioRingBuffer(DEFAULT_BUFFER_BYTES)
        self._beat_history_ms: list[float] = []
        self._last_emitted_bpm: float | None = None

    # ── lifecycle ────────────────────────────────────────────────────────────

    def on_session_init(self, msg: SessionInit) -> list[DownstreamEnvelope]:
        config = SessionConfig(
            session_id=msg.sessionId,
            source_mode=msg.sourceMode,
            chunk_size=msg.chunkSize,
            sample_rate=msg.sampleRate,
        )
        self._state = SessionState(config=config)
        self._buffer.reset()
        self._beat.load()
        self._beat.reset()
        self._skip.load()
        self._skip.warmup()
        self._skip.reset()
        self._beat_history_ms = []
        self._last_emitted_bpm = None

        out: list[DownstreamEnvelope] = [
            session_ready(msg.sessionId, self._state.next_seq()),
            inference_status(
                msg.sessionId,
                self._state.next_seq(),
                "idle",
                detail=(
                    f"adapters ready: beat={type(self._beat).__name__}, "
                    f"skip={type(self._skip).__name__}"
                ),
            ),
        ]
        return out

    def on_seek(self, msg: SessionSeek) -> list[DownstreamEnvelope]:
        if self._state is None:
            return []
        if msg.resetInference:
            self._beat.reset()
            self._skip.reset()
            self._buffer.reset()
            self._state.reset_inference(msg.newPositionMs)
            self._beat_history_ms = []
            self._last_emitted_bpm = None
            return [
                inference_status(
                    self._state.config.session_id,
                    self._state.next_seq(),
                    "idle",
                    detail=f"seek reset @ {msg.newPositionMs:.0f} ms",
                )
            ]
        self._state.last_playback_position_ms = msg.newPositionMs
        return []

    def on_stop(self) -> None:
        if self._state is None:
            return
        self._beat.reset()
        self._skip.reset()
        self._buffer.reset()
        self._state = None

    # ── audio path ───────────────────────────────────────────────────────────

    def on_audio_chunk(self, msg: AudioChunkMsg) -> list[DownstreamEnvelope]:
        state = self._state
        if state is None:
            return []

        try:
            pcm_bytes = base64.b64decode(msg.pcm, validate=True)
        except (ValueError, TypeError):
            return []

        chunk = AudioChunk(
            session_id=msg.sessionId,
            sequence=msg.sequence,
            timestamp_ms=msg.timestampMs,
            playback_position_ms=msg.playbackPositionMs,
            sample_rate=msg.sampleRate,
            channels=msg.channels,
            pcm=pcm_bytes,
        )

        self._buffer.append(chunk.sequence, pcm_bytes)
        state.chunks_received += 1
        state.last_playback_position_ms = chunk.playback_position_ms

        out: list[DownstreamEnvelope] = []

        # Beat tracker drain.
        self._beat.ingest(chunk)
        new_beats: list[float] = []
        for ev in self._beat.get_events():
            out.append(
                beat_update(
                    state.config.session_id,
                    state.next_seq(),
                    beat_time_ms=ev.beat_time_ms,
                    confidence=ev.confidence,
                )
            )
            state.last_beat_emit_seq = state.out_sequence
            new_beats.append(ev.beat_time_ms)

        if new_beats:
            self._beat_history_ms.extend(new_beats)
            if len(self._beat_history_ms) > TEMPO_WINDOW_SIZE:
                self._beat_history_ms = self._beat_history_ms[-TEMPO_WINDOW_SIZE:]
            bpm = _estimate_bpm(self._beat_history_ms)
            if bpm is not None and self._should_emit_bpm(bpm):
                out.append(
                    tempo_update(
                        state.config.session_id,
                        state.next_seq(),
                        bpm=bpm,
                        confidence=0.7,
                    )
                )
                self._last_emitted_bpm = bpm

        # Skip-BART (or mock) drain. Real adapter buffers internally and emits
        # frames in bursts whenever its inference window fires; the mock emits
        # one frame per ingested chunk.
        self._skip.ingest(chunk)
        for pred in self._skip.get_predictions():
            out.append(
                lighting_update(
                    state.config.session_id,
                    state.next_seq(),
                    hue=pred.hue,
                    value=pred.value,
                    intensity=pred.intensity,
                    beat_pulse=pred.beat_pulse,
                    confidence=pred.confidence,
                )
            )

        return out

    # ── introspection ────────────────────────────────────────────────────────

    @property
    def state(self) -> SessionState | None:
        return self._state

    def _should_emit_bpm(self, bpm: float) -> bool:
        if self._last_emitted_bpm is None:
            return True
        # Throttle: emit only when BPM moves more than 0.5 — otherwise the
        # frontend gets a tempo.update on every beat.
        return abs(bpm - self._last_emitted_bpm) > 0.5


def _estimate_bpm(beat_times_ms: list[float]) -> float | None:
    if len(beat_times_ms) < TEMPO_MIN_BEATS:
        return None
    intervals = [b - a for a, b in zip(beat_times_ms, beat_times_ms[1:]) if b > a]
    if not intervals:
        return None
    intervals.sort()
    median = intervals[len(intervals) // 2]
    if median <= 0:
        return None
    bpm = 60_000.0 / median
    if bpm < TEMPO_MIN_BPM or bpm > TEMPO_MAX_BPM:
        return None
    return bpm
