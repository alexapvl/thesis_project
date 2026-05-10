"""Real-time beat-tracking adapter backed by BeatNet+ (Heydari & Lerch).

The chunk transport contract is mono Float32 PCM @ 48 kHz. BeatNet expects
22050 Hz. This adapter:

  1. resamples each incoming chunk 48000 → 22050 with scipy.signal.resample_poly,
  2. appends to a bounded rolling buffer (~6 s),
  3. periodically (every N chunks) feeds the buffer to ``BeatNet.process()``
     in 'online' mode (CRNN + particle filter, causal), then
  4. converts BeatNet's local-time outputs to absolute timestamps and emits
     only beats not previously reported.

Trade-offs picked for v1:
  * BeatNet's public API does not expose true frame-by-frame streaming, so
    we re-run inference on the rolling buffer every ~200 ms. For the
    short buffers we use this is well under the chunk inter-arrival time
    on a modern CPU.
  * Beat times near the very front of the buffer can wobble before the
    particle filter locks in; the per-session ``_last_emitted_ms`` cursor
    deduplicates and effectively only commits beats once they fall out of
    the unstable window (or near the end of the buffer on subsequent runs).
"""

from __future__ import annotations

import logging
from typing import Any

import numpy as np

from app.domain.models import AudioChunk, BeatEvent

log = logging.getLogger(__name__)

BEATNET_SAMPLE_RATE = 22050


class BeatNetTracker:
    """Wraps BeatNet so it satisfies the BeatTrackerAdapter Protocol."""

    BUFFER_SECONDS = 6.0
    MIN_BUFFER_SECONDS_TO_RUN = 1.5
    MIN_CHUNKS_BETWEEN_RUNS = 5  # ~215 ms at 2048 samples / 48 kHz

    def __init__(self) -> None:
        self._beatnet: Any = None
        self._buffer: np.ndarray = np.zeros(0, dtype=np.float32)
        self._buffer_start_ms: float | None = None
        self._last_emitted_ms: float = -1.0
        self._chunks_since_run: int = 0
        self._session_id: str = ""
        self._loaded: bool = False

    # ── lifecycle ────────────────────────────────────────────────────────────

    def load(self) -> None:
        if self._loaded:
            return
        # numpy >= 2.0 removed np.in1d; BeatNet's particle filter still
        # calls it. Patch in a shim before importing BeatNet.
        import numpy as _np  # noqa: PLC0415

        if not hasattr(_np, "in1d"):
            _np.in1d = _np.isin  # type: ignore[attr-defined]

        # Heavy import; do it lazily so test collection is not blocked.
        from BeatNet.BeatNet import BeatNet  # type: ignore[import-not-found]

        self._beatnet = BeatNet(
            model=1,  # 1 = GTZAN-trained checkpoint, bundled with the wheel.
            mode="online",
            inference_model="PF",  # particle filter (causal)
            plot=[],
            thread=False,
        )
        self._loaded = True
        log.info("BeatNet loaded (model=1, mode=online, inference=PF)")

    def reset(self) -> None:
        self._buffer = np.zeros(0, dtype=np.float32)
        self._buffer_start_ms = None
        self._last_emitted_ms = -1.0
        self._chunks_since_run = 0

    # ── ingest / emit ────────────────────────────────────────────────────────

    def ingest(self, chunk: AudioChunk) -> None:
        if not self._loaded:
            return
        self._session_id = chunk.session_id

        pcm_in = np.frombuffer(chunk.pcm, dtype="<f4")
        if pcm_in.size == 0:
            return

        pcm_22k = self._resample(pcm_in, chunk.sample_rate)
        if pcm_22k.size == 0:
            return

        if self._buffer_start_ms is None:
            self._buffer_start_ms = float(chunk.timestamp_ms)
        self._buffer = np.concatenate([self._buffer, pcm_22k])

        max_samples = int(self.BUFFER_SECONDS * BEATNET_SAMPLE_RATE)
        if self._buffer.size > max_samples:
            drop = self._buffer.size - max_samples
            self._buffer = self._buffer[drop:]
            assert self._buffer_start_ms is not None
            self._buffer_start_ms += drop * 1000.0 / BEATNET_SAMPLE_RATE
            if self._last_emitted_ms < self._buffer_start_ms:
                self._last_emitted_ms = self._buffer_start_ms

        self._chunks_since_run += 1

    def get_events(self) -> list[BeatEvent]:
        if (
            not self._loaded
            or self._beatnet is None
            or self._buffer_start_ms is None
        ):
            return []
        if self._buffer.size < int(self.MIN_BUFFER_SECONDS_TO_RUN * BEATNET_SAMPLE_RATE):
            return []
        if self._chunks_since_run < self.MIN_CHUNKS_BETWEEN_RUNS:
            return []
        self._chunks_since_run = 0

        try:
            output = self._beatnet.process(self._buffer)
        except Exception as e:
            log.warning("BeatNet.process raised: %s", e)
            return []

        if output is None:
            return []
        arr = np.asarray(output)
        if arr.ndim != 2 or arr.size == 0:
            return []

        events: list[BeatEvent] = []
        buffer_start_ms = self._buffer_start_ms
        for row in arr:
            t_s = float(row[0])
            abs_ms = buffer_start_ms + t_s * 1000.0
            if abs_ms <= self._last_emitted_ms:
                continue
            self._last_emitted_ms = abs_ms
            events.append(
                BeatEvent(
                    session_id=self._session_id,
                    beat_time_ms=abs_ms,
                    confidence=0.9,
                )
            )
        return events

    # ── helpers ──────────────────────────────────────────────────────────────

    @staticmethod
    def _resample(pcm: np.ndarray, sample_rate: int) -> np.ndarray:
        if sample_rate == BEATNET_SAMPLE_RATE:
            return pcm.astype(np.float32, copy=False)
        from math import gcd

        from scipy.signal import resample_poly  # type: ignore[import-not-found]

        g = gcd(BEATNET_SAMPLE_RATE, sample_rate)
        up = BEATNET_SAMPLE_RATE // g
        down = sample_rate // g
        out = resample_poly(pcm, up, down)
        return out.astype(np.float32, copy=False)


def is_available() -> bool:
    """True iff BeatNet (and its madmom dep) can be imported in this env."""
    try:
        import BeatNet.BeatNet  # type: ignore[import-not-found] # noqa: F401

        return True
    except Exception as e:  # pragma: no cover
        log.debug("BeatNet not importable: %s", e)
        return False
