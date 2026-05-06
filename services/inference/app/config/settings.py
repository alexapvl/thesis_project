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


settings = Settings()
