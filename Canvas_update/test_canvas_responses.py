"""Unit tests for the pure CSV parsing in canvas_responses.py (no network)."""

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from canvas_responses import split_report_columns, parse_student_analysis_csv


def test_split_report_columns():
    header = ["name", "id", "sis_id", "section", "section_id", "section_sis_id",
              "submitted", "attempt", "101: Quicksort complexity?", "101: score",
              "102: Hashing?", "102: score"]
    meta, questions = split_report_columns(header)
    assert meta == ["name", "id", "sis_id", "section", "section_id",
                    "section_sis_id", "submitted", "attempt"]
    assert questions == ["101: Quicksort complexity?", "101: score",
                         "102: Hashing?", "102: score"]


def test_split_report_columns_no_questions():
    header = ["name", "id", "submitted", "attempt"]
    meta, questions = split_report_columns(header)
    assert questions == []
    assert "name" in meta


def test_parse_student_analysis_csv():
    csv_text = (
        "name,id,sis_id,section,section_id,section_sis_id,submitted,attempt,"
        "101: Quicksort?,101: score\r\n"
        "Ada Lovelace,1,A1,S1,10,,2026-06-01,1,O(n log n),2\r\n"
        "Alan Turing,2,A2,S1,10,,2026-06-01,1,O(n^2),0\r\n"
    )
    records = parse_student_analysis_csv(csv_text)
    assert len(records) == 2
    assert records[0]["meta"]["name"] == "Ada Lovelace"
    assert records[0]["meta"]["id"] == "1"
    assert records[0]["answers"]["101: Quicksort?"] == "O(n log n)"
    assert records[0]["answers"]["101: score"] == "2"
    assert records[1]["answers"]["101: score"] == "0"


def test_parse_skips_blank_rows():
    csv_text = "name,id,submitted,attempt\r\nAda,1,x,1\r\n,,,\r\n"
    records = parse_student_analysis_csv(csv_text)
    assert len(records) == 1


def test_parse_empty():
    assert parse_student_analysis_csv("") == []
