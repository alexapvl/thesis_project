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
from app.utils.profiling import stage_timer

# Cap rolling buffer at ~4 s of mono float32 @ 48 kHz = 4 * 48000 * 4 ≈ 768 KB.
DEFAULT_BUFFER_BYTES = 4 * 48_000 * 4

# Window of recent beat times used for BPM estimation.
TEMPO_WINDOW_SIZE = 8
TEMPO_MIN_BEATS = 4
TEMPO_MIN_BPM = 40.0
TEMPO_MAX_BPM = 220.0

# Beat synthesis. Once BeatNet has produced enough beats to establish a
# stable tempo, we maintain a "next predicted beat" timestamp and emit a
# synthetic beat each time it passes — keeps fixture movement at the
# right cadence even when BeatNet misses beats (which it does, often,
# on real music — see docs).
SYNTH_MIN_BEATS_TO_LOCK = TEMPO_MIN_BEATS  # need stable tempo before synthesizing
# Minimum spacing between any two emitted beats (real or synthetic),
# expressed as a fraction of the current beat interval. Anything that
# would land closer than this to the previous emitted beat gets dropped.
# This is what keeps a real BeatNet beat and the next predicted synth
# beat from both firing inside one musical beat — at 136 BPM = 441 ms
# interval × 0.6 = 264 ms minimum gap, so two beats can't squeeze inside
# the same period.
SYNTH_MIN_GAP_FRACTION = 0.6


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
        # Phase predictor for synthesizing beats when BeatNet drops them.
        # `_next_predicted_beat_ms` is in the chunk-timestamp domain so it
        # can be compared directly to chunk.timestamp_ms in on_audio_chunk.
        self._next_predicted_beat_ms: float | None = None
        self._beat_interval_ms: float | None = None
        # Time of the last beat we actually emitted (real or synthetic).
        # Used to enforce the minimum-gap rule that keeps double beats
        # from sneaking through when a real beat arrives shortly before
        # a predicted synth.
        self._last_emitted_beat_ms: float | None = None

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
        self._next_predicted_beat_ms = None
        self._beat_interval_ms = None
        self._last_emitted_beat_ms = None

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
            self._next_predicted_beat_ms = None
            self._beat_interval_ms = None
            self._last_emitted_beat_ms = None
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
        with stage_timer("beat.ingest"):
            self._beat.ingest(chunk)
        new_beats: list[float] = []
        with stage_timer("beat.drain"):
            beat_events = list(self._beat.get_events())
        for ev in beat_events:
            # Real beats are ground truth: track the tempo lock with them
            # but only emit if they're at least one min-gap past the last
            # emitted beat. Suppresses the case where BeatNet fires
            # slightly before a predicted synth — without this gate the
            # rig would jolt twice in one musical beat.
            interval = self._beat_interval_ms
            if (
                interval is not None
                and self._last_emitted_beat_ms is not None
                and (ev.beat_time_ms - self._last_emitted_beat_ms)
                < SYNTH_MIN_GAP_FRACTION * interval
            ):
                # Still re-anchor the predictor so the next synth lines
                # up with this real beat — we just don't emit it.
                self._next_predicted_beat_ms = ev.beat_time_ms + interval
                new_beats.append(ev.beat_time_ms)
                continue
            # Always re-anchor the predictor on a real beat. The previous
            # "snap only if close to predicted" rule let real and synth
            # beats coexist on out-of-phase grids and produced doubles.
            if interval is not None:
                self._next_predicted_beat_ms = ev.beat_time_ms + interval
            out.append(
                beat_update(
                    state.config.session_id,
                    state.next_seq(),
                    beat_time_ms=ev.beat_time_ms,
                    confidence=ev.confidence,
                    is_downbeat=ev.is_downbeat,
                    synthetic=False,
                )
            )
            state.last_beat_emit_seq = state.out_sequence
            self._last_emitted_beat_ms = ev.beat_time_ms
            new_beats.append(ev.beat_time_ms)

        if new_beats:
            self._beat_history_ms.extend(new_beats)
            if len(self._beat_history_ms) > TEMPO_WINDOW_SIZE:
                self._beat_history_ms = self._beat_history_ms[-TEMPO_WINDOW_SIZE:]
            bpm = _estimate_bpm(self._beat_history_ms)
            if bpm is not None:
                self._beat_interval_ms = 60_000.0 / bpm
                # Initialize the predictor on the first stable tempo lock.
                # Anchor on the most recent real beat — everything after
                # that gets synthesized at interval steps unless BeatNet
                # gives us another real beat to resync to.
                if (
                    self._next_predicted_beat_ms is None
                    and len(self._beat_history_ms) >= SYNTH_MIN_BEATS_TO_LOCK
                ):
                    self._next_predicted_beat_ms = (
                        self._beat_history_ms[-1] + self._beat_interval_ms
                    )
                if self._should_emit_bpm(bpm):
                    out.append(
                        tempo_update(
                            state.config.session_id,
                            state.next_seq(),
                            bpm=bpm,
                            confidence=0.7,
                        )
                    )
                    self._last_emitted_bpm = bpm

        # Synthesize any predicted beats whose time has now passed.
        # Capped at MAX_BURST per chunk so a long playback gap (paused
        # tab, network stall) doesn't fire a flurry on resume.
        if (
            self._next_predicted_beat_ms is not None
            and self._beat_interval_ms is not None
        ):
            MAX_BURST = 4
            burst = 0
            while (
                self._next_predicted_beat_ms <= chunk.timestamp_ms
                and burst < MAX_BURST
            ):
                t = self._next_predicted_beat_ms
                # Same min-gap filter as for real beats: don't emit a
                # synth that would land on top of the previous emission.
                if (
                    self._last_emitted_beat_ms is None
                    or (t - self._last_emitted_beat_ms)
                    >= SYNTH_MIN_GAP_FRACTION * self._beat_interval_ms
                ):
                    out.append(
                        beat_update(
                            state.config.session_id,
                            state.next_seq(),
                            beat_time_ms=t,
                            confidence=0.7,
                            is_downbeat=False,
                            synthetic=True,
                        )
                    )
                    state.last_beat_emit_seq = state.out_sequence
                    self._last_emitted_beat_ms = t
                self._next_predicted_beat_ms += self._beat_interval_ms
                burst += 1

        # Skip-BART (or mock) drain. Real adapter buffers internally and emits
        # frames in bursts whenever its inference window fires; the mock emits
        # one frame per ingested chunk.
        with stage_timer("skip.ingest"):
            self._skip.ingest(chunk)
        with stage_timer("skip.drain"):
            predictions = list(self._skip.get_predictions())
        for pred in predictions:
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

        # First real prediction of this session/seek-window: flip the
        # status from idle → running so the UI knows the model is live.
        if predictions and not state.inference_running_announced:
            out.append(
                inference_status(
                    state.config.session_id,
                    state.next_seq(),
                    "running",
                    detail=f"{type(self._skip).__name__} producing predictions",
                )
            )
            state.inference_running_announced = True

        return out

    # ── introspection ────────────────────────────────────────────────────────

    @property
    def state(self) -> SessionState | None:
        return self._state

    def _should_emit_bpm(self, bpm: float) -> bool:
        # No throttle: emit on every beat-history change. The frontend
        # surfaces BPM in a live debug panel; suppressing small deltas
        # made the readout look stale on songs whose tempo drifts within
        # the throttle's deadband.
        return self._last_emitted_bpm is None or bpm != self._last_emitted_bpm


