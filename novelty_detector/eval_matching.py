"""
Evaluation harness for System 2 submission↔question matching.

Answers the question raised in the architecture review: "do the questions the
matcher selects for a submission actually probe that submission?" It replicates
the greedy per-chunk cosine selection used by validator_api.match_questions and
scores it against ground-truth relevance labels (precision / recall / F1 / MRR),
swept across similarity thresholds.

Two ways to run:

  # Real embeddings on a labelled dataset (JSON, schema below):
  python eval_matching.py --dataset eval_data.json --model all-MiniLM-L6-v2

  # Self-contained smoke test with a tiny built-in synthetic dataset:
  python eval_matching.py --demo

Dataset JSON schema:
  {
    "bank": [{"id": "q1", "question_text": "...", "options": [{"id","text"}, ...]}],
    "submissions": [
      {"id": "s1", "chunks": ["para text", ...], "relevant_ids": ["q1", "q7"]}
    ]
  }

The matching core (`match_chunks`, `prf`) is pure NumPy so it can be unit-tested
with hand-built vectors and no model download.
"""

from __future__ import annotations

import os
import json
import argparse
from typing import Dict, List, Sequence

import numpy as np


# ── Pure matching/metric core (unit-tested) ───────────────────────────────

def _normalize(mat: np.ndarray) -> np.ndarray:
    mat = np.asarray(mat, dtype="float32")
    norms = np.linalg.norm(mat, axis=1, keepdims=True)
    norms[norms == 0] = 1
    return mat / norms


def match_chunks(chunk_vecs: np.ndarray,
                 bank_vecs: np.ndarray,
                 bank_ids: Sequence[str],
                 threshold: float = 0.5,
                 max_questions: int = 6,
                 top_k: int = 5) -> List[str]:
    """Replicate validator_api's greedy selection: for each chunk pick its best
    not-yet-used bank question above `threshold`, until `max_questions` reached.
    Returns the ordered list of selected bank ids.
    """
    chunk_vecs = _normalize(chunk_vecs)
    bank_vecs = _normalize(bank_vecs)
    sims = chunk_vecs @ bank_vecs.T  # (n_chunks, n_bank) cosine

    selected: List[str] = []
    used = set()
    for i in range(sims.shape[0]):
        if len(selected) >= max_questions:
            break
        order = np.argsort(-sims[i])[:top_k]
        for j in order:
            if bank_ids[j] in used:
                continue
            if sims[i, j] >= threshold:
                selected.append(bank_ids[j])
                used.add(bank_ids[j])
                break
    return selected


def prf(selected: Sequence[str], relevant: Sequence[str]) -> Dict[str, float]:
    """Precision/recall/F1 of a selected set against a relevant set."""
    sel, rel = set(selected), set(relevant)
    if not sel and not rel:
        return {"precision": 1.0, "recall": 1.0, "f1": 1.0, "tp": 0}
    tp = len(sel & rel)
    precision = tp / len(sel) if sel else 0.0
    recall = tp / len(rel) if rel else 0.0
    f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) else 0.0
    return {"precision": precision, "recall": recall, "f1": f1, "tp": tp}


def evaluate(submission_chunk_vecs: List[np.ndarray],
             relevant_ids: List[Sequence[str]],
             bank_vecs: np.ndarray,
             bank_ids: Sequence[str],
             thresholds: Sequence[float],
             max_questions: int = 6) -> List[dict]:
    """Sweep thresholds; return mean precision/recall/F1 per threshold."""
    results = []
    for t in thresholds:
        rows = []
        for chunk_vecs, rel in zip(submission_chunk_vecs, relevant_ids):
            selected = match_chunks(chunk_vecs, bank_vecs, bank_ids,
                                    threshold=t, max_questions=max_questions)
            rows.append(prf(selected, rel))
        results.append({
            "threshold": round(t, 3),
            "precision": round(float(np.mean([r["precision"] for r in rows])), 3),
            "recall": round(float(np.mean([r["recall"] for r in rows])), 3),
            "f1": round(float(np.mean([r["f1"] for r in rows])), 3),
        })
    return results


