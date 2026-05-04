"""Pydantic mirror of `packages/fixtures/schemas/scene.ts` — used by the backend
to validate incoming/imported scene documents (e.g. for future preset endpoints).
The frontend remains the canonical owner of scene state.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

Vec3 = tuple[float, float, float]

SCENE_SCHEMA_VERSION = "1.0.0"


class FixtureInstance(BaseModel):
    id: str
    definitionId: str
    name: str
    enabled: bool
    position: Vec3
    rotation: Vec3
    target: Vec3
    groupId: str | None = None
    overrides: dict[str, object] = {}


class FixtureGroup(BaseModel):
    id: str
    name: str
    fixtureIds: list[str]


class SceneDocument(BaseModel):
    schemaVersion: Literal["1.0.0"]
    id: str
    name: str
    fixtures: list[FixtureInstance]
    groups: list[FixtureGroup]
    selectedFixtureId: str | None = None
