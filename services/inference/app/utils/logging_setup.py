"""Structured logging helpers.

We don't ship a JSON formatter — operators run this service from a terminal
during research work. Instead, we standardize a `key=value` extra-field
suffix so logs grep cleanly and each line carries the session id, stage,
and relevant counters. Example:

    INFO stl.ws session.init session_id=abc mode=file proto=1.0.0

`kv(...)` is the single chokepoint; do not f-string structured fields by
hand because quoting/spacing drift between callsites.
"""

from __future__ import annotations

import logging
from typing import Any


def kv(**fields: Any) -> str:
    """Render keyword args as a stable `key=value` suffix.

    Values containing spaces or `=` are quoted. `None` is rendered as
    the literal string `none` so absence is visible in logs (rather than
    the field being silently omitted).
    """
    parts: list[str] = []
    for key, value in fields.items():
        if value is None:
            parts.append(f"{key}=none")
            continue
        s = str(value)
        if " " in s or "=" in s or '"' in s:
            s = '"' + s.replace('"', '\\"') + '"'
        parts.append(f"{key}={s}")
    return " ".join(parts)


def configure_logging(level: str = "INFO") -> None:
    """Set the root handler if nothing else has. Idempotent and safe to call
    from both the FastAPI lifespan and from scripts.
    """
    root = logging.getLogger()
    if root.handlers:
        root.setLevel(level)
        return
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
        datefmt="%H:%M:%S",
    )
