from __future__ import annotations

from pathlib import Path

import pytest

from app.config.settings import settings
from app.services import startup_validation
from app.services.model_registry import _reset_cache_for_tests, resolve_adapters
from app.services.startup_validation import (
    issues_block_startup,
    validate_setup,
)


@pytest.fixture
def isolated_models(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    monkeypatch.setattr(settings, "models_dir", tmp_path)
    monkeypatch.setattr(settings, "beat_tracker_dir", tmp_path / "beat-tracker")
    monkeypatch.setattr(settings, "skip_bart_dir", tmp_path / "skip-bart")
    monkeypatch.setattr(settings, "require_real_models", False)
    monkeypatch.setattr(settings, "use_real_skip_bart", False)
    return tmp_path


def test_missing_models_root_is_error(isolated_models: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "models_dir", isolated_models / "does-not-exist")
    issues = validate_setup()
    assert any(i.code == "models.root.missing" and i.severity == "error" for i in issues)
    assert issues_block_startup(issues) is True


def test_missing_weights_dirs_are_errors(isolated_models: Path) -> None:
    isolated_models.mkdir(parents=True, exist_ok=True)
    issues = validate_setup()
    codes = {i.code for i in issues}
    assert "models.dir.missing" in codes or "models.weights.dir.missing" in codes
    assert issues_block_startup(issues) is True


def test_empty_weights_warns_but_does_not_block(
    isolated_models: Path,
) -> None:
    for d in (settings.beat_tracker_dir, settings.skip_bart_dir):
        (d / "weights").mkdir(parents=True)
        (d / "config").mkdir(parents=True)
    issues = validate_setup()
    assert all(i.severity == "warning" for i in issues)
    assert issues_block_startup(issues) is False


def test_require_real_models_blocks_on_warnings(
    isolated_models: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    for d in (settings.beat_tracker_dir, settings.skip_bart_dir):
        (d / "weights").mkdir(parents=True)
    monkeypatch.setattr(settings, "require_real_models", True)
    issues = validate_setup()
    assert issues  # warnings present
    assert issues_block_startup(issues) is True


def test_resolve_adapters_reports_kind(
    isolated_models: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    for d in (settings.beat_tracker_dir, settings.skip_bart_dir):
        (d / "weights").mkdir(parents=True)

    # Force the mock path so the test does not depend on BeatNet being
    # importable.
    monkeypatch.setattr(settings, "use_real_beat_tracker", False)
    _reset_cache_for_tests()  # resolve_adapters is memoized in production
    adapters = resolve_adapters()
    assert adapters.beat_tracker_kind == "mock"
    assert adapters.skip_bart_kind == "mock"

    (settings.skip_bart_dir / "weights" / "fake.bin").write_bytes(b"x")
    _reset_cache_for_tests()
    adapters = resolve_adapters()
    assert adapters.skip_bart_kind == "real-pending"


def test_validate_setup_against_real_layout() -> None:
    # Sanity check that the repo's actual layout doesn't error against the
    # validator (it may warn about empty weights, which is expected).
    issues = startup_validation.validate_setup()
    errors = [i for i in issues if i.severity == "error"]
    assert errors == []
