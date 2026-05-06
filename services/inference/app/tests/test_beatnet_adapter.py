"""Smoke test for the real BeatNet adapter.

Skipped automatically when BeatNet (and its madmom dep) cannot be imported.
The test feeds a 4-second 120-BPM click track and asserts the adapter emits
beats and that the median inter-beat interval is in a sane range.
"""

from __future__ import annotations

import math

import numpy as np
import pytest

beatnet_module = pytest.importorskip("BeatNet.BeatNet")

from app.adapters.beatnet_adapter import BeatNetTracker  # noqa: E402
from app.domain.models import AudioChunk  # noqa: E402

CHUNK_SAMPLES = 2048  # matches CANONICAL_CHUNK_SIZE on the frontend
SR = 48_000


def _click_track(duration_s: float, bpm: float) -> np.ndarray:
    """Return a Float32 mono click track at SR with one short impulse per beat."""
    n_samples = int(duration_s * SR)
    audio = np.zeros(n_samples, dtype=np.float32)
    period = 60.0 / bpm
    impulse_len = int(0.005 * SR)  # 5 ms click
    t = 0.0
    while int(t * SR) < n_samples - impulse_len:
        start = int(t * SR)
        audio[start : start + impulse_len] = 0.9
        t += period
    return audio


def _bytes_for(audio_slice: np.ndarray) -> bytes:
    return audio_slice.astype("<f4", copy=False).tobytes()


def test_beatnet_emits_beats_on_click_track() -> None:
    audio = _click_track(duration_s=4.0, bpm=120.0)
    tracker = BeatNetTracker()
    tracker.load()
    tracker.reset()

    all_events = []
    base_ts_ms = 0.0
    for i in range(0, len(audio) - CHUNK_SAMPLES + 1, CHUNK_SAMPLES):
        chunk_pcm = audio[i : i + CHUNK_SAMPLES]
        chunk = AudioChunk(
            session_id="t",
            sequence=i // CHUNK_SAMPLES,
            timestamp_ms=base_ts_ms + (i / SR) * 1000.0,
            playback_position_ms=(i / SR) * 1000.0,
            sample_rate=SR,
            channels=1,
            pcm=_bytes_for(chunk_pcm),
        )
        tracker.ingest(chunk)
        all_events.extend(tracker.get_events())

    assert len(all_events) >= 4, f"expected several beats, got {len(all_events)}"
    times = [e.beat_time_ms for e in all_events]
    intervals = [b - a for a, b in zip(times, times[1:])]
    intervals.sort()
    median_ms = intervals[len(intervals) // 2]
    bpm = 60_000.0 / median_ms
    # Click-track tempo is exactly 120; allow ±15 BPM since the particle filter
    # latches onto half/double tempo on toy signals.
    assert math.isclose(bpm, 120.0, abs_tol=15.0) or math.isclose(bpm, 60.0, abs_tol=10.0) or math.isclose(bpm, 240.0, abs_tol=15.0)
