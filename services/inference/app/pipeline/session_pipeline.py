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

# Emit a synthetic lighting frame every N chunks so the stream has visible motion.
LIGHTING_EMIT_EVERY = 1
SYNTHETIC_BPM = 120.0


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
        self._tempo_emitted = False

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
        self._skip.reset()
        self._tempo_emitted = False

        out: list[DownstreamEnvelope] = [
            session_ready(msg.sessionId, self._state.next_seq()),
            inference_status(
                msg.sessionId,
                self._state.next_seq(),
                "idle",
                detail="mock adapters wired",
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
            self._tempo_emitted = False
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

        # First beat → also emit a synthetic tempo update so frontend BPM appears.
        if not self._tempo_emitted and state.last_beat_emit_seq != -1:
            out.append(
                tempo_update(
                    state.config.session_id,
                    state.next_seq(),
                    bpm=SYNTHETIC_BPM,
                    confidence=0.5,
                )
            )
            self._tempo_emitted = True

        # Synthetic lighting frame derived from chunk index. Replaced when the
        # real Skip-BART adapter lands (Step 10).
        if state.chunks_received % LIGHTING_EMIT_EVERY == 0:
            hue = (chunk.sequence * 7) % 360
            out.append(
                lighting_update(
                    state.config.session_id,
                    state.next_seq(),
                    hue=float(hue),
                    value=0.6,
                    intensity=0.6,
                )
            )

        return out

    # ── introspection ────────────────────────────────────────────────────────

    @property
    def state(self) -> SessionState | None:
        return self._state
