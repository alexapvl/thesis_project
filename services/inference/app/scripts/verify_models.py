"""Verify model setup end-to-end.

Steps:
 1. validate model directory layout (errors fail; empty weights warn).
 2. import torch.
 3. resolve adapters via the model registry.
 4. drive one synthetic chunk through SessionPipeline and check downstream
    envelopes are produced.

Exits 0 on success, 1 on any error. Warnings do not fail the script unless
STL_REQUIRE_REAL_MODELS=true.

Run:  python app/scripts/verify_models.py
"""

from __future__ import annotations

import base64
import sys
from pathlib import Path

# Allow `python app/scripts/verify_models.py` from services/inference.
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from app.api.schemas import (  # noqa: E402
    AudioChunk,
    LightingUpdate,
    SessionInit,
    SessionReady,
)
from app.config.settings import settings  # noqa: E402
from app.pipeline.session_pipeline import SessionPipeline  # noqa: E402
from app.services.model_registry import resolve_adapters  # noqa: E402
from app.services.startup_validation import (  # noqa: E402
    issues_block_startup,
    validate_setup,
)


def _check_layout() -> int:
    print(f"models_dir: {settings.models_dir}")
    issues = validate_setup()
    for i in issues:
        marker = "ERROR" if i.severity == "error" else "warn"
        print(f"  [{marker}] {i.code}: {i.message}")
    if issues_block_startup(issues):
        print("FAIL: model setup blocks startup")
        return 1
    return 0


def _check_torch() -> int:
    try:
        import torch  # noqa: F401
    except ImportError as e:  # pragma: no cover
        print(f"FAIL: torch import failed: {e}")
        return 1
    print("torch import: OK")
    return 0


def _dry_run() -> int:
    adapters = resolve_adapters()
    print(f"adapters: beat={adapters.beat_tracker_kind} skip-bart={adapters.skip_bart_kind}")

    pipeline = SessionPipeline(adapters.beat_tracker, adapters.skip_bart)
    init_envs = pipeline.on_session_init(
        SessionInit(
            type="session.init",
            version=settings.protocol_version,
            sessionId="verify",
            timestampMs=0.0,
            sequence=1,
            sourceMode="file",
            chunkSize=2048,
            sampleRate=settings.canonical_sample_rate,
            protocolVersion=settings.protocol_version,
            fileMetadata=None,
        )
    )
    if not any(isinstance(e, SessionReady) for e in init_envs):
        print("FAIL: pipeline did not emit session.ready")
        return 1

    pcm_b64 = base64.b64encode(b"\x00\x00\x00\x00" * 2048).decode("ascii")
    total_envs = 0
    lighting_envs = 0
    # Feed enough chunks (~5 s) so the real Skip-BART adapter — which only
    # runs once its rolling window crosses ~2 s of audio — has a chance to
    # emit. The mock emits one frame per chunk and is unaffected.
    for seq in range(1, 121):
        envs = pipeline.on_audio_chunk(
            AudioChunk(
                type="audio.chunk",
                version=settings.protocol_version,
                sessionId="verify",
                timestampMs=float(seq) * (2048.0 / 48.0),
                sequence=seq,
                startOffsetMs=None,
                playbackPositionMs=float(seq) * (2048.0 / 48.0),
                channels=1,
                sampleRate=48000,
                pcm=pcm_b64,
            )
        )
        total_envs += len(envs)
        lighting_envs += sum(1 for e in envs if isinstance(e, LightingUpdate))

    if lighting_envs == 0:
        print(
            f"FAIL: pipeline emitted no lighting.update across 120 chunks "
            f"({total_envs} other envelopes)"
        )
        return 1
    print(f"dry-run: OK ({lighting_envs} lighting.update across 120 chunks)")
    return 0


def main() -> int:
    if (rc := _check_layout()) != 0:
        return rc
    if (rc := _check_torch()) != 0:
        return rc
    if (rc := _dry_run()) != 0:
        return rc
    print("\nOK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
