"""Vendored subset of the Skip-BART research codebase.

Source: https://github.com/RS2002/Skip-BART
Upstream commit: 88e56d1c07460276273fbbed777d248239262ced (2026-02-24)
Authors: Zijian Zhao, Dian Jin, Zijing Zhou, Xiaoyu Zhang
Paper:   "Automatic Stage Lighting Control: Is it a Rule-Driven Process or
          Generative Task?" — ICLR 2026

Only the architecture (`model.py`) and sampling helper (`util.py`) are
vendored, since training / dataset / video-generation utilities are not
needed at inference time. No modifications to the upstream files.
"""

from .model import ML_BART, ML_Classifier  # noqa: F401
from .util import sampling  # noqa: F401
