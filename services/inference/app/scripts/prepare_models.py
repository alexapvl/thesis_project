"""Prepare local model directories.

For now this only ensures the folder layout exists. Weight downloads are
manual (see docs/model-setup) — licensing/access prevents automation.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from app.config.settings import settings  # noqa: E402


def main() -> int:
    for d in (settings.beat_tracker_dir, settings.skip_bart_dir):
        (d / "weights").mkdir(parents=True, exist_ok=True)
        (d / "config").mkdir(parents=True, exist_ok=True)
        print(f"ensured: {d}")
    print("\nNext: place weight files under each model's weights/ directory.")
    print("Then run: python app/scripts/verify_models.py")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
