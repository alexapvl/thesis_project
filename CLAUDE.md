# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Source of truth

The architecture is binding and lives in `../PLAN.md` (repo-root `PLAN.md`). Read it before making structural decisions. The "Non-negotiable architecture rules" and "Required guardrails for the coding agent" sections override default instincts.

## Layout

Monorepo (pnpm workspaces) + a Python service:

- `apps/web` — Vite + React + R3F frontend. Audio I/O, scene editor, transport client, Zustand store, 3D rendering.
- `services/inference` — FastAPI WebSocket server. Beat tracking, Skip-BART inference, model lifecycle. Runs in conda env `uni` (Python 3.11).
- `packages/protocol` — Shared WebSocket protocol (zod schemas + types). Mirror in `services/inference/app/api/schemas.py` (pydantic). **Both must stay in sync.**
- `packages/fixtures` — Fixture definitions, scene-document schema, presets.
- `packages/config/{eslint,typescript}` — Shared TS / ESLint config consumed by every TS package.
- `models/` — Local model weights (gitignored). Layout enforced by `services/inference/app/scripts/prepare_models.py`.

## Common commands

```bash
# Install JS deps (run from repo root)
pnpm install

# Frontend dev server (Vite, port 5173, /ws proxied to :8000)
pnpm dev                 # alias for: pnpm --filter web dev

# Backend dev server (FastAPI + uvicorn, port 8000)
conda activate uni
pip install -r services/inference/requirements.txt   # one-time
pnpm dev:server          # uvicorn app.api.ws:app --reload --app-dir services/inference

# Build everything
pnpm build               # builds packages first, then web

# Lint / typecheck (workspace-wide)
pnpm lint
pnpm typecheck

# Format
pnpm format
pnpm format:check

# Python tests (from services/inference)
pytest                          # all
pytest app/tests/test_protocol_schemas.py::test_session_init_roundtrips   # one test

# Model setup
python services/inference/app/scripts/prepare_models.py   # ensures folders
python services/inference/app/scripts/verify_models.py    # validates + imports torch
python services/inference/app/scripts/print_config.py     # dump resolved settings
```

## Architecture invariants (read PLAN.md for full list)

1. **Browser/server split is fixed.** No inference logic in the browser.
2. **Transport contract is canonical and source-independent.** All upstream audio is mono, 48 kHz, Float32 PCM, chunked, sequenced, base64 over WS. File and microphone modes converge *before* transport.
3. **All WebSocket payloads go through the protocol package.** No ad-hoc message shapes anywhere in app code.
4. **Scene state must not live only inside Three.js objects.** All edits mutate the `SceneDocument` (in `packages/fixtures/schemas/scene.ts`); R3F renders from it. Undo/redo operates on scene-document changes.
5. **Runtime lighting state and scene-document state are separate but compatible.** Don't merge them; map runtime → fixture render state in `apps/web/src/scene/mappers/`.
6. **Heavy dependencies live behind adapters** in `services/inference/app/adapters/`. Models are loaded through `BeatTrackerAdapter` / `SkipBartAdapter` only — never touch torch from `pipeline/` or `api/`.
7. **Seek keeps the WebSocket open** but sends `session.seek` with `resetInference: true`; backend resets context, frontend keeps streaming from the new playback position.
8. **File flow first, microphone second.** Both must reuse the same audio graph, chunk encoder, and transport messages.
9. **Groups are editor-level only in v1.** Do not invent runtime semantics for groups.
10. **Model paths come from `app/config/settings.py`.** Never hardcode developer-specific paths.

## Where things go

- New WS message type: add to `packages/protocol/src/messages.ts` AND `services/inference/app/api/schemas.py`. Add a discriminator branch on both sides. Update `docs/protocol/README.md` if the envelope changes.
- New fixture type: definition in `packages/fixtures/definitions/`, R3F component in `apps/web/src/scene/fixtures/`. Catalog UI consumes the definition; runtime mapping consumes overrides through `mapLightingFrame`.
- New backend feature: prefer adding to `pipeline/` (orchestration) or a new adapter. Don't extend `api/ws.py` past dispatch.
- New frontend store slice: register in `apps/web/src/store/`. Render loop must not subscribe to the whole store (PLAN's hard rule).

## Mocks vs real models

`services/inference/app/adapters/mock.py` provides deterministic fake adapters. The pipeline should run end-to-end with mocks before real models are wired in (PLAN steps 7 → 9 → 10). Replacing a mock must not require frontend changes.

## Conda env

The Python env is `uni` (Python 3.11.8). Already has torch, numpy, pydantic, uvicorn, websockets. Adding deps: append to `services/inference/requirements.txt` and `pip install -r ...` inside `uni`.

## Style

- TS: strict mode, `noUncheckedIndexedAccess`, ESLint + Prettier (single quotes, trailing commas, 100-col).
- Python: ruff + black, line length 100, target py311.
- File naming: TS uses kebab-case for files except React components (PascalCase); Python uses snake_case.

## Thesis paper

The companion LaTeX thesis lives in `../thesis_paper/` (separate git repo). Don't edit it from this project; cross-link via filenames in commit messages if relevant.
