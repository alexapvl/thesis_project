"""Dev-only uvicorn launcher.

Disables the WebSocket protocol-level keepalive ping. The Vite dev proxy
between the browser (5173) and this server (8000) does not reliably
relay control frames (ping/pong, opcodes 0x9/0xA), so the default
20-second server-side ping repeatedly times out and closes the
connection with 1011 ("keepalive ping timeout") even when the actual
session is healthy.

We already have an application-layer ping (`client.ping` / `server.pong`,
5-second interval) that runs over data frames and is unaffected by the
proxy issue, so dropping the protocol-level ping costs nothing.

This launcher is for `pnpm dev:server` only; in production the WS
connection is direct, no proxy, and the default keepalive should be
re-enabled.
"""

from __future__ import annotations

import uvicorn


def main() -> None:
    uvicorn.run(
        "app.api.ws:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        ws_ping_interval=None,
        ws_ping_timeout=None,
    )


if __name__ == "__main__":
    main()
