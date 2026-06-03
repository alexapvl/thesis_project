from __future__ import annotations

from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[4]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="STL_", env_file=".env", extra="ignore")

    protocol_version: str = "1.0.0"
    canonical_sample_rate: int = 48000
    canonical_channels: int = 1
    chunk_size_default: int = 4800  # 100 ms at 48 kHz

    models_dir: Path = Field(default=REPO_ROOT / "models")
    beat_tracker_dir: Path = Field(default=REPO_ROOT / "models" / "beat-tracker")
    skip_bart_dir: Path = Field(default=REPO_ROOT / "models" / "skip-bart")

    log_level: str = "INFO"

    # When true, startup aborts if real model weights are missing. When false
    # (v1 default), the service runs on mock adapters and only logs warnings.
    require_real_models: bool = False

    # When true (default), the model registry tries to load BeatNet for beat
    # tracking; on import failure it falls back to the mock adapter. Set
    # STL_USE_REAL_BEAT_TRACKER=false to force the mock (used by CI / tests).
    use_real_beat_tracker: bool = True

    # BeatNet pretrained checkpoint. The repo ships three:
    #   1 = GTZAN (broad / default)
    #   2 = Ballroom (dance, very rhythmic)
    #   3 = Rock_corpus (rock genre)
    # Pick the one closest to the music being played for tighter tracking.
    beatnet_model: int = 1

    # Soft auto-gain on the audio buffer fed to BeatNet. BeatNet's docs say
    # "as loud input as possible" — quiet tracks give the network a weak
    # signal and produce wobblier beat estimates. This flag is server-side
    # only; the user's playback path is unaffected.
    beatnet_normalize_input: bool = True

    # Beat/downbeat activation threshold used by our vendored copy of
    # BeatNet's particle filter (see vendor/beatnet_patched/). Upstream is
    # 0.4 — tuned for benchmark precision; we lower it to 0.25 for live
    # lighting where missing a beat is worse than firing an extra one.
    # Bumping toward 0.4 trades recall for fewer false positives.
    beatnet_activation_threshold: float = 0.25

    # When true, attempt to load the real Skip-BART (requires repo + weights +
    # transformers/peft/openl3). Falls back to mock on any import / load
    # failure. Default false: Skip-BART is heavy (240M params) and CPU-only
    # inference is too slow for hard real-time, so it stays opt-in.
    use_real_skip_bart: bool = False

    # Inference device for torch models: auto (cuda→mps→cpu), or force
    # cuda / mps / cpu. Set STL_DEVICE=mps on Mac, STL_DEVICE=cuda on Windows.
    device: str = "auto"


settings = Settings()
