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

# 5. (optional) place Skip-BART weights — see "Skip-BART" section below
#    models/skip-bart/weights/bart_finetune.pth
#    models/skip-bart/weights/head_finetune.pth

# 6. verify (layout + torch import + adapter resolve + dry-run)
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

## Skip-BART

Generative lighting uses [Skip-BART](https://github.com/RS2002/Skip-BART) (Zhao et al., ICLR 2026). The architecture (`model.py`, `util.py`) is vendored under `services/inference/vendor/skipbart/` (see its `NOTICE.md` for the upstream commit). The 240M-parameter weights are not redistributable here and must be downloaded separately.

### Weights

Download `trained.zip` from <https://huggingface.co/RS2002/Skip-BART/blob/main/trained.zip>, extract, and place the two checkpoint files under `models/skip-bart/weights/`:

```
models/skip-bart/weights/
├── bart_finetune.pth    # BART backbone + LoRA weights (~960 MB FP32)
└── head_finetune.pth    # MLP classifier heads
```

### Enabling the real adapter

```bash
export STL_USE_REAL_SKIP_BART=true   # opt-in (default: false → mock)
python services/inference/app/scripts/verify_models.py
```

If deps are missing, weight files are missing, or `is_available()` fails, the registry falls back to `MockSkipBart` and logs a warning instead of aborting. Set `STL_REQUIRE_REAL_MODELS=true` to make the warning a hard error.

### Streaming approximation (caveats)

Skip-BART is autoregressive over a fixed sequence (max 1024 frames) and was trained for offline generation, not streaming. The adapter approximates streaming with a sliding window:

- 10-second rolling raw-audio buffer at 48 kHz
- OpenL3 embeddings extracted at 10 fps (512-dim, music content type)
- Re-runs full-sequence autoregressive RSTC sampling roughly once per second
- Emits only frames whose timestamp is past the last-emitted cursor, so older frames are not re-published with different sampled values

Implications:
- Output is 10 Hz, not per-chunk, so `lighting.update` arrives in bursts.
- CPU inference is too slow for hard real-time. Use CUDA when possible (the adapter auto-selects `cuda` if `torch.cuda.is_available()`).
- Sampling is stochastic (RSTC: nucleus + temperature with hue/value distance restriction), so consecutive runs over overlapping audio produce different sequences. The adapter trades coherence for streaming feasibility.

### Seek behaviour

`session.seek` with `resetInference: true` calls `SkipBartGenerator.reset()`, which drops the audio buffer, resets the emit cursor, and forces the next window to start fresh — no decoder state leaks across the seek.

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
| `STL_USE_REAL_SKIP_BART` | `false` |
| `STL_DEVICE` | `auto` (`cuda` → `mps` → `cpu`) |

Run `python services/inference/app/scripts/print_config.py` to dump the resolved values.

## CUDA

The CPU baseline above must still work first (CI, Mac dev without a GPU). CUDA is in scope and recommended for real-time Skip-BART on machines with an NVIDIA GPU.

### PyTorch with CUDA

The `uni` conda env may ship a CPU-only `torch` build. On Windows or Linux with an NVIDIA driver installed, reinstall torch with the matching [CUDA wheel](https://pytorch.org/get-started/locally/) before enabling Skip-BART:

```bash
conda activate uni
# Example: CUDA 12.4 — pick the index URL that matches your driver/toolkit
pip install torch --index-url https://download.pytorch.org/whl/cu124
python -c "import torch; print(torch.cuda.is_available(), torch.cuda.get_device_name(0))"
```

### Device selection

`STL_DEVICE` controls where torch models run: `auto` (default), `cuda`, `mps`, or `cpu`. With `auto`, adapters pick `cuda` when `torch.cuda.is_available()`, else `mps` on Apple Silicon, else `cpu`. Skip-BART reads this from `app/config/settings.py`. Examples: `STL_DEVICE=cuda` on Windows (`services/inference/run_windows.bat`), `STL_DEVICE=mps` on Mac (root `Makefile`).
