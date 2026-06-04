from __future__ import annotations

import time

from app.utils.profiling import StageMetrics, metrics, stage_timer


def test_stage_timer_records_into_registry() -> None:
    reg = StageMetrics(window=8)
    with stage_timer("unit.test", registry=reg):
        time.sleep(0.001)
    summary = reg.summary()
    assert "unit.test" in summary
    assert summary["unit.test"]["n"] == 1
    assert summary["unit.test"]["count"] == 1
    assert summary["unit.test"]["min_ms"] >= 0.0


def test_rolling_window_caps_n_but_count_keeps_climbing() -> None:
    reg = StageMetrics(window=4)
    for _ in range(10):
        with stage_timer("loop", registry=reg):
            pass
    s = reg.summary()["loop"]
    assert s["n"] == 4
    assert s["count"] == 10


def test_summary_is_empty_until_a_sample_lands() -> None:
    reg = StageMetrics()
    assert reg.summary() == {}


def test_timer_records_even_when_block_raises() -> None:
    reg = StageMetrics()
    try:
        with stage_timer("oops", registry=reg):
            raise RuntimeError("boom")
    except RuntimeError:
        pass
    assert reg.summary()["oops"]["n"] == 1


def test_begin_benchmark_captures_all_samples() -> None:
    metrics.begin_benchmark()
    metrics.record("skip.inference", 10.0)
    metrics.record("skip.inference", 20.0)
    metrics.record("skip.drain", 0.01)
    captured = metrics.end_benchmark_capture()
    assert captured["skip.inference"] == [10.0, 20.0]
    assert captured["skip.drain"] == [0.01]