def _estimate_bpm(beat_times_ms: list[float]) -> float | None:
    """Estimate BPM from a window of recent beat times.

    Real-world beat trackers miss beats. When that happens, the intervals
    between *detected* beats become bimodal: clusters around the true
    interval ``X`` and around ``2X`` (one skip), occasionally ``3X``. The
    median falls between clusters and reports half-tempo — which is what
    we kept seeing in practice (e.g., BPM=68 on 130-BPM music).

    Using the **25th-percentile** interval inside the plausible-tempo
    range (40–200 BPM ≈ 300–1500 ms) instead is robust to this: as long
    as at least a quarter of the detected intervals are the true beat
    interval, p25 lands inside that cluster. If the tracker is missing
    *most* beats — i.e., the true interval doesn't even reach p25 — the
    estimate halves, but we surface half-tempo only when that's all the
    data supports.
    """
    if len(beat_times_ms) < TEMPO_MIN_BEATS:
        return None
    intervals = [b - a for a, b in zip(beat_times_ms, beat_times_ms[1:]) if b > a]
    # Reject implausible intervals up front so a single tracker glitch
    # (e.g., a 0.22 s spike between two real beats) can't drag the
    # percentile selection.
    min_interval = 60_000.0 / TEMPO_MAX_BPM
    max_interval = 60_000.0 / TEMPO_MIN_BPM
    intervals = [i for i in intervals if min_interval <= i <= max_interval]
    if len(intervals) < 3:
        return None
    intervals.sort()
    p25 = intervals[len(intervals) // 4]
    if p25 <= 0:
        return None
    bpm = 60_000.0 / p25
    if bpm < TEMPO_MIN_BPM or bpm > TEMPO_MAX_BPM:
        return None
    return bpm
