"""
Canvas REST API question-bank ingestion for NUKU (VUW Canvas).

Pulls quiz questions directly from Canvas via the REST API and writes them into
the CBM LTI plugin's `question_bank` table (the same table the QTI import path
populates), so System 2's embedding/matcher can use them. A JSON-only mode is
also provided for inspection without touching the database.

Design notes
------------
* Stdlib only (urllib) — no pip install needed, runnable on any box that has the
  Canvas token. This deliberately mirrors the lightweight style of the other
  Canvas_update scripts.
* Classic Quizzes are fully supported: the `/quizzes/:id/questions` endpoint
  returns answers WITH correctness weights when called with a teacher token.
* New Quizzes are detected and reported. Their content lives behind a different
  API (`/api/quiz/v1/...`) with a different shape; a best-effort fetch is
  included but is marked UNVERIFIED — confirm against a live New Quiz before
  relying on it. Classic export (QTI) remains the reliable fallback.
* Canvas REST has no stable public "question banks" endpoint; banks are exposed
  through quizzes (or QTI export). This tool ingests per-quiz questions.

Auth / config (env or CLI):
  CANVAS_BASE_URL   e.g. https://canvas.vuw.ac.nz   (a.k.a. NUKU)
  CANVAS_API_TOKEN  a teacher/designer access token (Account > Settings)
  CBM_DATABASE_PATH path to cbm-lti.db (defaults to the plugin's data dir)

Usage:
  python canvas_ingest.py --course 12345 --list
  python canvas_ingest.py --course 12345 --quiz 678 --json out.json
  python canvas_ingest.py --course 12345 --all --write --bank-course-id 12345
"""

from __future__ import annotations

import os
import re
import json
import html
import uuid
import sqlite3
import argparse
import urllib.parse
import urllib.request
from typing import List, Optional, Tuple, Iterable


# ── HTML → text (no external dependency) ──────────────────────────────────

_TAG_RE = re.compile(r"<[^>]+>")
_WS_RE = re.compile(r"\s+")


def strip_html(value: Optional[str]) -> str:
    """Convert Canvas HTML fragments to clean single-spaced plain text."""
    if not value:
        return ""
    text = _TAG_RE.sub(" ", value)
    text = html.unescape(text)
    return _WS_RE.sub(" ", text).strip()


# ── Pure transforms (unit-tested in tests/test_canvas_ingest.py) ──────────

# Canvas question types we can turn into auto-gradable MCQs.
MCQ_TYPES = {
    "multiple_choice_question",
    "true_false_question",
    "multiple_answers_question",
}


def canvas_question_to_bank_row(q: dict, course_id: Optional[str] = None) -> Optional[dict]:
    """Transform a Canvas classic-quiz question dict into a question_bank row.

    Returns None for question types that aren't auto-gradable MCQs (essay,
    short answer, matching, numerical, ...) — those can't be used as validation
    MCQs and are skipped (the caller logs the count).
    """
    qtype = q.get("question_type")
    if qtype not in MCQ_TYPES:
        return None

    answers = q.get("answers") or []
    options: List[dict] = []
    correct_ids: List[str] = []

    for idx, a in enumerate(answers):
        # Answer text may be in `text`, or `html` for rich answers.
        atext = strip_html(a.get("text") or a.get("html") or "")
        if not atext:
            continue
        oid = str(a.get("id", idx))
        options.append({"id": oid, "text": atext})
        # weight == 100 (single) or > 0 (multi-answer) marks a correct option.
        if float(a.get("weight", 0) or 0) > 0:
            correct_ids.append(oid)

    if len(options) < 2 or not correct_ids:
        return None

    # Single-answer: store the one id. Multi-answer: store a sorted CSV so it is
    # deterministic and comparable on the answer side.
    if qtype == "multiple_answers_question":
        correct_answer = ",".join(sorted(correct_ids))
        norm_type = "multiple_answers"
    else:
        correct_answer = correct_ids[0]
        norm_type = "true_false" if qtype == "true_false_question" else "multiple_choice"

    return {
        "id": str(uuid.uuid4()),
        "course_id": course_id,
        "question_text": strip_html(q.get("question_text")),
        "question_type": norm_type,
        "options": options,
        "correct_answer": correct_answer,
        "topic": strip_html(q.get("question_name")) or None,
        "source": "imported",
        "qti_identifier": f"canvas:{q.get('quiz_id')}:{q.get('id')}",
    }


