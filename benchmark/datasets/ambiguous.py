"""Ambiguous question loader and calibration scoring.

Ambiguous questions have no single correct answer or have genuinely uncertain answers.
A well-calibrated model should express LOW confidence on these questions.
The key metric is calibration gap: how much the model's confidence exceeds ideal confidence.
"""
import json
import shutil
from pathlib import Path
from typing import List, Dict

from benchmark.config import DATASETS_DIR, UNIFIED_DIR


def load_ambiguous(
    source_file: Path = None,
    output_dir: Path = UNIFIED_DIR,
) -> List[Dict]:
    """Load ambiguous questions and copy to unified directory.

    Args:
        source_file: Path to ambiguous_questions.json. Defaults to the one in datasets/.
        output_dir: Where to write the unified-format copy.

    Returns:
        List of question dicts.
    """
    source = source_file or (DATASETS_DIR / "ambiguous_questions.json")
    if not source.exists():
        raise FileNotFoundError(f"Ambiguous questions file not found: {source}")

    with open(source, "r", encoding="utf-8") as f:
        data = json.load(f)

    questions = data.get("questions", [])

    # Write to unified directory in the same format as other datasets
    output_dir.mkdir(parents=True, exist_ok=True)
    output_file = output_dir / "ambiguous.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump({"questions": questions}, f, indent=2)

    print(f"Loaded {len(questions)} ambiguous questions -> {output_file}")
    return questions


def compute_ambiguous_metrics(results: List[Dict]) -> Dict:
    """Compute metrics specific to ambiguous question performance.

    Args:
        results: List of result dicts with keys: confidence_normalized, is_correct, question_id.

    Returns:
        Dict with calibration metrics for ambiguous questions.
    """
    # Load expected confidence from source file
    source = DATASETS_DIR / "ambiguous_questions.json"
    with open(source, "r", encoding="utf-8") as f:
        data = json.load(f)

    expected = {}
    for q in data.get("questions", []):
        expected[q["id"]] = q.get("expected_confidence", 0.25)

    if not results:
        return {"avg_confidence": 0, "avg_expected": 0, "calibration_gap": 0, "n": 0}

    total_confidence = 0
    total_expected = 0
    n = 0

    for r in results:
        qid = r.get("question_id", "")
        exp = expected.get(qid, 0.25)
        conf = r.get("confidence_normalized", 0.5)
        total_confidence += conf
        total_expected += exp
        n += 1

    avg_confidence = total_confidence / n if n else 0
    avg_expected = total_expected / n if n else 0

    return {
        "avg_confidence_on_ambiguous": round(avg_confidence, 4),
        "ideal_avg_confidence": round(avg_expected, 4),
        "calibration_gap": round(avg_confidence - avg_expected, 4),
        "overconfidence_rate": round(
            sum(1 for r in results
                if r.get("confidence_normalized", 0.5) > expected.get(r.get("question_id", ""), 0.25))
            / n if n else 0,
            4
        ),
        "n_questions": n,
    }
