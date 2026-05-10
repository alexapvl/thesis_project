"""Real-time beat-tracking adapter backed by BeatNet+ (Heydari & Lerch).

The chunk transport contract is mono Float32 PCM @ 48 kHz. BeatNet expects
22050 Hz. This adapter:

  1. resamples each incoming chunk 48000 → 22050 with scipy.signal.resample_poly,
  2. appends to a session-long accumulating audio buffer,
  3. on each drain, runs BeatNet's CRNN on *only the new audio* (one hop at
     a time, 20 ms each at 22 050 Hz / 441-sample hop), and
  4. feeds each new activation frame into a single persistent particle
     filter (``particle_filtering_cascade``). The PF maintains tempo lock
     across calls; we read its growing path of beat events and emit any
     beats whose absolute time exceeds the dedup cursor.

Why not BeatNet.process() directly?

The public ``BeatNet.process()`` API in ``online`` mode runs the CRNN on
*every* sample of the audio you pass in and then runs the PF over those
activations. The PF's ``counter`` advances per frame, so re-passing
overlapping audio inflates the counter and produces beat timestamps that
race past wall-clock; the dedup filter then rejects nearly everything.
Rebuilding the PF each call (a previous attempt) avoids the inflation
but destroys the PF's tempo lock, so each drain restarts cold and only
returns 1–2 beats from the locked tail of the buffer — leading to the
"~0.5 beats/sec at 150 BPM" symptom.

The fix here drives BeatNet's internals directly:

  * ``self._beatnet.audio`` is aliased to our growing buffer.
  * ``self._beatnet.counter`` tracks the next hop to process.
  * We call ``activation_extractor_realtime`` per-hop, which writes
    ``self._beatnet.pred`` with the CRNN's activation for that hop.
  * We feed that single-frame activation into the persistent PF.

The PF then sees one new activation frame per call, exactly as it
expects in its native streaming flow. Tempo lock survives across drains,
and beat times come out at the right cadence.
"""

from __future__ import annotations

import logging
import sys
from typing import Any

import numpy as np

from app.config.settings import settings
from app.domain.models import AudioChunk, BeatEvent

log = logging.getLogger(__name__)


def _install_pf_patch() -> None:
    """Redirect ``BeatNet.particle_filtering_cascade`` to our vendored copy.

    The vendored module lowers BeatNet's beat-/downbeat-activation
    commit thresholds (defaults 0.4 → 0.25 here) — upstream tuning is
    for benchmark precision; for live lighting we want higher recall.

    Must run before any code imports ``BeatNet`` (otherwise Python has
    already cached the upstream cascade and ``sys.modules`` replacement
    is too late). Safe to call multiple times.
    """
    if "BeatNet.particle_filtering_cascade" in sys.modules:
        return
    try:
        from vendor.beatnet_patched import (  # type: ignore[import-not-found]
            particle_filtering_cascade as patched,
        )
    except ImportError as e:
        log.warning("BeatNet PF patch not installed: %s", e)
        return
    # Apply the runtime-tunable threshold from settings to whichever
    # value the patch picks up. Lets us tune via env var without
    # editing the vendored file.
    patched.BEAT_ACTIVATION_THRESHOLD = settings.beatnet_activation_threshold
    patched.DOWNBEAT_ACTIVATION_THRESHOLD = settings.beatnet_activation_threshold
    sys.modules["BeatNet.particle_filtering_cascade"] = patched
    log.info(
        "BeatNet PF patch installed (activation_threshold=%.2f, "
        "downbeat_threshold=%.2f)",
        patched.BEAT_ACTIVATION_THRESHOLD,
        patched.DOWNBEAT_ACTIVATION_THRESHOLD,
    )


# Install the patch at module-import time so any later `import BeatNet`
# (from is_available, load, or elsewhere) picks up the patched cascade.
_install_pf_patch()

BEATNET_SAMPLE_RATE = 22050
BEATNET_FPS = 50  # BeatNet's CRNN runs at 50 frames per second
BEATNET_FRAME_PERIOD = 1.0 / BEATNET_FPS  # 20 ms

# Target peak amplitude for the soft auto-gain that runs before the CRNN.
# Picked to leave a small safety margin under full scale so transients
# don't clip after gain. Matches BeatNet's "feed as loud as possible"
# guidance without producing a brick-walled signal that confuses the
# CRNN's onset detector.
NORMALIZE_TARGET_PEAK = 0.95
# Don't try to normalize buffers that are essentially silent — dividing
# by tiny peaks blows the noise floor up to full scale.
NORMALIZE_MIN_PEAK = 0.01


