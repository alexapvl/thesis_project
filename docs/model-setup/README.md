# Model setup

The inference service uses a fixed local model layout. **Do not** hide model paths in developer-specific locations.

## CPU baseline (required path)

```bash
# 1. activate the project's conda env
conda activate uni

# 2. install Python deps
pip install -r services/inference/requirements.txt

# 3. create the model directory layout
python services/inference/app/scripts/prepare_models.py

# 4. place weight files manually
#    models/beat-tracker/weights/<checkpoint files>
#    models/skip-bart/weights/<checkpoint files>

# 5. verify (layout + torch import + one-chunk pipeline dry-run)
python services/inference/app/scripts/verify_models.py

# 6. run the service
pnpm dev:server
```

`.gitkeep` files in the weights directories are ignored by both verifier and registry.

## Mock vs real models

The service ships with mock adapters and runs without weights by default. Empty `weights/` directories produce a startup *warning*, not an error. To require real weights, set `STL_REQUIRE_REAL_MODELS=true` — startup will then abort if any weights directory is empty.

The model registry (`app/services/model_registry.py`) reports each adapter as `mock` or `real-pending` based on whether a non-`.gitkeep` file is present. Real adapter implementations land with PLAN steps 9 (beat tracker) and 10 (Skip-BART).

## Configuration

All paths come from `app/config/settings.py` and are overridable via environment:

| env var | default |
|---|---|
| `STL_MODELS_DIR` | `<repo>/models` |
| `STL_BEAT_TRACKER_DIR` | `<repo>/models/beat-tracker` |
| `STL_SKIP_BART_DIR` | `<repo>/models/skip-bart` |
| `STL_REQUIRE_REAL_MODELS` | `false` |

Run `python services/inference/app/scripts/print_config.py` to dump the resolved values.

## CUDA notes (optional)

CPU path must work first. CUDA-specific torch builds are out of scope for the v1 baseline; document them here once needed.
