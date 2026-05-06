"""Prepare local model directories and warm cached weights.

 1. Ensure the fixed model directory layout exists.
 2. Warm BeatNet by instantiating it once. BeatNet's checkpoints ship inside
    the wheel, so the only "download" is the import-time torch graph build;
    we still do it here so that the first audio chunk after server start
    isn't slowed by model load.
 3. Skip-BART weights are still placed manually (PLAN step 10).
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from app.config.settings import settings  # noqa: E402


def _ensure_dirs() -> None:
    for d in (settings.beat_tracker_dir, settings.skip_bart_dir):
        (d / "weights").mkdir(parents=True, exist_ok=True)
        (d / "config").mkdir(parents=True, exist_ok=True)
        print(f"ensured: {d}")


def _warm_beatnet() -> None:
    if not settings.use_real_beat_tracker:
        print("BeatNet warm-up skipped (STL_USE_REAL_BEAT_TRACKER=false).")
        return
    try:
        from app.adapters.beatnet_adapter import BeatNetTracker, is_available
    except Exception as e:  # pragma: no cover - defensive
        print(f"BeatNet adapter not importable: {e}")
        return
    if not is_available():
        print("BeatNet not importable; skipping warm-up. Real beat tracking will fall back to mock.")
        return
    print("warming BeatNet (this loads the CRNN + particle filter)...")
    tracker = BeatNetTracker()
    tracker.load()
    print("BeatNet ready.")


def main() -> int:
    _ensure_dirs()
    _warm_beatnet()
    print("\nNext: place Skip-BART weight files under skip-bart/weights/ (step 10).")
    print("Then run: python app/scripts/verify_models.py")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