class BeatNetTracker:
    """Wraps BeatNet so it satisfies the BeatTrackerAdapter Protocol."""

    MIN_CHUNKS_BETWEEN_RUNS = 5  # ~215 ms at 2048 samples / 48 kHz

    def __init__(self) -> None:
        self._beatnet: Any = None
        # Session-long buffer at 22 050 Hz. We never trim — at ~88 KB/s
        # a 5-minute song is ~26 MB. We aliased self._beatnet.audio to
        # this; the CRNN reads slices indexed by hop counter.
        self._buffer: np.ndarray = np.zeros(0, dtype=np.float32)
        self._buffer_start_ms: float | None = None
        # The PF's `path` starts with one sentinel row from its __init__;
        # we conceptually "consume" that sentinel up front. After each
        # drain we advance this to ``path.shape[0]`` so the next drain
        # only sees genuinely new beats.
        self._emitted_path_len: int = 1
        self._chunks_since_run: int = 0
        self._session_id: str = ""
        self._loaded: bool = False
        # Cached references after load() so we don't reach into BeatNet
        # internals everywhere.
        self._hop_size: int = 441  # filled in from BeatNet on load()
        self._win_length: int = 4096

    # ── lifecycle ────────────────────────────────────────────────────────────

    def load(self) -> None:
        if self._loaded:
            return
        # numpy >= 2.0 removed np.in1d; BeatNet's particle filter still
        # calls it. Patch in a shim before importing BeatNet.
        import numpy as _np  # noqa: PLC0415

        if not hasattr(_np, "in1d"):
            _np.in1d = _np.isin  # type: ignore[attr-defined]

        # Heavy import; do it lazily so test collection is not blocked.
        from BeatNet.BeatNet import BeatNet  # type: ignore[import-not-found]

        model_id = settings.beatnet_model
        # mode='realtime' gives us ``activation_extractor_realtime`` which
        # processes a single hop per call from ``self.audio[hop * counter…]``.
        # We drive that loop ourselves from get_events().
        self._beatnet = BeatNet(
            model=model_id,
            mode="realtime",
            inference_model="PF",
            plot=[],
            thread=False,
        )
        self._hop_size = int(self._beatnet.log_spec_hop_length)
        self._win_length = int(self._beatnet.log_spec_win_length)
        # Alias the CRNN's audio source to our growing buffer. The
        # extractor reads ``self.audio[hop*(counter-2):hop*counter + win]``
        # so we keep this in sync after each ingest.
        self._beatnet.audio = self._buffer
        self._beatnet.counter = 0
        self._beatnet.completed = 0
        self._loaded = True
        log.info(
            "BeatNet loaded (model=%d, mode=realtime, inference=PF, "
            "hop=%d, win=%d, normalize=%s)",
            model_id,
            self._hop_size,
            self._win_length,
            settings.beatnet_normalize_input,
        )

    def reset(self) -> None:
        self._buffer = np.zeros(0, dtype=np.float32)
        self._buffer_start_ms = None
        self._emitted_path_len = 1
        self._chunks_since_run = 0
        if self._beatnet is not None:
            self._beatnet.audio = self._buffer
            self._beatnet.counter = 0
            self._beatnet.completed = 0
            self._rebuild_pf()

    def _rebuild_pf(self) -> None:
        """Reset BeatNet's particle filter to a fresh state for a new session."""
        if self._beatnet is None:
            return
        from BeatNet.particle_filtering_cascade import (  # type: ignore[import-not-found]
            particle_filter_cascade,
        )

        self._beatnet.estimator = particle_filter_cascade(
            beats_per_bar=[], fps=BEATNET_FPS, plot=[], mode="realtime"
        )

    # ── ingest / emit ────────────────────────────────────────────────────────

    def ingest(self, chunk: AudioChunk) -> None:
        if not self._loaded:
            return
        self._session_id = chunk.session_id

        pcm_in = np.frombuffer(chunk.pcm, dtype="<f4")
        if pcm_in.size == 0:
            return

        pcm_22k = self._resample(pcm_in, chunk.sample_rate)
        if pcm_22k.size == 0:
            return

        if self._buffer_start_ms is None:
            self._buffer_start_ms = float(chunk.timestamp_ms)

        # Apply normalization to the *new* audio before appending. Doing
        # this on append (vs the whole buffer per drain) means the gain
        # tracks any quiet-to-loud transitions in the source without
        # rewriting the entire history each call. Note: server-side
        # only — the user's playback path is untouched.
        if settings.beatnet_normalize_input:
            peak = float(np.max(np.abs(pcm_22k)))
            if peak >= NORMALIZE_MIN_PEAK:
                pcm_22k = (pcm_22k * (NORMALIZE_TARGET_PEAK / peak)).astype(
                    np.float32, copy=False
                )

        self._buffer = np.concatenate([self._buffer, pcm_22k])
        # Keep BeatNet's view of "the audio" in sync with our buffer.
        self._beatnet.audio = self._buffer
        self._chunks_since_run += 1

    def get_events(self) -> list[BeatEvent]:
        if (
            not self._loaded
            or self._beatnet is None
            or self._buffer_start_ms is None
        ):
            return []
        if self._chunks_since_run < self.MIN_CHUNKS_BETWEEN_RUNS:
            return []
        self._chunks_since_run = 0

        # Walk forward one hop at a time, processing each through the CRNN
        # and feeding the activation into the persistent PF. Each hop needs
        # `(counter-2)*hop + win` samples of audio, since the CRNN slices
        # `audio[(counter-2)*hop : counter*hop + win]`. We stop when the
        # next hop would need samples we don't have yet.
        # Collect raw CRNN activations per hop so we can log a summary
        # at the end of the drain. The PF's beat-commit threshold is 0.4
        # on the beat activation; if we see lots of frames with high
        # activations but the PF still doesn't emit, the bottleneck is
        # the PF's tempo prior, not the CRNN.
        beat_activations: list[float] = []
        downbeat_activations: list[float] = []
        hops_processed = 0
        while True:
            counter = self._beatnet.counter
            needed = counter * self._hop_size + self._win_length
            if counter >= 2 and needed > self._buffer.size:
                break
            if counter < 2 and self._buffer.size < self._hop_size:
                break

            try:
                # Writes self._beatnet.pred = (frames, 2) activation.
                self._beatnet.activation_extractor_realtime(self._buffer)
                pred = np.asarray(self._beatnet.pred)
                # pred.shape is (1, 2): [beat_act, downbeat_act].
                if pred.ndim == 2 and pred.size >= 2:
                    beat_activations.append(float(pred[-1, 0]))
                    downbeat_activations.append(float(pred[-1, 1]))
                # Feed exactly that frame into the PF.
                self._beatnet.estimator.process(pred)
            except Exception as e:
                log.warning("BeatNet activation/PF raised at hop=%d: %s", counter, e)
                break
            self._beatnet.counter += 1
            hops_processed += 1
            # Safety: don't spend forever in one drain. If we're way
            # behind on audio (e.g., first call after a long silence)
            # cap the work and let subsequent drains catch up.
            if hops_processed >= 1000:
                break

        # Read new beats from the PF's growing path. path is shape (N, 2);
        # entries are [time_seconds, label] (label==1 downbeat, 2 beat).
        # _emitted_path_len starts at 1 to skip the PF's __init__ sentinel
        # row, then tracks how far we've already drained.
        path = self._beatnet.estimator.path

        # CRNN activation summary for this drain. `over_thresh` is the
        # count of hops whose beat-activation exceeded the PF's 0.4
        # commit threshold; if that's high but `new` (below) is low,
        # the PF is rejecting frames the CRNN was confident about
        # (tempo-prior conflict). If both are low, the CRNN itself is
        # quiet on this section.
        if beat_activations:
            ba = np.array(beat_activations, dtype=np.float32)
            crnn_summary = (
                f"crnn_beat[max={ba.max():.2f} mean={ba.mean():.2f} "
                f"over0.4={int((ba > 0.4).sum())}/{ba.size}]"
            )
        else:
            crnn_summary = "crnn_beat[no_hops]"

        new_rows = path[self._emitted_path_len :]
        if new_rows.size == 0:
            log.info(
                "beatnet.drain audio_s=%.2f hops=%d counter=%d path=%d new=0 %s",
                self._buffer.size / BEATNET_SAMPLE_RATE,
                hops_processed,
                self._beatnet.counter,
                path.shape[0] - 1,
                crnn_summary,
            )
            return []

        events: list[BeatEvent] = []
        buffer_start_ms = self._buffer_start_ms
        for row in new_rows:
            t_s = float(row[0])
            label = int(row[1]) if row.size >= 2 else 2
            abs_ms = buffer_start_ms + t_s * 1000.0
            events.append(
                BeatEvent(
                    session_id=self._session_id,
                    beat_time_ms=abs_ms,
                    confidence=0.9,
                    is_downbeat=(label == 1),
                )
            )
        self._emitted_path_len = path.shape[0]
        log.info(
            "beatnet.drain audio_s=%.2f hops=%d counter=%d path=%d new=%d "
            "last_beat_in_buffer=%.2fs %s",
            self._buffer.size / BEATNET_SAMPLE_RATE,
            hops_processed,
            self._beatnet.counter,
            path.shape[0] - 1,
            len(events),
            float(new_rows[-1][0]) if new_rows.size else 0.0,
            crnn_summary,
        )
        return events

    # ── helpers ──────────────────────────────────────────────────────────────

    @staticmethod
    def _resample(pcm: np.ndarray, sample_rate: int) -> np.ndarray:
        if sample_rate == BEATNET_SAMPLE_RATE:
            return pcm.astype(np.float32, copy=False)
        from math import gcd

        from scipy.signal import resample_poly  # type: ignore[import-not-found]

        g = gcd(BEATNET_SAMPLE_RATE, sample_rate)
        up = BEATNET_SAMPLE_RATE // g
        down = sample_rate // g
        out = resample_poly(pcm, up, down)
        return out.astype(np.float32, copy=False)


def is_available() -> bool:
    """True iff BeatNet (and its madmom dep) can be imported in this env."""
    try:
        import BeatNet.BeatNet  # type: ignore[import-not-found] # noqa: F401

        return True
    except Exception as e:  # pragma: no cover
        log.debug("BeatNet not importable: %s", e)
        return False
