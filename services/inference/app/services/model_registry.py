"""Resolves which adapter implementations to use at runtime.

For v1 we always return the mock adapters; once real Skip-BART / beat
tracker code lands (PLAN steps 9 + 10), this module is the only place that
needs to learn how to swap them in based on settings + weight availability.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.adapters.base import BeatTrackerAdapter, SkipBartAdapter
from app.adapters.mock import MockBeatTracker, MockSkipBart
from app.config.settings import settings


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


def resolve_adapters() -> ResolvedAdapters:
    beat_real = has_weights(settings.beat_tracker_dir / "weights")
    skip_real = has_weights(settings.skip_bart_dir / "weights")

    # Real adapter implementations land in steps 9/10. Until then, weights
    # being present only changes the registry's reported kind so verify scripts
    # can confirm the discovery path works.
    beat_kind = "real-pending" if beat_real else "mock"
    skip_kind = "real-pending" if skip_real else "mock"

    return ResolvedAdapters(
        beat_tracker=MockBeatTracker(),
        skip_bart=MockSkipBart(),
        beat_tracker_kind=beat_kind,
        skip_bart_kind=skip_kind,
    )
