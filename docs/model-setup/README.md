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

# 5. verify
python services/inference/app/scripts/verify_models.py

# 6. run the service
pnpm dev:server
```

## CUDA notes (optional)

CPU path must work first. CUDA-specific torch builds are out of scope for the v1 baseline; document them here once needed.
