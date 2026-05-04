from __future__ import annotations


class ProtocolError(Exception):
    """Raised when an upstream message fails validation."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(f"{code}: {message}")
        self.code = code
        self.message = message


class SessionError(Exception):
    """Raised for session lifecycle errors."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(f"{code}: {message}")
        self.code = code
        self.message = message
