"""Assemble a metrics.report envelope for benchmark runs."""

from __future__ import annotations

from app.api.schemas import MetricsReport, StageSummary
from app.config.settings import settings
from app.pipeline.event_builder import now_ms
from app.services.model_registry import resolve_adapters
from app.utils.profiling import metrics


def device_label() -> str:
    try:
        import torch  # noqa: PLC0415
    except ImportError:
        return settings.device

    if torch.cuda.is_available():
        return f"cuda:{torch.cuda.get_device_name(0)}"
    if getattr(torch.backends, "mps", None) is not None and torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def build_metrics_report(
    session_id: str,
    sequence: int,
    run_id: str,
    chunks_received: int,
    stage_samples: dict[str, list[float]] | None = None,
) -> MetricsReport:
    adapters = resolve_adapters()
    summary = metrics.summary()
    stages = {
        name: StageSummary(
            count=int(data["count"]),
            n=int(data["n"]),
            min_ms=float(data["min_ms"]),
            p50_ms=float(data["p50_ms"]),
            p95_ms=float(data["p95_ms"]),
            max_ms=float(data["max_ms"]),
            avg_ms=float(data["avg_ms"]),
        )
        for name, data in summary.items()
    }
    return MetricsReport(
        version=settings.protocol_version,
        sessionId=session_id,
        timestampMs=now_ms(),
        sequence=sequence,
        runId=run_id,
        stages=stages,
        stageSamples=stage_samples if stage_samples is not None else metrics.dump_samples(),
        chunksReceived=chunks_received,
        device=device_label(),
        beatTrackerKind=adapters.beat_tracker_kind,
        skipBartKind=adapters.skip_bart_kind,
    )
