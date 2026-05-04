from __future__ import annotations

from app.config.settings import settings


def test_protocol_version_is_semver_triple() -> None:
    parts = settings.protocol_version.split(".")
    assert len(parts) == 3
    assert all(p.isdigit() for p in parts)


def test_protocol_version_major_is_one() -> None:
    """v1 contract — bump deliberately, not accidentally."""
    assert settings.protocol_version.split(".")[0] == "1"
