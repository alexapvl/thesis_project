from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.domain.scene import SCENE_SCHEMA_VERSION, SceneDocument


def test_empty_scene_validates() -> None:
    doc = SceneDocument(
        schemaVersion=SCENE_SCHEMA_VERSION,
        id="scene-1",
        name="Untitled",
        fixtures=[],
        groups=[],
        selectedFixtureId=None,
    )
    assert doc.fixtures == []


def test_wrong_schema_version_rejected() -> None:
    with pytest.raises(ValidationError):
        SceneDocument(
            schemaVersion="0.0.0",  # type: ignore[arg-type]
            id="scene-1",
            name="x",
            fixtures=[],
            groups=[],
            selectedFixtureId=None,
        )


def test_fixture_instance_with_position() -> None:
    doc = SceneDocument(
        schemaVersion=SCENE_SCHEMA_VERSION,
        id="s",
        name="s",
        fixtures=[
            {
                "id": "f1",
                "definitionId": "builtin.spot",
                "name": "Spot 1",
                "enabled": True,
                "position": (0.0, 4.0, 0.0),
                "rotation": (0.0, 0.0, 0.0),
                "target": (0.0, 0.0, 0.0),
                "groupId": None,
                "overrides": {},
            }
        ],  # type: ignore[list-item]
        groups=[],
        selectedFixtureId=None,
    )
    assert doc.fixtures[0].position == (0.0, 4.0, 0.0)
