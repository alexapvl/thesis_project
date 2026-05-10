"""Resolves which adapter implementations to use at runtime.

For v1, beat tracking is real (BeatNet+) when the package can be imported and
the setting allows it. Skip-BART is opt-in (`STL_USE_REAL_SKIP_BART=true`)
because it is heavy and CPU-only inference is too slow for hard real-time;
when opted in we still fall back to the mock if deps or weights are missing.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from app.adapters.base import BeatTrackerAdapter, SkipBartAdapter
from app.adapters.mock import MockBeatTracker, MockSkipBart
from app.config.settings import settings

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class ResolvedAdapters:
    beat_tracker: BeatTrackerAdapter
    skip_bart: SkipBartAdapter
    beat_tracker_kind: str
    skip_bart_kind: str


def has_weights(weights_dir) -> bool:
    if not weights_dir.exists():
        return False
    return any(_is_weight_file(p) for p in weights_dir.iterdir())


def _is_weight_file(p) -> bool:
    if not p.is_file():
        return False
    if p.name.startswith("."):
        return False
    if p.name == ".gitkeep":
        return False
    return True


def _resolve_beat_tracker() -> tuple[BeatTrackerAdapter, str]:
    if not settings.use_real_beat_tracker:
        return MockBeatTracker(), "mock"
    try:
        from app.adapters.beatnet_adapter import BeatNetTracker, is_available

        if not is_available():
            log.warning("BeatNet not importable; falling back to mock beat tracker")
            return MockBeatTracker(), "mock"
        return BeatNetTracker(), "beatnet"
    except Exception as e:  # pragma: no cover - defensive
        log.warning("BeatNet adapter unavailable (%s); falling back to mock", e)
        return MockBeatTracker(), "mock"


def _resolve_skip_bart() -> tuple[SkipBartAdapter, str]:
    weights_dir = settings.skip_bart_dir / "weights"

    if settings.use_real_skip_bart:
        try:
            from app.adapters.skipbart_adapter import (
                SkipBartGenerator,
                has_required_weights,
                is_available,
            )

            if not is_available():
                log.warning(
                    "Skip-BART deps not importable (need transformers/peft/openl3); "
                    "falling back to mock"
                )
            elif not has_required_weights(weights_dir):
                log.warning(
                    "Skip-BART weights missing in %s; falling back to mock", weights_dir
                )
            else:
                return SkipBartGenerator(), "skipbart"
        except Exception as e:  # pragma: no cover - defensive
            log.warning("Skip-BART adapter unavailable (%s); falling back to mock", e)

    # Weight presence (without opt-in) flips the kind so verification can
    # confirm discovery, but the runtime path stays mock.
    if has_weights(weights_dir):
        return MockSkipBart(), "real-pending"
    return MockSkipBart(), "mock"


_cached: ResolvedAdapters | None = None


def resolve_adapters() -> ResolvedAdapters:
    """Process-wide adapter instances. Memoized.

    First call constructs BeatNet + Skip-BART; every later call returns
    the same objects. This is what makes "load once, reuse for every
    session" possible — without memoization each new WebSocket session
    would create fresh adapters and pay the ~15 s weight-load + TF
    retrace cost again.

    Adapter instances carry per-session state (rolling audio buffer,
    KV cache, particle filter); each pipeline must call `.reset()` at
    session start and on seek-with-reset.
    """
    global _cached
    if _cached is not None:
        return _cached
    beat, beat_kind = _resolve_beat_tracker()
    skip, skip_kind = _resolve_skip_bart()
    _cached = ResolvedAdapters(
        beat_tracker=beat,
        skip_bart=skip,
        beat_tracker_kind=beat_kind,
        skip_bart_kind=skip_kind,
    )
    return _cached


def _reset_cache_for_tests() -> None:
    """Clear memoized adapters. Tests that monkeypatch settings between
    `resolve_adapters` calls must invoke this; production code never does.
    """
    global _cached
    _cached = None


def eager_load_adapters() -> ResolvedAdapters:
    """Resolves the cached adapters and runs `.load()` + `.warmup()` once.

    Called from FastAPI lifespan startup so the server pays the model
    weight-load and TF retrace cost *before* any client connects. The
    first play is then snappy instead of stalling on a cold cache.
    """
    adapters = resolve_adapters()
    log.info("eager-loading adapters (this can take 10-15 s on first boot)")
    adapters.beat_tracker.load()
    adapters.skip_bart.load()
    adapters.skip_bart.warmup()
    log.info("adapters ready")
    return adapters
