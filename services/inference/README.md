# inference service

FastAPI WebSocket server for beat tracking and Skip-BART inference.

## Env

```bash
conda activate uni
pip install -r requirements.txt
```

## Run

```bash
uvicorn app.api.ws:app --reload --app-dir . --host 0.0.0.0 --port 8000
# or from repo root:
pnpm dev:server
```

WebSocket endpoint: `ws://localhost:8000/ws`

## Verify model setup

```bash
python app/scripts/verify_models.py
```

## Layout

```
app/
  api/         WebSocket endpoint + schemas + errors
  pipeline/    Session orchestration, audio buffer, event builder
  adapters/    BeatTracker, SkipBart, pre/post-processing
  domain/      Pure data models
  services/    Session manager, model registry, logger, startup checks
  config/      Settings (paths, sample rate, etc.)
  scripts/     prepare_models.py, verify_models.py, print_config.py
  tests/
```
