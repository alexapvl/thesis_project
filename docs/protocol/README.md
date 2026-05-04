# Protocol

Schemas live in [`packages/protocol`](../../packages/protocol) (TypeScript / zod) and [`services/inference/app/api/schemas.py`](../../services/inference/app/api/schemas.py) (Python / pydantic). Both must stay in sync.

Envelope: `{ type, version, sessionId, timestampMs, sequence }`.
Canonical audio: mono, 48 kHz, Float32 PCM (base64-encoded over the wire).

See `PLAN.md` § Protocol contract.
