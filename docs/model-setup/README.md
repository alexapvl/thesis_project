# Model setup

The inference service uses a fixed local model layout. **Do not** hide model paths in developer-specific locations.

## CPU baseline (required path)

```bash
# 1. activate the project's conda env
conda activate uni

# 2. system deps for pyaudio (BeatNet pulls pyaudio for its mic mode; we
#    never use that, but the import is unconditional so the wheel must build)
brew install portaudio

# 3. install Python deps. madmom needs --no-build-isolation because its
#    sdist's pyproject.toml does not declare Cython as a build requirement.
pip install --no-build-isolation -r services/inference/requirements.txt

# 4. create the model directory layout and warm BeatNet
python services/inference/app/scripts/prepare_models.py

# 5. place Skip-BART weights manually (PLAN step 10)
#    models/skip-bart/weights/<checkpoint files>

# 6. verify (layout + torch import + adapter resolve + one-chunk dry-run)
python services/inference/app/scripts/verify_models.py

# 7. run the service
pnpm dev:server
```

`.gitkeep` files in the weights directories are ignored by both verifier and registry.

## Beat tracker — BeatNet+

Real-time beat tracking uses [BeatNet](https://github.com/mjhydri/BeatNet) (Heydari & Lerch, 2021), CRNN + particle filter, online causal mode. The pretrained CRNN weights ship inside the wheel under `BeatNet/models/model_1_weights.pt` — no manual download. `models/beat-tracker/` is kept for any future custom checkpoints.

Behavior summary:
- audio resampled 48 kHz → 22.05 kHz before inference
- BeatNet runs every ~5 chunks (~215 ms) on a 6-second rolling buffer
- pipeline emits `beat.update` for each newly detected beat and `tempo.update` derived from the median inter-beat interval over the last 8 beats

Set `STL_USE_REAL_BEAT_TRACKER=false` to force the mock beat tracker (used by CI, or when BeatNet is intentionally not installed).

## Skip-BART (placeholder)

Currently runs on a mock adapter. The real implementation lands with PLAN step 10. Place weight files under `models/skip-bart/weights/` once available; the registry will mark the adapter as `real-pending` until the real loader is wired.

## Mock vs real models

Empty `models/skip-bart/weights/` produces a startup *warning*, not an error. Set `STL_REQUIRE_REAL_MODELS=true` to make missing weights abort startup.

## Configuration

All paths come from `app/config/settings.py` and are overridable via environment:

| env var | default |
|---|---|
| `STL_MODELS_DIR` | `<repo>/models` |
| `STL_BEAT_TRACKER_DIR` | `<repo>/models/beat-tracker` |
| `STL_SKIP_BART_DIR` | `<repo>/models/skip-bart` |
| `STL_REQUIRE_REAL_MODELS` | `false` |
| `STL_USE_REAL_BEAT_TRACKER` | `true` |

Run `python services/inference/app/scripts/print_config.py` to dump the resolved values.

## CUDA notes (optional)

CPU path must work first. CUDA-specific torch builds are out of scope for the v1 baseline; document them here once needed. BeatNet accepts `device='cuda'` if needed; flip the constructor in `app/adapters/beatnet_adapter.py`.
