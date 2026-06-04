"""Stage-by-stage profiling for the session pipeline.

Each pipeline stage (beat.ingest, beat.drain, skip.ingest, skip.drain) is
wrapped in `stage_timer(name)` which records its wall-clock duration into
the process-wide `metrics` registry. The registry keeps a fixed-size
rolling window per stage so `/metrics` returns recent p50/p95 instead of
lifetime averages — what you want when diagnosing a live regression.

Why not `time.perf_counter()` directly at each call site:
- forgetting one `else` branch silently drops samples
- nested timers compose (skip.drain wraps the autoregressive decode loop)
  and a context manager keeps the start/stop balanced even on exceptions
"""

from __future__ import annotations

import time
from collections import deque
from contextlib import contextmanager
from threading import Lock
from typing import Iterator


WINDOW_SIZE = 64


class StageMetrics:
    """In-memory rolling window of per-stage durations (milliseconds)."""

    def __init__(self, window: int = WINDOW_SIZE) -> None:
        self._window = window
        self._samples: dict[str, deque[float]] = {}
        self._counts: dict[str, int] = {}
        self._benchmark_samples: dict[str, list[float]] = {}
        self._benchmark_active = False
        self._lock = Lock()

    def begin_benchmark(self) -> None:
        """Reset live window and start capturing every sample for export."""
        with self._lock:
            self._samples.clear()
            self._counts.clear()
            self._benchmark_samples.clear()
            self._benchmark_active = True

    def end_benchmark_capture(self) -> dict[str, list[float]]:
        with self._lock:
            self._benchmark_active = False
            return {stage: list(buf) for stage, buf in self._benchmark_samples.items()}

    def record(self, stage: str, duration_ms: float) -> None:
        with self._lock:
            buf = self._samples.get(stage)
            if buf is None:
                buf = deque(maxlen=self._window)
                self._samples[stage] = buf
            buf.append(duration_ms)
            self._counts[stage] = self._counts.get(stage, 0) + 1
            if self._benchmark_active:
                bench = self._benchmark_samples.get(stage)
                if bench is None:
                    bench = []
                    self._benchmark_samples[stage] = bench
                bench.append(duration_ms)

    def summary(self) -> dict[str, dict[str, float | int]]:
        with self._lock:
            out: dict[str, dict[str, float | int]] = {}
            for stage, buf in self._samples.items():
                if not buf:
                    continue
                samples = sorted(buf)
                n = len(samples)
                out[stage] = {
                    "count": self._counts.get(stage, 0),
                    "n": n,
                    "min_ms": round(samples[0], 3),
                    "p50_ms": round(samples[n // 2], 3),
                    "p95_ms": round(samples[max(0, int(n * 0.95) - 1)], 3),
                    "max_ms": round(samples[-1], 3),
                    "avg_ms": round(sum(samples) / n, 3),
                }
            return out

    def reset(self) -> None:
        with self._lock:
            self._samples.clear()
            self._counts.clear()

    def dump_samples(self) -> dict[str, list[float]]:
        with self._lock:
            return {stage: list(buf) for stage, buf in self._samples.items()}


metrics = StageMetrics()


@contextmanager
def stage_timer(stage: str, registry: StageMetrics = metrics) -> Iterator[None]:
    start = time.perf_counter()
    try:
        yield
    finally:
        registry.record(stage, (time.perf_counter() - start) * 1000.0)
