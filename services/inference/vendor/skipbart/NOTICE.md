# Skip-BART (vendored)

Files in this directory are copied verbatim from the Skip-BART research
codebase by Zhao et al. (2025).

- **Upstream**: <https://github.com/RS2002/Skip-BART>
- **Commit**: `88e56d1c07460276273fbbed777d248239262ced` (2026-02-24)
- **Paper**: Zijian Zhao, Dian Jin, Zijing Zhou, Xiaoyu Zhang. *"Automatic
  Stage Lighting Control: Is it a Rule-Driven Process or Generative Task?"*
  ICLR 2026.
- **Weights**: `RS2002/Skip-BART` on Hugging Face — `trained.zip` contains
  `bart_finetune.pth` and `head_finetune.pth`. Place under
  `models/skip-bart/weights/`.

Only the inference-relevant files are vendored:

- `model.py` — `ML_BART`, `ML_Classifier`, `MLP` definitions
- `util.py` — `sampling` (nucleus + temperature)

Training, dataset, and video-generation utilities are intentionally not
copied. No upstream modifications.
