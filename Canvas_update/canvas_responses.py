"""
Download all student responses for a Canvas (NUKU) **Classic** quiz, for CBM
score processing.

Why Classic only: NUKU allows both Classic and New Quizzes, but only Classic
exposes the full per-student, per-question response export — the `student_analysis`
quiz report (CSV) and the quiz submissions API. New Quizzes has no equivalent
bulk-response export, so CBM scoring requires Classic quizzes.

This tool automates the canonical "download all responses" mechanism:
  1. POST a request for a `student_analysis` report
  2. poll until Canvas has generated the CSV
  3. download the CSV (every student's answer + points for every question)

Stdlib only (urllib); reuses CanvasClient from canvas_ingest for auth/pagination.

Config (env or CLI):
  CANVAS_BASE_URL   e.g. https://canvas.vuw.ac.nz   (NUKU)
  CANVAS_API_TOKEN  teacher access token

Usage:
  python canvas_responses.py --course 12345 --quiz 678 --out responses.csv
  python canvas_responses.py --course 12345 --quiz 678 --submissions subs.json
"""

from __future__ import annotations

import os
import csv
import io
import json
import time
import argparse
import urllib.parse
import urllib.request
from typing import Dict, List, Optional, Tuple

from canvas_ingest import CanvasClient


# Fixed leading columns in a student_analysis report; everything after is a
# (question-answer, question-points) pair. Used to separate metadata from
# question columns when parsing the CSV.
REPORT_META_COLUMNS = [
    "name", "id", "sis_id", "section", "section_id", "section_sis_id",
    "submitted", "attempt",
]


class ReportClient(CanvasClient):
    """CanvasClient extended with POST + quiz-report polling/download."""

    def post_form(self, path: str, fields: List[Tuple[str, str]]) -> dict:
        url = f"{self.base_url}{path}"
        body = urllib.parse.urlencode(fields).encode("utf-8")
        req = urllib.request.Request(url, data=body, method="POST", headers={
            "Authorization": f"Bearer {self.token}",
            "Accept": "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
        })
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode("utf-8"))

    def request_report(self, course_id: str, quiz_id: str,
                       report_type: str = "student_analysis") -> dict:
        return self.post_form(
            f"/api/v1/courses/{course_id}/quizzes/{quiz_id}/reports",
            [("quiz_report[report_type]", report_type), ("include[]", "file")],
        )

    def get_report(self, course_id: str, quiz_id: str, report_id: str) -> dict:
        data, _ = self._request(
            f"/api/v1/courses/{course_id}/quizzes/{quiz_id}/reports/{report_id}"
            f"?include[]=file&include[]=progress")
        return data

    def download(self, file_url: str) -> bytes:
        req = urllib.request.Request(
            file_url, headers={"Authorization": f"Bearer {self.token}"})
        with urllib.request.urlopen(req, timeout=120) as resp:
            return resp.read()

    def list_submissions(self, course_id: str, quiz_id: str) -> List[dict]:
        data = self.get_paginated(
            f"/api/v1/courses/{course_id}/quizzes/{quiz_id}/submissions")
        # This endpoint nests the list under "quiz_submissions".
        out: List[dict] = []
        for d in data:
            if isinstance(d, dict) and "quiz_submissions" in d:
                out.extend(d["quiz_submissions"])
            else:
                out.append(d)
        return out


def generate_student_analysis(client: ReportClient, course_id: str, quiz_id: str,
                              poll_interval: float = 3.0, timeout: float = 300.0) -> bytes:
    """Request, poll, and download a student_analysis CSV. Returns raw bytes."""
    report = client.request_report(course_id, quiz_id)
    report_id = str(report.get("id"))

    # Already complete?
    file_obj = report.get("file")
    deadline = time.monotonic() + timeout
    while not (file_obj and file_obj.get("url")):
        if time.monotonic() > deadline:
            raise TimeoutError(f"Report {report_id} not ready after {timeout}s")
        time.sleep(poll_interval)
        report = client.get_report(course_id, quiz_id, report_id)
        file_obj = report.get("file")

    return client.download(file_obj["url"])


# ── Pure parsing (unit-tested) ────────────────────────────────────────────

def split_report_columns(header: List[str]) -> Tuple[List[str], List[str]]:
    """Split a student_analysis header into (metadata cols, question cols).

    Returns the leading fixed columns that are present, and everything after the
    known metadata block as question columns (answer/points pairs interleaved).
    """
    meta = [h for h in header if h in REPORT_META_COLUMNS]
    # Question columns are those after the last metadata column.
    last_meta_idx = -1
    for i, h in enumerate(header):
        if h in REPORT_META_COLUMNS:
            last_meta_idx = i
    questions = header[last_meta_idx + 1:] if last_meta_idx >= 0 else header
    return meta, questions


def parse_student_analysis_csv(text: str) -> List[Dict[str, object]]:
    """Parse a student_analysis CSV into per-student records.

    Each record: {meta: {...known columns...}, answers: {column: value}} where
    `answers` holds every non-metadata column verbatim (question text → response
    or points), since downstream CBM scoring already understands the column
    layout. Kept deliberately lossless rather than guessing answer/points pairs.
    """
    reader = csv.reader(io.StringIO(text))
    rows = list(reader)
    if not rows:
        return []
    header = rows[0]
    meta_cols, question_cols = split_report_columns(header)
    records = []
    for row in rows[1:]:
        if not any(cell.strip() for cell in row):
            continue
        cells = dict(zip(header, row))
        records.append({
            "meta": {c: cells.get(c, "") for c in meta_cols},
            "answers": {c: cells.get(c, "") for c in question_cols},
        })
    return records


# ── CLI ────────────────────────────────────────────────────────────────────

def main():
    p = argparse.ArgumentParser(description="Download all responses for a Classic Canvas quiz")
    p.add_argument("--course", required=True)
    p.add_argument("--quiz", required=True)
    p.add_argument("--out", help="Write the student_analysis CSV to this path")
    p.add_argument("--json", help="Also write parsed per-student records as JSON")
    p.add_argument("--submissions", help="Instead, dump quiz submissions to this JSON path")
    p.add_argument("--base-url", default=os.getenv("CANVAS_BASE_URL"))
    p.add_argument("--token", default=os.getenv("CANVAS_API_TOKEN"))
    p.add_argument("--poll-interval", type=float, default=3.0)
    p.add_argument("--timeout", type=float, default=300.0)
    args = p.parse_args()

    if not args.base_url or not args.token:
        p.error("CANVAS_BASE_URL and CANVAS_API_TOKEN (env or --base-url/--token) are required")

    client = ReportClient(args.base_url, args.token)

    if args.submissions:
        subs = client.list_submissions(args.course, args.quiz)
        with open(args.submissions, "w", encoding="utf-8") as f:
            json.dump(subs, f, indent=2)
        print(f"Wrote {len(subs)} submissions → {args.submissions}")
        return

    print(f"Requesting student_analysis report for quiz {args.quiz}...")
    csv_bytes = generate_student_analysis(
        client, args.course, args.quiz,
        poll_interval=args.poll_interval, timeout=args.timeout)
    text = csv_bytes.decode("utf-8-sig")

    out = args.out or f"quiz_{args.quiz}_responses.csv"
    with open(out, "w", encoding="utf-8", newline="") as f:
        f.write(text)
    records = parse_student_analysis_csv(text)
    print(f"Downloaded {len(records)} student rows → {out}")

    if args.json:
        with open(args.json, "w", encoding="utf-8") as f:
            json.dump(records, f, indent=2)
        print(f"Wrote parsed records → {args.json}")


if __name__ == "__main__":
    main()
