"""Real Skip-BART adapter (Zhao et al. 2025, ICLR 2026).

Skip-BART is autoregressive over a fixed-length input sequence (max 1024
frames at 10 fps = ~102 s). It was not designed for streaming. We approximate
streaming with a sliding window:

  1. Append incoming Float32 PCM chunks to a rolling raw-audio buffer.
  2. Periodically (every ~1 s), compute OpenL3 audio embeddings on the buffer.
  3. Run autoregressive decoding (RSTC sampling — restricted nucleus sampling
     with hue/value distance limits) over the embedding window.
  4. Emit only frames whose absolute timestamp is past the last-emitted
     cursor, so older frames are not re-published with different sampled
     values.

This re-runs whole-sequence inference on each window and is not cheap. On
CPU/MPS one inference can take 1–7 s while the chunk pipeline ticks at
~43 ms. To avoid blocking beat tracking and the rest of the chunk path,
Skip-BART runs in a **background worker thread**:

  * `ingest(chunk)` pushes the chunk onto an internal queue and returns
    immediately.
  * The worker drains the queue into the rolling buffer and runs
    inference when the chunk-count threshold is met.
  * `get_predictions()` non-blockingly drains the output queue of any
    predictions the worker has produced since the last call.

The pipeline interface (ingest/get_predictions/reset) is unchanged. The
trade-off is that lighting updates lag the audio they were inferred from
by up to one inference duration. Beat tracking — which lives in a
different adapter on the sync path — stays real-time.

Imports the architecture from the vendored snapshot at
`services/inference/vendor/skipbart/` (see its `NOTICE.md` for upstream
attribution). Weights (`bart_finetune.pth`, `head_finetune.pth`) live in
`models/skip-bart/weights/`.
"""

from __future__ import annotations

import logging
import queue
import threading
from pathlib import Path
from typing import Any

import numpy as np

from app.config.settings import settings
from app.domain.models import AudioChunk, LightingPrediction

log = logging.getLogger(__name__)

OPENL3_SAMPLE_RATE = 48000
OPENL3_HOP_SIZE = 0.1  # seconds → 10 fps
OPENL3_EMBEDDING_DIM = 512

# Window of audio kept for inference. Skip-BART's max_position_embeddings is
# 1024 frames; we use a much shorter window to bound latency. 10 s is enough
# context for the model to settle into a coherent hue while keeping decode
# under a few hundred ms on CUDA.
WINDOW_SECONDS = 10.0
MIN_WINDOW_SECONDS_TO_RUN = 2.0
MIN_CHUNKS_BETWEEN_RUNS = 50  # ~1 s at 2048 samples / 48 kHz

# RSTC sampling defaults from the upstream `generate.py`.
DEFAULT_NUCLEUS_P = (0.9, 0.9)
DEFAULT_TEMPERATURE = (1.1, 1.1)
DEFAULT_HUE_RANGE = 50
DEFAULT_VALUE_RANGE = (50, 50)

# Skip-BART output token vocab.
HUE_CLASSES = 180  # 0..179, 180 = pad
VALUE_CLASSES = 256  # 0..255, 256 = pad

# Architecture defaults from upstream `generate.py`.
ARCH_LAYERS = 8
ARCH_HEADS = 8
ARCH_HS = 1024
ARCH_FFN = 2048
ARCH_MAX_LEN = 1024


def is_available() -> bool:
    """True iff every Skip-BART runtime dep imports in this env."""
    try:
        import openl3  # type: ignore[import-not-found]  # noqa: F401
        import peft  # noqa: F401
        import torch  # noqa: F401
        import transformers  # noqa: F401
    except Exception as e:  # pragma: no cover
        log.debug("Skip-BART runtime deps not importable: %s", e)
        return False
    try:
        from vendor.skipbart import ML_BART  # noqa: F401, PLC0415
    except Exception as e:  # pragma: no cover
        log.debug("Vendored Skip-BART not importable: %s", e)
        return False
    return True


