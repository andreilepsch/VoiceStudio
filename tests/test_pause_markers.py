"""Inline `[pause Nms]` transcript marker (issue #276).

Covers the pure text parser (`parse_pause_markers`) and the model-free audio
stitching (`_render_with_pauses`) — no TTS model is loaded; `gen_span` is a
fake that returns known-length tensors so the silence math is deterministic.
"""
import torch

from omnivoice.utils.text import (
    parse_pause_markers,
    PAUSE_DEFAULT_MS,
    PAUSE_MAX_MS,
)
from api.routers.generation import _render_with_pauses, _render_with_srt
from services.srt_parser import parse_srt


# ── parser ────────────────────────────────────────────────────────────────

def test_no_marker_returns_text_unchanged():
    assert parse_pause_markers("Hello world") == [("Hello world", 0)]
    assert parse_pause_markers("") == [("", 0)]


def test_bare_pause_uses_default():
    assert parse_pause_markers("a[pause]b") == [("a", PAUSE_DEFAULT_MS), ("b", 0)]


def test_explicit_ms_and_seconds():
    assert parse_pause_markers("a [pause 500ms] b") == [("a ", 500), (" b", 0)]
    assert parse_pause_markers("a[pause 1s]b") == [("a", 1000), ("b", 0)]
    assert parse_pause_markers("a[pause 1.5s]b") == [("a", 1500), ("b", 0)]


def test_bare_number_is_milliseconds():
    assert parse_pause_markers("a[pause 250]b") == [("a", 250), ("b", 0)]


def test_case_insensitive_and_inner_whitespace():
    assert parse_pause_markers("a[PAUSE  750 ms]b") == [("a", 750), ("b", 0)]


def test_leading_marker_yields_empty_first_span():
    assert parse_pause_markers("[pause 1s]Hi") == [("", 1000), ("Hi", 0)]


def test_trailing_marker():
    assert parse_pause_markers("Bye[pause]") == [("Bye", PAUSE_DEFAULT_MS)]


def test_adjacent_markers_sum():
    assert parse_pause_markers("a[pause][pause 2s]b") == [
        ("a", PAUSE_DEFAULT_MS + 2000),
        ("b", 0),
    ]


def test_duration_clamped():
    assert parse_pause_markers("a[pause 99s]b") == [("a", PAUSE_MAX_MS), ("b", 0)]


def test_text_round_trips_without_markers():
    text = "One [pause 200ms] two [pause] three"
    spans = "".join(t for t, _ in parse_pause_markers(text))
    assert spans == "One  two  three"


# ── audio stitching ─────────────────────────────────────────────────────────

def _fake_gen(sr):
    # Each span renders to 1 second of mono audio (shape [1, sr]); the value
    # encodes nothing — we only assert lengths.
    return lambda text: torch.ones(1, sr)


def test_render_inserts_silence_between_spans():
    sr = 1000  # 1000 samples/sec keeps the math trivial
    segs = [("hello", 500), ("world", 0)]  # 500ms = 500 samples of silence
    out = _render_with_pauses(_fake_gen(sr), segs, sr)
    # 1s audio + 0.5s silence + 1s audio = 2.5s = 2500 samples
    assert out.shape == (1, 2500)
    # The middle 500 samples (after the first second) are silence.
    assert torch.all(out[:, sr:sr + 500] == 0)
    assert torch.all(out[:, :sr] == 1)


def test_render_leading_silence():
    sr = 1000
    segs = [("", 1000), ("hi", 0)]  # 1s leading silence + 1s audio
    out = _render_with_pauses(_fake_gen(sr), segs, sr)
    assert out.shape == (1, 2000)
    assert torch.all(out[:, :1000] == 0)
    assert torch.all(out[:, 1000:] == 1)


def test_render_pause_only_input_is_silence():
    sr = 1000
    segs = [("", 750)]  # only a pause, no speakable text
    out = _render_with_pauses(_fake_gen(sr), segs, sr)
    assert out.numel() == 750
    assert torch.all(out == 0)


def test_render_no_pause_single_span_passthrough():
    sr = 1000
    segs = [("just text", 0)]
    out = _render_with_pauses(_fake_gen(sr), segs, sr)
    assert out.shape == (1, sr)


def test_render_with_srt_places_cues_at_exact_timestamps():
    sr = 1000
    srt = (
        "1\n"
        "00:00:01,000 --> 00:00:02,000\n"
        "First cue\n\n"
        "2\n"
        "00:00:03,500 --> 00:00:04,500\n"
        "Second cue\n"
    )
    segs = parse_srt(srt).segments
    assert len(segs) == 2

    def _gen_cue(_text, _dur, _idx):
        return torch.full((1, 800), 0.25)

    out = _render_with_srt(_gen_cue, segs, sr)
    # Timeline spans to end of last cue (4.5s = 4500 samples)
    assert out.shape == (1, 4500)
    # Leading 1s before first cue is strictly silent
    assert torch.all(out[:, :1000] == 0)
    # Gap between cue 1 (ends at 2.0s) and cue 2 (starts at 3.5s) is strictly silent
    assert torch.all(out[:, 2000:3500] == 0)
    # Cue 1 and Cue 2 slots contain synthesized speech energy
    assert out[:, 1000:2000].abs().sum().item() > 0
    assert out[:, 3500:4500].abs().sum().item() > 0


def test_render_with_srt_compresses_overflowing_cue_into_slot():
    sr = 1000
    segs = [{"start": 0.5, "end": 1.5, "text": "Overflow cue"}]

    def _gen_cue(_text, _dur, _idx):
        # Returns 2.0s of audio for a 1.0s slot
        return torch.full((1, 2000), 0.25)

    out = _render_with_srt(_gen_cue, segs, sr)
    assert out.shape == (1, 1500)
    assert torch.all(out[:, :500] == 0)
    assert out[:, 500:1500].abs().sum().item() > 0
