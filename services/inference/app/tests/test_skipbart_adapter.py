"""Smoke tests for the real Skip-BART adapter.

Skipped automatically when transformers/peft/openl3 cannot be imported, or
when the trained weight files are not present. The full smoke test is
expensive (loads a 240M-parameter BART), so it only runs when explicitly
opted in.
"""

from __future__ import annotations

import os

import pytest

from app.config.settings import settings


pytest.importorskip("transformers")
pytest.importorskip("peft")
pytest.importorskip("openl3")

from app.adapters.skipbart_adapter import (  # noqa: E402
    has_required_weights,
    is_available,
    required_weight_files,
)


def test_required_weight_files_listed() -> None:
    names = required_weight_files()
    assert "bart_finetune.pth" in names
    assert "head_finetune.pth" in names


def test_is_available_truthy_when_deps_importable() -> None:
    # We already importorskip'd the heavy deps above, so is_available()
    # should be True regardless of weights.
    assert is_available() is True


def test_has_required_weights_false_when_missing(tmp_path) -> None:
    assert has_required_weights(tmp_path) is False


@pytest.mark.skipif(
    os.environ.get("STL_RUN_SKIPBART_SMOKE") != "1",
    reason="Set STL_RUN_SKIPBART_SMOKE=1 to run the heavy load+decode smoke test",
)
def test_load_and_emit_with_silence() -> None:
    from app.adapters.skipbart_adapter import SkipBartGenerator
    from app.domain.models import AudioChunk

    if not has_required_weights(settings.skip_bart_dir / "weights"):
        pytest.skip("Skip-BART weights not installed")

    gen = SkipBartGenerator()
    gen.load()
    gen.reset()

    pcm_zero = (b"\x00\x00\x00\x00") * 2048
    for seq in range(120):
        gen.ingest(
            AudioChunk(
                session_id="smoke",
                sequence=seq,
                timestamp_ms=seq * (2048.0 / 48.0),
                playback_position_ms=seq * (2048.0 / 48.0),
                sample_rate=48000,
                channels=1,
                pcm=pcm_zero,
            )
        )
    preds = gen.get_predictions()
    assert preds, "expected at least one prediction after ~5 s of audio"
    for p in preds:
        assert 0.0 <= p.hue < 360.0
        assert 0.0 <= p.value <= 1.0