def transform_questions(questions: Iterable[dict],
                        course_id: Optional[str] = None) -> Tuple[List[dict], int]:
    """Map a list of Canvas questions to bank rows. Returns (rows, skipped)."""
    rows, skipped = [], 0
    for q in questions:
        row = canvas_question_to_bank_row(q, course_id)
        if row is None:
            skipped += 1
        else:
            rows.append(row)
    return rows, skipped


# ── Canvas REST client (urllib, with Link-header pagination) ──────────────

class CanvasClient:
    def __init__(self, base_url: str, token: str):
        self.base_url = base_url.rstrip("/")
        self.token = token

    def _request(self, path_or_url: str) -> Tuple[list | dict, Optional[str]]:
        url = path_or_url if path_or_url.startswith("http") else f"{self.base_url}{path_or_url}"
        req = urllib.request.Request(url, headers={
            "Authorization": f"Bearer {self.token}",
            "Accept": "application/json",
        })
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            next_url = _parse_next_link(resp.headers.get("Link", ""))
        return data, next_url

    def get_paginated(self, path: str) -> List[dict]:
        """GET a list endpoint, following Link rel="next" pagination."""
        out: List[dict] = []
        sep = "&" if "?" in path else "?"
        url: Optional[str] = f"{path}{sep}per_page=100"
        while url:
            data, url = self._request(url)
            if isinstance(data, list):
                out.extend(data)
            else:
                out.append(data)
        return out

    # Classic Quizzes
    def list_quizzes(self, course_id: str) -> List[dict]:
        return self.get_paginated(f"/api/v1/courses/{course_id}/quizzes")

    def list_quiz_questions(self, course_id: str, quiz_id: str) -> List[dict]:
        return self.get_paginated(
            f"/api/v1/courses/{course_id}/quizzes/{quiz_id}/questions")

    # New Quizzes detection (they surface as quiz_lti assignments)
    def list_assignments(self, course_id: str) -> List[dict]:
        return self.get_paginated(f"/api/v1/courses/{course_id}/assignments")

    def list_new_quiz_items(self, course_id: str, assignment_id: str) -> List[dict]:
        # UNVERIFIED against a live New Quiz — shape differs from classic.
        return self.get_paginated(
            f"/api/quiz/v1/courses/{course_id}/quizzes/{assignment_id}/items")


def _parse_next_link(link_header: str) -> Optional[str]:
    """Extract the rel="next" URL from a Canvas Link header."""
    if not link_header:
        return None
    for part in link_header.split(","):
        segs = part.split(";")
        if len(segs) < 2:
            continue
        url = segs[0].strip().strip("<>")
        if any('rel="next"' in s for s in segs[1:]):
            return url
    return None


def detect_new_quizzes(assignments: List[dict]) -> List[dict]:
    """Return assignments that are New Quizzes (quiz_lti)."""
    return [a for a in assignments if a.get("is_quiz_lti_assignment")]


# ── DB write (matches migrations/001_schema.sql question_bank) ────────────

def default_db_path() -> str:
    return os.getenv(
        "CBM_DATABASE_PATH",
        os.path.join(os.path.dirname(__file__), "../cbm-lti-plugin/data/cbm-lti.db"),
    )


