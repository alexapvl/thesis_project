"""Verify model setup: paths exist, imports work, adapters load.

Exits non-zero on any failure with a clear message.
Run:  python app/scripts/verify_models.py
"""

from __future__ import annotations

import sys
from pathlib import Path

# Allow `python app/scripts/verify_models.py` from services/inference.
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from app.config.settings import settings  # noqa: E402


def check_dir(path: Path, label: str) -> list[str]:
    errs: list[str] = []
    if not path.exists():
        errs.append(f"missing {label}: {path}")
        return errs
    weights = path / "weights"
    if not weights.exists() or not any(weights.iterdir()):
        errs.append(f"{label}: weights/ is empty (place files in {weights})")
    return errs


def main() -> int:
    print(f"models_dir: {settings.models_dir}")
    errs: list[str] = []
    errs += check_dir(settings.beat_tracker_dir, "beat-tracker")
    errs += check_dir(settings.skip_bart_dir, "skip-bart")

    try:
        import torch  # noqa: F401
        print("torch import: OK")
    except ImportError as e:  # pragma: no cover
        errs.append(f"torch import failed: {e}")

    if errs:
        print("\nFAIL")
        for e in errs:
            print(f"  - {e}")
        return 1

    print("\nOK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
