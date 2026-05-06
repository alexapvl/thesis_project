"""Resolves which adapter implementations to use at runtime.

For v1, beat tracking is real (BeatNet+) when the package can be imported and
the setting allows it; otherwise we fall back to the mock. Skip-BART remains
mocked until PLAN step 10 lands.
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
    # Real Skip-BART lands in PLAN step 10. Weight presence flips the kind
    # so verification can confirm discovery, but the runtime path stays mock.
    if has_weights(settings.skip_bart_dir / "weights"):
        return MockSkipBart(), "real-pending"
    return MockSkipBart(), "mock"


def resolve_adapters() -> ResolvedAdapters:
    beat, beat_kind = _resolve_beat_tracker()
    skip, skip_kind = _resolve_skip_bart()
    return ResolvedAdapters(
        beat_tracker=beat,
        skip_bart=skip,
        beat_tracker_kind=beat_kind,
        skip_bart_kind=skip_kind,
    )
