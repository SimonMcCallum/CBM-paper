"""Unit tests for the pure transforms in canvas_ingest.py (no network/DB)."""

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from canvas_ingest import (
    strip_html,
    canvas_question_to_bank_row,
    transform_questions,
    detect_new_quizzes,
    _parse_next_link,
)


def test_strip_html():
    assert strip_html("<p>Hello&nbsp;<b>world</b></p>") == "Hello world"
    assert strip_html(None) == ""
    assert strip_html("  spaced   out  ") == "spaced out"


def _mc_question():
    return {
        "id": 5, "quiz_id": 9, "question_name": "Sorting",
        "question_type": "multiple_choice_question",
        "question_text": "<p>Quicksort average complexity?</p>",
        "answers": [
            {"id": 100, "text": "O(n log n)", "weight": 100},
            {"id": 101, "text": "O(n^2)", "weight": 0},
        ],
    }


def test_multiple_choice_transform():
    row = canvas_question_to_bank_row(_mc_question(), course_id="C1")
    assert row["question_type"] == "multiple_choice"
    assert row["question_text"] == "Quicksort average complexity?"
    assert row["correct_answer"] == "100"
    assert len(row["options"]) == 2
    assert row["course_id"] == "C1"
    assert row["qti_identifier"] == "canvas:9:5"
    assert row["topic"] == "Sorting"


def test_true_false_transform():
    q = {
        "id": 1, "quiz_id": 2, "question_type": "true_false_question",
        "question_text": "The sky is blue.",
        "answers": [
            {"id": 1, "text": "True", "weight": 100},
            {"id": 2, "text": "False", "weight": 0},
        ],
    }
    row = canvas_question_to_bank_row(q)
    assert row["question_type"] == "true_false"
    assert row["correct_answer"] == "1"


def test_multiple_answers_transform_sorted_csv():
    q = {
        "id": 3, "quiz_id": 2, "question_type": "multiple_answers_question",
        "question_text": "Pick the prime numbers.",
        "answers": [
            {"id": 30, "text": "2", "weight": 100},
            {"id": 31, "text": "4", "weight": 0},
            {"id": 32, "text": "3", "weight": 100},
        ],
    }
    row = canvas_question_to_bank_row(q)
    assert row["question_type"] == "multiple_answers"
    assert row["correct_answer"] == "30,32"  # sorted CSV


def test_non_mcq_types_skipped():
    for t in ("essay_question", "short_answer_question", "matching_question"):
        q = {"id": 1, "quiz_id": 1, "question_type": t, "question_text": "x", "answers": []}
        assert canvas_question_to_bank_row(q) is None


def test_question_with_no_correct_answer_skipped():
    q = {
        "id": 1, "quiz_id": 1, "question_type": "multiple_choice_question",
        "question_text": "no key", "answers": [
            {"id": 1, "text": "a", "weight": 0},
            {"id": 2, "text": "b", "weight": 0},
        ],
    }
    assert canvas_question_to_bank_row(q) is None


def test_transform_questions_counts():
    questions = [_mc_question(), {"id": 9, "quiz_id": 9, "question_type": "essay_question",
                                  "question_text": "x", "answers": []}]
    rows, skipped = transform_questions(questions, "C1")
    assert len(rows) == 1
    assert skipped == 1


def test_detect_new_quizzes():
    assignments = [
        {"id": 1, "name": "Classic linked", "is_quiz_lti_assignment": False},
        {"id": 2, "name": "New Quiz", "is_quiz_lti_assignment": True},
    ]
    nq = detect_new_quizzes(assignments)
    assert [a["id"] for a in nq] == [2]


def test_parse_next_link():
    header = ('<https://x/api?page=1>; rel="current", '
              '<https://x/api?page=2>; rel="next", '
              '<https://x/api?page=5>; rel="last"')
    assert _parse_next_link(header) == "https://x/api?page=2"
    assert _parse_next_link("") is None
    assert _parse_next_link('<https://x/api?page=1>; rel="current"') is None
