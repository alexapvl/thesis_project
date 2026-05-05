"""Per-session rolling buffer of recent PCM bytes.

Kept tiny and dependency-free for v1: a deque of (sequence, raw_pcm) entries
capped at a fixed total byte budget. The real beat tracker / Skip-BART path
will read from here instead of the live chunk stream so seek resets can drop
all historical context atomically.
"""

from __future__ import annotations

from collections import deque


class AudioRingBuffer:
    def __init__(self, max_bytes: int) -> None:
        self._max_bytes = max_bytes
        self._chunks: deque[tuple[int, bytes]] = deque()
        self._total_bytes = 0

    def append(self, sequence: int, pcm: bytes) -> None:
        self._chunks.append((sequence, pcm))
        self._total_bytes += len(pcm)
        while self._total_bytes > self._max_bytes and self._chunks:
            _, dropped = self._chunks.popleft()
            self._total_bytes -= len(dropped)

    def reset(self) -> None:
        self._chunks.clear()
        self._total_bytes = 0

    def total_bytes(self) -> int:
        return self._total_bytes

    def chunk_count(self) -> int:
        return len(self._chunks)
