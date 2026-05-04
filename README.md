# sound-to-light

Real-time MIR-driven generative stage lighting. Browser client (audio I/O, scene editor, 3D rendering) + Python inference server (beat tracking, Skip-BART).

See [`PLAN.md`](../PLAN.md) for the binding architecture plan.

## Layout

```
apps/web                  Vite + React + R3F frontend
services/inference        FastAPI inference server (conda env: uni)
packages/protocol         Shared WebSocket protocol types + validation
packages/fixtures         Fixture definitions, presets, schemas
packages/config           Shared ESLint / TypeScript config
models/                   Local weights (manual placement, gitignored)
docs/                     Architecture, protocol, scene-model, model-setup notes
```

## Prerequisites

- Node 20+ and pnpm 9+
- Miniconda with the `uni` env (Python 3.11)

## Setup

```bash
# JS workspace
pnpm install

# Python service
conda activate uni
pip install -r services/inference/requirements.txt
```

## Run dev

```bash
# Terminal 1 — frontend
pnpm --filter web dev

# Terminal 2 — backend
conda activate uni
pnpm dev:server   # or: uvicorn app.api.ws:app --reload --app-dir services/inference
```

## Verify model setup

```bash
conda activate uni
python services/inference/app/scripts/verify_models.py
```

See [`docs/model-setup`](docs/model-setup) for placing weights.