# ── Embedding glue (uses the same text-building rule as validator_api) ─────

def _bank_text(q: dict) -> str:
    parts = [q.get("question_text", "")]
    for o in q.get("options", []) or []:
        if isinstance(o, dict) and o.get("text"):
            parts.append(o["text"])
    return "\n".join(p for p in parts if p)


def run_on_dataset(dataset: dict, model_name: str,
                   thresholds: Sequence[float], max_questions: int) -> List[dict]:
    from sentence_transformers import SentenceTransformer
    model = SentenceTransformer(model_name)

    bank = dataset["bank"]
    bank_ids = [q["id"] for q in bank]
    bank_vecs = np.asarray(model.encode([_bank_text(q) for q in bank]), dtype="float32")

    sub_vecs, rel_ids = [], []
    for s in dataset["submissions"]:
        sub_vecs.append(np.asarray(model.encode(s["chunks"]), dtype="float32"))
        rel_ids.append(s.get("relevant_ids", []))

    return evaluate(sub_vecs, rel_ids, bank_vecs, bank_ids, thresholds, max_questions)


# ── Built-in synthetic dataset for --demo ─────────────────────────────────

def demo_dataset() -> dict:
    return {
        "bank": [
            {"id": "sort", "question_text": "What is the average time complexity of quicksort?",
             "options": [{"id": "A", "text": "O(n log n)"}, {"id": "B", "text": "O(n^2)"}]},
            {"id": "hash", "question_text": "How does a hash table resolve collisions with chaining?",
             "options": [{"id": "A", "text": "Linked lists per bucket"}, {"id": "B", "text": "Rehash all keys"}]},
            {"id": "tcp", "question_text": "What does the TCP three-way handshake establish?",
             "options": [{"id": "A", "text": "A reliable connection"}, {"id": "B", "text": "A broadcast domain"}]},
            {"id": "photo", "question_text": "What is the role of chlorophyll in photosynthesis?",
             "options": [{"id": "A", "text": "Absorbs light energy"}, {"id": "B", "text": "Stores glucose"}]},
        ],
        "submissions": [
            {"id": "cs_essay",
             "chunks": [
                 "In my project I implemented quicksort and analysed why its expected running time is n log n.",
                 "I used a hash map with separate chaining so colliding keys live in a per-bucket list.",
             ],
             "relevant_ids": ["sort", "hash"]},
            {"id": "net_essay",
             "chunks": [
                 "The client and server exchange SYN, SYN-ACK and ACK to set up a reliable TCP connection.",
             ],
             "relevant_ids": ["tcp"]},
        ],
    }


def main():
    p = argparse.ArgumentParser(description="Evaluate submission↔question matching quality")
    p.add_argument("--dataset", help="Path to labelled dataset JSON")
    p.add_argument("--demo", action="store_true", help="Run on the built-in synthetic dataset")
    p.add_argument("--model", default=os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2"))
    p.add_argument("--max-questions", type=int, default=6)
    p.add_argument("--thresholds", default="0.2,0.3,0.4,0.5,0.6")
    args = p.parse_args()

    if not args.dataset and not args.demo:
        p.error("provide --dataset FILE or --demo")

    dataset = demo_dataset() if args.demo else json.load(open(args.dataset, encoding="utf-8"))
    thresholds = [float(t) for t in args.thresholds.split(",")]

    print(f"Model: {args.model}  |  bank={len(dataset['bank'])}  submissions={len(dataset['submissions'])}")
    results = run_on_dataset(dataset, args.model, thresholds, args.max_questions)

    print(f"\n{'threshold':>10} {'precision':>10} {'recall':>8} {'f1':>6}")
    for r in results:
        print(f"{r['threshold']:>10} {r['precision']:>10} {r['recall']:>8} {r['f1']:>6}")

    best = max(results, key=lambda r: r["f1"])
    print(f"\nBest F1 = {best['f1']} at threshold {best['threshold']}")


if __name__ == "__main__":
    main()