def write_bank_rows(rows: List[dict], db_path: str) -> int:
    """Insert bank rows. De-dupes on qti_identifier so re-runs are idempotent."""
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    inserted = 0
    for r in rows:
        existing = cur.execute(
            "SELECT id FROM question_bank WHERE qti_identifier = ?",
            (r["qti_identifier"],),
        ).fetchone()
        if existing:
            continue
        cur.execute(
            """INSERT INTO question_bank
               (id, course_id, question_text, question_type, options,
                correct_answer, topic, source, qti_identifier)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (r["id"], r["course_id"], r["question_text"], r["question_type"],
             json.dumps(r["options"]), r["correct_answer"], r["topic"],
             r["source"], r["qti_identifier"]),
        )
        inserted += 1
    conn.commit()
    conn.close()
    return inserted


# ── CLI ───────────────────────────────────────────────────────────────────

def main():
    p = argparse.ArgumentParser(description="Ingest Canvas (NUKU) quiz questions into the CBM question bank")
    p.add_argument("--course", required=True, help="Canvas course id")
    p.add_argument("--quiz", help="Single classic quiz id (omit with --all)")
    p.add_argument("--all", action="store_true", help="Ingest all classic quizzes in the course")
    p.add_argument("--list", action="store_true", help="Just list quizzes / detect New Quizzes")
    p.add_argument("--write", action="store_true", help="Write rows into the question_bank table")
    p.add_argument("--json", metavar="FILE", help="Write transformed rows to a JSON file")
    p.add_argument("--bank-course-id", help="course_id to tag bank rows with (default: --course; use '' for global)")
    p.add_argument("--base-url", default=os.getenv("CANVAS_BASE_URL"))
    p.add_argument("--token", default=os.getenv("CANVAS_API_TOKEN"))
    p.add_argument("--db", default=default_db_path())
    args = p.parse_args()

    if not args.base_url or not args.token:
        p.error("CANVAS_BASE_URL and CANVAS_API_TOKEN (env or --base-url/--token) are required")

    client = CanvasClient(args.base_url, args.token)
    bank_course_id = args.course if args.bank_course_id is None else (args.bank_course_id or None)

    if args.list:
        quizzes = client.list_quizzes(args.course)
        print(f"Classic quizzes ({len(quizzes)}):")
        for q in quizzes:
            print(f"  [{q.get('id')}] {q.get('title')} — {q.get('question_count')} questions")
        new_quizzes = detect_new_quizzes(client.list_assignments(args.course))
        if new_quizzes:
            print(f"\nNew Quizzes detected ({len(new_quizzes)}) — NOT ingestible via the classic API:")
            for a in new_quizzes:
                print(f"  [assignment {a.get('id')}] {a.get('name')}")
            print("  → Use Canvas QTI export for these, or the (unverified) New Quizzes items API.")
        return

    # Collect classic quiz questions
    quiz_ids: List[str] = []
    if args.all:
        quiz_ids = [str(q["id"]) for q in client.list_quizzes(args.course)]
    elif args.quiz:
        quiz_ids = [args.quiz]
    else:
        p.error("specify --quiz <id>, --all, or --list")

    all_rows: List[dict] = []
    total_skipped = 0
    for qid in quiz_ids:
        questions = client.list_quiz_questions(args.course, qid)
        rows, skipped = transform_questions(questions, bank_course_id)
        all_rows.extend(rows)
        total_skipped += skipped
        print(f"quiz {qid}: {len(rows)} MCQs ingested, {skipped} non-MCQ skipped")

    print(f"\nTotal: {len(all_rows)} bank rows, {total_skipped} skipped")

    if args.json:
        with open(args.json, "w", encoding="utf-8") as f:
            json.dump(all_rows, f, indent=2)
        print(f"Wrote JSON → {args.json}")

    if args.write:
        inserted = write_bank_rows(all_rows, args.db)
        print(f"Inserted {inserted} new rows into {args.db}")
        print("Next: POST /api/validator/embed-bank (or re-run a QTI import) to embed them.")


if __name__ == "__main__":
    main()
