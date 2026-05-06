"""Validate model setup before the service starts taking traffic.

Runs at FastAPI startup. Returns the list of issues so callers can either
log warnings (default) or abort the boot when `STL_REQUIRE_REAL_MODELS=true`.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from app.config.settings import settings
from app.services.model_registry import has_weights


@dataclass(frozen=True)
class ValidationIssue:
    severity: str  # "error" | "warning"
    code: str
    message: str


def _check_dir(path: Path, label: str) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []
    if not path.exists():
        issues.append(
            ValidationIssue("error", "models.dir.missing", f"missing {label} dir: {path}")
        )
        return issues
    weights = path / "weights"
    if not weights.exists():
        issues.append(
            ValidationIssue(
                "error",
                "models.weights.dir.missing",
                f"{label}: weights dir missing at {weights}",
            )
        )
        return issues
    if not has_weights(weights):
        issues.append(
            ValidationIssue(
                "warning",
                "models.weights.empty",
                f"{label}: no weight files in {weights} — running on mock adapter",
            )
        )
    return issues


def validate_setup() -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []
    if not settings.models_dir.exists():
        issues.append(
            ValidationIssue(
                "error",
                "models.root.missing",
                f"models_dir does not exist: {settings.models_dir}",
            )
        )
        return issues
    issues += _check_dir(settings.beat_tracker_dir, "beat-tracker")
    issues += _check_dir(settings.skip_bart_dir, "skip-bart")
    return issues


def issues_block_startup(issues: list[ValidationIssue]) -> bool:
    """When require_real_models is set, both errors AND warnings block startup."""
    if settings.require_real_models:
        return any(True for _ in issues)
    return any(i.severity == "error" for i in issues)
