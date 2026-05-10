"""Vendored patches for BeatNet+ (https://github.com/mjhydri/BeatNet).

Only `particle_filtering_cascade.py` is vendored; everything else is used
from the upstream installed package. The patch lowers the particle
filter's beat- and downbeat-activation commit thresholds from 0.4 to
0.25 because BeatNet's defaults are tuned for benchmark precision
(missing a beat is preferred over committing a false one). For a live
lighting use case the tradeoff is reversed: missed beats produce
visibly dead patches in the music, while a slight over-fire is cheap.

The adapter installs the vendored module into `sys.modules` under the
`BeatNet.particle_filtering_cascade` key BEFORE BeatNet itself imports
the original. See `app/adapters/beatnet_adapter.py::_install_pf_patch`.

Upstream license: MIT. This vendored copy carries the same license; see
the file header preserved at the top of `particle_filtering_cascade.py`.
"""
