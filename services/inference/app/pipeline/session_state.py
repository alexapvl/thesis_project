"""Per-session mutable state. Kept narrow on purpose."""

from __future__ import annotations

from dataclasses import dataclass, field

from app.domain.models import SessionConfig


@dataclass
class SessionState:
    config: SessionConfig
    out_sequence: int = 0
    chunks_received: int = 0
    last_playback_position_ms: float | None = None
    seek_count: int = 0
    last_beat_emit_seq: int = field(default=-1)

    def next_seq(self) -> int:
        self.out_sequence += 1
        return self.out_sequence

    def reset_inference(self, new_position_ms: float) -> None:
        self.seek_count += 1
        self.last_playback_position_ms = new_position_ms
        self.chunks_received = 0
        self.last_beat_emit_seq = -1
