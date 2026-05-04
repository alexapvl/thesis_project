# models/

Local weights and configs for the inference service. **Weights are not committed** (see `.gitignore`).

## Layout

```
models/
  beat-tracker/
    weights/   ← place beat-tracker checkpoint(s) here
    config/
  skip-bart/
    weights/   ← place Skip-BART checkpoint(s) here
    config/
```

## Bootstrap

```bash
conda activate uni
python services/inference/app/scripts/prepare_models.py   # creates folders
# manually place weight files
python services/inference/app/scripts/verify_models.py    # validates layout
```

See [`../docs/model-setup`](../docs/model-setup/) for full instructions.
