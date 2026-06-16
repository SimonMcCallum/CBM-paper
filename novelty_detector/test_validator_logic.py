"""Unit tests for pure helpers in validator_api.py and eval_matching.py.

These avoid heavy model loads — they exercise JSON extraction, MCQ validation,
embedding-text construction, and the numpy matching/metric core with hand-built
vectors.
"""

import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))

from validator_api import _extract_json, _valid_mcq, _embedding_text_for_question
from eval_matching import match_chunks, prf, _normalize


# ── _extract_json ──────────────────────────────────────────────────────────

def test_extract_json_plain():
    assert _extract_json('[{"a": 1}]') == [{"a": 1}]


def test_extract_json_fenced():
    resp = "```json\n[{\"a\": 1}]\n```"
    assert _extract_json(resp) == [{"a": 1}]


def test_extract_json_with_prose():
    resp = 'Here are the questions:\n[{"q": "x"}]\nHope that helps!'
    assert _extract_json(resp) == [{"q": "x"}]


def test_extract_json_object():
    resp = "noise {\"k\": \"v\"} trailing"
    assert _extract_json(resp) == {"k": "v"}


def test_extract_json_invalid():
    assert _extract_json("not json at all") is None
    assert _extract_json("") is None


# ── _valid_mcq ──────────────────────────────────────────────────────────────

def _good_mcq():
    return {
        "question_text": "Q?",
        "options": [{"id": "A", "text": "a"}, {"id": "B", "text": "b"}],
        "correct_answer": "A",
    }


def test_valid_mcq_accepts_good():
    assert _valid_mcq(_good_mcq())


def test_valid_mcq_rejects_correct_not_in_options():
    q = _good_mcq()
    q["correct_answer"] = "Z"
    assert not _valid_mcq(q)


def test_valid_mcq_rejects_missing_fields():
    assert not _valid_mcq({"options": [{"id": "A", "text": "a"}], "correct_answer": "A"})
    assert not _valid_mcq({"question_text": "q", "correct_answer": "A"})
    assert not _valid_mcq("not a dict")


def test_valid_mcq_rejects_too_few_options():
    q = _good_mcq()
    q["options"] = [{"id": "A", "text": "a"}]
    assert not _valid_mcq(q)


# ── _embedding_text_for_question ─────────────────────────────────────────────

def test_embedding_text_includes_options():
    text = _embedding_text_for_question(
        "What is 2+2?", [{"id": "A", "text": "four"}, {"id": "B", "text": "five"}])
    assert "What is 2+2?" in text
    assert "four" in text and "five" in text


def test_embedding_text_prepends_expansion():
    text = _embedding_text_for_question("Q", [], expanded="tests arithmetic")
    assert text.startswith("tests arithmetic")


def test_embedding_text_handles_json_string_options():
    text = _embedding_text_for_question("Q", '[{"id":"A","text":"opt"}]')
    assert "opt" in text


# ── matching core ────────────────────────────────────────────────────────────

def test_normalize_unit_length():
    v = _normalize(np.array([[3.0, 4.0]]))
    assert abs(np.linalg.norm(v[0]) - 1.0) < 1e-6


def test_match_chunks_picks_nearest_above_threshold():
    bank = np.array([[1.0, 0.0], [0.0, 1.0]])
    bank_ids = ["x", "y"]
    chunks = np.array([[1.0, 0.05]])  # closest to x
    selected = match_chunks(chunks, bank, bank_ids, threshold=0.5, max_questions=6)
    assert selected == ["x"]


def test_match_chunks_threshold_excludes():
    bank = np.array([[1.0, 0.0]])
    chunks = np.array([[0.0, 1.0]])  # orthogonal → cosine 0
    assert match_chunks(chunks, bank, ["x"], threshold=0.5) == []


def test_match_chunks_dedupes_and_caps():
    bank = np.array([[1.0, 0.0], [0.9, 0.1]])
    bank_ids = ["x", "y"]
    # two chunks both closest to x; second should fall through to y (dedupe)
    chunks = np.array([[1.0, 0.0], [1.0, 0.0]])
    selected = match_chunks(chunks, bank, bank_ids, threshold=0.5, max_questions=6)
    assert selected == ["x", "y"]
    # max_questions cap
    capped = match_chunks(chunks, bank, bank_ids, threshold=0.5, max_questions=1)
    assert capped == ["x"]


def test_prf_perfect_and_partial():
    assert prf(["a", "b"], ["a", "b"])["f1"] == 1.0
    p = prf(["a", "c"], ["a", "b"])
    assert p["precision"] == 0.5 and p["recall"] == 0.5
    # empty selected + empty relevant is treated as trivially correct
    assert prf([], [])["f1"] == 1.0
