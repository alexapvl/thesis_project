from __future__ import annotations

from app.pipeline.session_pipeline import _estimate_bpm


def test_estimate_bpm_at_120() -> None:
    beats = [i * 500.0 for i in range(8)]  # 500 ms IBI → 120 BPM
    assert _estimate_bpm(beats) == 120.0


def test_estimate_bpm_below_threshold_returns_none() -> None:
    assert _estimate_bpm([0.0, 500.0, 1000.0]) is None  # 3 beats, min is 4


def test_estimate_bpm_clamped_out_of_range() -> None:
    # 30 BPM is below the floor of 40.
    too_slow = [i * 2000.0 for i in range(8)]
    assert _estimate_bpm(too_slow) is None
    # 240 BPM is above the ceiling of 220.
    too_fast = [i * 250.0 for i in range(8)]
    assert _estimate_bpm(too_fast) is None