def required_weight_files() -> tuple[str, str]:
    return ("bart_finetune.pth", "head_finetune.pth")


def has_required_weights(weights_dir: Path) -> bool:
    return all((weights_dir / name).exists() for name in required_weight_files())


def select_torch_device(torch: Any, preference: str) -> Any:
    """Pick a torch device from settings.device (auto|cuda|mps|cpu)."""
    pref = preference.strip().lower()
    if pref not in {"auto", "cuda", "mps", "cpu"}:
        log.warning("Unknown STL_DEVICE=%r; using auto", preference)
        pref = "auto"

    def auto_device() -> Any:
        if torch.cuda.is_available():
            return torch.device("cuda")
        if getattr(torch.backends, "mps", None) is not None and torch.backends.mps.is_available():
            return torch.device("mps")
        return torch.device("cpu")

    if pref == "auto":
        return auto_device()

    if pref == "cuda":
        if torch.cuda.is_available():
            return torch.device("cuda")
        log.warning("STL_DEVICE=cuda requested but CUDA unavailable; falling back to auto")
        return auto_device()

    if pref == "mps":
        if getattr(torch.backends, "mps", None) is not None and torch.backends.mps.is_available():
            return torch.device("mps")
        log.warning("STL_DEVICE=mps requested but MPS unavailable; falling back to auto")
        return auto_device()

    return torch.device("cpu")


class SkipBartGenerator:
    """Wraps ML_BART + ML_Classifier so it satisfies the SkipBartAdapter Protocol."""

    def __init__(self) -> None:
        self._loaded: bool = False
        self._bart: Any = None
        self._head: Any = None
        self._device: Any = None
        self._sampling: Any = None  # upstream util.sampling

        self._buffer: np.ndarray = np.zeros(0, dtype=np.float32)
        self._buffer_start_ms: float | None = None
        self._buffer_sample_rate: int = OPENL3_SAMPLE_RATE
        self._chunks_since_run: int = 0
        self._last_emitted_ms: float = -1.0
        self._session_id: str = ""

        # Worker-thread plumbing. `_in_queue` carries `(generation, chunk)`
        # so the worker can drop chunks queued before a reset. `_generation`
        # is bumped on every reset() and the worker checks it both when
        # pulling a chunk and again before pushing an inference result —
        # any work from a previous generation is discarded mid-flight.
        # All buffer state below the lock belongs to the worker thread.
        self._in_queue: queue.Queue[tuple[int, AudioChunk]] = queue.Queue()
        self._out_queue: queue.Queue[LightingPrediction] = queue.Queue()
        self._worker_thread: threading.Thread | None = None
        self._stop_event: threading.Event = threading.Event()
        self._generation: int = 0
        self._gen_lock: threading.Lock = threading.Lock()

    # ── lifecycle ────────────────────────────────────────────────────────────

    def load(self) -> None:
        if self._loaded:
            return

        import torch  # noqa: PLC0415
        from peft import get_peft_model  # noqa: PLC0415
        from transformers import BartConfig  # noqa: PLC0415

        from vendor.skipbart import ML_BART, ML_Classifier, sampling  # noqa: PLC0415

        weights_dir = settings.skip_bart_dir / "weights"
        if not has_required_weights(weights_dir):
            missing = [
                name for name in required_weight_files()
                if not (weights_dir / name).exists()
            ]
            raise RuntimeError(
                f"Skip-BART weights missing in {weights_dir}: {missing}. "
                "Download trained.zip from https://huggingface.co/RS2002/Skip-BART"
            )

        # STL_DEVICE controls device selection (auto|cuda|mps|cpu). MPS coverage
        # in transformers/peft is good but not 100%; PYTORCH_ENABLE_MPS_FALLBACK=1
        # makes unsupported ops silently fall back to CPU instead of erroring.
        device = select_torch_device(torch, settings.device)

        bartconfig = BartConfig(
            max_position_embeddings=ARCH_MAX_LEN,
            d_model=ARCH_HS,
            encoder_layers=ARCH_LAYERS,
            encoder_ffn_dim=ARCH_FFN,
            encoder_attention_heads=ARCH_HEADS,
            decoder_layers=ARCH_LAYERS,
            decoder_ffn_dim=ARCH_FFN,
            decoder_attention_heads=ARCH_HEADS,
        )

        bart = ML_BART(bartconfig, class_num=[HUE_CLASSES, VALUE_CLASSES]).to(device)
        head = ML_Classifier(
            hidden_dim=ARCH_HS, class_num=[HUE_CLASSES, VALUE_CLASSES]
        ).to(device)
        bart.bart = get_peft_model(bart.bart, bart.lora_config)

        bart.load_state_dict(
            torch.load(weights_dir / "bart_finetune.pth", map_location=device),
            strict=True,
        )
        head.load_state_dict(
            torch.load(weights_dir / "head_finetune.pth", map_location=device),
            strict=True,
        )

        torch.set_grad_enabled(False)
        bart.eval()
        head.eval()

        self._bart = bart
        self._head = head
        self._device = device
        self._sampling = sampling
        self._loaded = True
        log.info("Skip-BART loaded (device=%s)", device)

        # Spin up the inference worker. Daemon so it does not block process
        # shutdown if a stuck inference call survives a SIGINT.
        if self._worker_thread is None or not self._worker_thread.is_alive():
            self._stop_event.clear()
            self._worker_thread = threading.Thread(
                target=self._worker_loop,
                daemon=True,
                name="skipbart-worker",
            )
            self._worker_thread.start()

    def warmup(self) -> None:
        if not self._loaded:
            return
        # 1 s of silence → 10-frame embedding → one full decode pass to JIT
        # the autoregressive path before the first real audio arrives.
        try:
            embeddings = self._embed(np.zeros(OPENL3_SAMPLE_RATE, dtype=np.float32))
            if embeddings.shape[0] > 0:
                self._decode(embeddings)
        except Exception as e:  # pragma: no cover - defensive
            log.warning("Skip-BART warmup failed: %s", e)

    def reset(self) -> None:
        # Bump generation so any chunk already in `_in_queue` and any
        # prediction the worker is about to push gets dropped.
        with self._gen_lock:
            self._generation += 1
        self._buffer = np.zeros(0, dtype=np.float32)
        self._buffer_start_ms = None
        self._chunks_since_run = 0
        self._last_emitted_ms = -1.0
        _drain(self._in_queue)
        _drain(self._out_queue)

    # ── ingest / emit ────────────────────────────────────────────────────────

    def ingest(self, chunk: AudioChunk) -> None:
        """Hand the chunk off to the worker thread. Does not block.

        The worker drains the queue into the rolling buffer and runs
        inference when the chunk-count threshold is met. ingest() itself
        is ~microseconds — the heavy lifting happens elsewhere so the
        chunk-processing path stays real-time.
        """
        if not self._loaded:
            return
        self._session_id = chunk.session_id
        with self._gen_lock:
            gen = self._generation
        self._in_queue.put((gen, chunk))

    def get_predictions(self) -> list[LightingPrediction]:
        """Drain whatever the worker has produced since the last call."""
        out: list[LightingPrediction] = []
        try:
            while True:
                out.append(self._out_queue.get_nowait())
        except queue.Empty:
            pass
        return out

    # ── worker thread ────────────────────────────────────────────────────────

    def _worker_loop(self) -> None:
        """Background inference loop. One per adapter instance.

        Pulls chunks off `_in_queue`, appends each to the rolling buffer
        (cheap), and runs the inference block when the chunk-count
        threshold is met (expensive — 1–7 s). The generation check at both
        ends lets a session reset discard everything in flight without
        having to interrupt an in-progress inference.
        """
        while not self._stop_event.is_set():
            try:
                item = self._in_queue.get(timeout=0.5)
            except queue.Empty:
                continue
            gen, chunk = item
            with self._gen_lock:
                current_gen = self._generation
            if gen != current_gen:
                # Reset happened after this chunk was enqueued. Discard.
                continue
            try:
                predictions = self._process_chunk(chunk)
            except Exception as e:  # pragma: no cover — defensive
                log.warning("Skip-BART worker raised on chunk: %s", e)
                continue
            for pred in predictions:
                # Re-check generation just before publishing: a reset that
                # arrived during the inference would otherwise leak stale
                # frames into the next session.
                with self._gen_lock:
                    if gen != self._generation:
                        break
                self._out_queue.put(pred)

    def _process_chunk(self, chunk: AudioChunk) -> list[LightingPrediction]:
        """Append `chunk` to the buffer and, if it's time, run inference.

        Carries the same semantics the synchronous ingest+get_predictions
        pair used to have — just run on the worker thread.
        """
        pcm_in = np.frombuffer(chunk.pcm, dtype="<f4")
        if pcm_in.size == 0:
            return []

        # Audio arrives at the canonical 48 kHz; OpenL3 also uses 48 kHz, no
        # resample needed for the common path.
        self._buffer_sample_rate = chunk.sample_rate
        if self._buffer_start_ms is None:
            self._buffer_start_ms = float(chunk.timestamp_ms)
        self._buffer = np.concatenate([self._buffer, pcm_in.astype(np.float32, copy=False)])

        max_samples = int(WINDOW_SECONDS * self._buffer_sample_rate)
        if self._buffer.size > max_samples:
            drop = self._buffer.size - max_samples
            self._buffer = self._buffer[drop:]
            assert self._buffer_start_ms is not None
            self._buffer_start_ms += drop * 1000.0 / self._buffer_sample_rate
            if self._last_emitted_ms < self._buffer_start_ms:
                self._last_emitted_ms = self._buffer_start_ms

        self._chunks_since_run += 1

        if self._buffer.size < int(MIN_WINDOW_SECONDS_TO_RUN * self._buffer_sample_rate):
            return []
        if self._chunks_since_run < MIN_CHUNKS_BETWEEN_RUNS:
            return []
        self._chunks_since_run = 0

        from app.utils.profiling import stage_timer  # noqa: PLC0415

        try:
            with stage_timer("skip.inference"):
                embeddings = self._embed(self._buffer)
                if embeddings.shape[0] == 0:
                    return []
                hv = self._decode(embeddings)  # shape (N, 2)
        except Exception as e:
            log.warning("Skip-BART inference failed: %s", e)
            return []

        out: list[LightingPrediction] = []
        buffer_start_ms = self._buffer_start_ms
        for i, (h_tok, v_tok) in enumerate(hv):
            frame_ms = buffer_start_ms + i * (OPENL3_HOP_SIZE * 1000.0)
            if frame_ms <= self._last_emitted_ms:
                continue
            self._last_emitted_ms = frame_ms
            # Frontend expects hue in degrees [0, 360) and value in [0, 1].
            hue_deg = (float(h_tok) / HUE_CLASSES) * 360.0
            value_norm = float(v_tok) / (VALUE_CLASSES - 1)
            out.append(
                LightingPrediction(
                    session_id=self._session_id,
                    hue=hue_deg,
                    value=value_norm,
                    intensity=value_norm,
                    beat_pulse=None,
                    confidence=None,
                    frame_time_ms=frame_ms,
                )
            )
        return out

    # ── internals ────────────────────────────────────────────────────────────

    def _embed(self, audio: np.ndarray) -> np.ndarray:
        import openl3  # noqa: PLC0415

        embeddings, _ = openl3.get_audio_embedding(
            audio,
            self._buffer_sample_rate,
            embedding_size=OPENL3_EMBEDDING_DIM,
            hop_size=OPENL3_HOP_SIZE,
            verbose=False,
        )
        return np.asarray(embeddings, dtype=np.float32)

    def _decode(self, embeddings: np.ndarray) -> np.ndarray:
        """Run autoregressive RSTC decoding. Returns (N, 2) of (h, v) tokens."""
        import torch  # noqa: PLC0415

        n = min(embeddings.shape[0], ARCH_MAX_LEN)
        if n == 0:
            return np.zeros((0, 2), dtype=np.int64)

        music = torch.from_numpy(embeddings[:n]).unsqueeze(0).to(self._device)  # (1, n, 512)

        # Mirrors upstream `generate.iteration` minus the batch loop.
        light = torch.zeros(1, n, 2, dtype=torch.long, device=self._device)
        light[..., 0] = HUE_CLASSES  # pad token
        light[..., 1] = VALUE_CLASSES
        # Seed the first frame with a deterministic mid hue/value so reset
        # produces consistent first-frame behaviour across sessions.
        light[0, 0, 0] = HUE_CLASSES // 2
        light[0, 0, 1] = VALUE_CLASSES // 2

        attn_mask_encoder = torch.ones(1, n, dtype=torch.float32, device=self._device)
        attn_mask_decoder = torch.zeros_like(attn_mask_encoder)
        attn_mask_decoder[:, 1:] = attn_mask_encoder[:, :-1]
        attn_mask_decoder[:, 0] = attn_mask_encoder[:, 0]

        result = np.zeros((n, 2), dtype=np.int64)
        result[0, 0] = int(light[0, 0, 0].item())
        result[0, 1] = int(light[0, 0, 1].item())

        h_range = DEFAULT_HUE_RANGE
        v_range = DEFAULT_VALUE_RANGE
        p = DEFAULT_NUCLEUS_P
        t = DEFAULT_TEMPERATURE

        for i in range(n):
            hidden = self._bart(music, light, attn_mask_encoder, attn_mask_decoder)
            h_logits, v_logits = self._head(hidden)
            # h_logits: (1, n, 181), v_logits: (1, n, 257)
            h_step = h_logits[0, i].clone()
            v_step = v_logits[0, i].clone()

            v_last = int(light[0, i, 1].item())
            if v_last != VALUE_CLASSES:
                v_left = max(0, v_last - v_range[0])
                v_right = min(VALUE_CLASSES - 1, v_last + v_range[1])
                v_step[:v_left] = 1e-8
                v_step[v_right:] = 1e-8

            h_last = int(light[0, i, 0].item())
            if h_last != HUE_CLASSES:
                _restrict_hue(h_step, h_last, h_range)

            # Drop pad logit (last index) before sampling, matching upstream.
            h_tok = int(self._sampling(h_step[:-1], p=p[0], t=t[0]))
            v_tok = int(self._sampling(v_step[:-1], p=p[1], t=t[1]))

            result[i, 0] = h_tok
            result[i, 1] = v_tok
            if i + 1 < n:
                light[0, i + 1, 0] = h_tok
                light[0, i + 1, 1] = v_tok

        return result


def _drain(q: queue.Queue) -> None:
    """Empty `q` non-blockingly. Used on session reset to discard anything
    still queued from the previous generation."""
    try:
        while True:
            q.get_nowait()
    except queue.Empty:
        pass


def _restrict_hue(h_logits, h_last: int, h_range: int) -> None:
    """In-place RSTC hue restriction wrapping around the cyclic vocabulary."""
    h_left = h_last - h_range
    h_right = h_last + h_range
    if h_left >= 0 and h_right <= HUE_CLASSES - 1:
        h_logits[:h_left] = 1e-8
        h_logits[h_right:] = 1e-8
    elif h_left < 0 and h_right <= HUE_CLASSES - 1:
        h_left_wrapped = HUE_CLASSES + h_left
        if h_left_wrapped < h_right:
            h_logits[h_left_wrapped:h_right] = 1e-8
    elif h_left >= 0 and h_right > HUE_CLASSES - 1:
        h_right_wrapped = h_right - (HUE_CLASSES - 1)
        if h_right_wrapped < h_left:
            h_logits[h_right_wrapped:h_left] = 1e-8
