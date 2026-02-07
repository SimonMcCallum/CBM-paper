"""Convert downloaded datasets to unified question format.

Unified format (compatible with existing mcq.json schema):
{
    "id": "mmlu_abstract_algebra_001",
    "dataset": "mmlu",
    "subject": "abstract_algebra",
    "question": "Find the degree of...",
    "options": [
        {"key": "A", "text": "The degree is 4"},
        {"key": "B", "text": "The degree is 2"},
        ...
    ],
    "correctAnswer": "A",
    "metadata": {
        "source_dataset": "mmlu",
        "source_split": "test",
        "source_index": 0,
        "difficulty": null
    }
}
"""
import json
from pathlib import Path
from typing import Optional
from benchmark.config import CACHE_DIR, UNIFIED_DIR

OPTION_KEYS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"]


def convert_mmlu(
    cache_dir: Path = CACHE_DIR,
    output_dir: Path = UNIFIED_DIR,
    sample_size: Optional[int] = None,
) -> list:
    """Convert MMLU to unified format.

    Args:
        cache_dir: Directory with raw downloaded data.
        output_dir: Directory to write unified JSON.
        sample_size: If set, take at most this many questions per subject.

    Returns:
        List of unified question dicts.
    """
    raw_file = cache_dir / "mmlu_raw.json"
    if not raw_file.exists():
        raise FileNotFoundError(f"MMLU not downloaded. Run downloader first. Expected: {raw_file}")

    with open(raw_file, "r", encoding="utf-8") as f:
        raw = json.load(f)

    int_to_letter = {0: "A", 1: "B", 2: "C", 3: "D"}
    questions = []

    for subject, items in sorted(raw.items()):
        subset = items[:sample_size] if sample_size else items
        for idx, item in enumerate(subset):
            choices = item["choices"]
            options = [
                {"key": OPTION_KEYS[i], "text": choices[i]}
                for i in range(len(choices))
            ]
            correct = int_to_letter.get(item["answer"], "A")
            questions.append({
                "id": f"mmlu_{subject}_{idx:04d}",
                "dataset": "mmlu",
                "subject": subject,
                "question": item["question"],
                "options": options,
                "correctAnswer": correct,
                "metadata": {
                    "source_dataset": "mmlu",
                    "source_split": "test",
                    "source_index": idx,
                    "difficulty": None,
                },
            })

    output_dir.mkdir(parents=True, exist_ok=True)
    output_file = output_dir / "mmlu.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump({"questions": questions}, f, indent=2)

    print(f"Converted MMLU: {len(questions)} questions -> {output_file}")
    return questions


def convert_truthfulqa(
    cache_dir: Path = CACHE_DIR,
    output_dir: Path = UNIFIED_DIR,
) -> list:
    """Convert TruthfulQA to unified format using mc1_targets (single correct)."""
    raw_file = cache_dir / "truthfulqa_raw.json"
    if not raw_file.exists():
        raise FileNotFoundError(f"TruthfulQA not downloaded. Run downloader first. Expected: {raw_file}")

    with open(raw_file, "r", encoding="utf-8") as f:
        raw = json.load(f)

    questions = []

    for idx, item in enumerate(raw):
        mc1 = item["mc1_targets"]
        choices = mc1["choices"]
        labels = mc1["labels"]

        options = [
            {"key": OPTION_KEYS[i], "text": choices[i]}
            for i in range(len(choices))
        ]

        # Find the correct answer (label == 1)
        correct_idx = labels.index(1) if 1 in labels else 0
        correct = OPTION_KEYS[correct_idx]

        questions.append({
            "id": f"truthfulqa_{idx:04d}",
            "dataset": "truthfulqa",
            "subject": None,
            "question": item["question"],
            "options": options,
            "correctAnswer": correct,
            "metadata": {
                "source_dataset": "truthfulqa",
                "source_split": "validation",
                "source_index": idx,
                "difficulty": None,
            },
        })

    output_dir.mkdir(parents=True, exist_ok=True)
    output_file = output_dir / "truthfulqa.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump({"questions": questions}, f, indent=2)

    print(f"Converted TruthfulQA: {len(questions)} questions -> {output_file}")
    return questions


def convert_arc(
    cache_dir: Path = CACHE_DIR,
    output_dir: Path = UNIFIED_DIR,
) -> list:
    """Convert ARC (Challenge + Easy) to unified format."""
    raw_file = cache_dir / "arc_raw.json"
    if not raw_file.exists():
        raise FileNotFoundError(f"ARC not downloaded. Run downloader first. Expected: {raw_file}")

    with open(raw_file, "r", encoding="utf-8") as f:
        raw = json.load(f)

    questions = []

    for difficulty, items in [("challenge", raw["challenge"]), ("easy", raw["easy"])]:
        for idx, item in enumerate(items):
            texts = item["choices_text"]
            labels = item["choices_label"]

            options = [
                {"key": labels[i], "text": texts[i]}
                for i in range(len(texts))
            ]

            # ARC answerKey can be a letter (A,B,C,D) or a number (1,2,3,4)
            answer_key = item["answerKey"]
            if answer_key.isdigit():
                answer_idx = int(answer_key) - 1
                answer_key = labels[answer_idx] if answer_idx < len(labels) else "A"

            questions.append({
                "id": f"arc_{difficulty}_{idx:04d}",
                "dataset": "arc",
                "subject": difficulty,
                "question": item["question"],
                "options": options,
                "correctAnswer": answer_key,
                "metadata": {
                    "source_dataset": "arc",
                    "source_split": "test",
                    "source_index": idx,
                    "difficulty": difficulty,
                },
            })

    output_dir.mkdir(parents=True, exist_ok=True)
    output_file = output_dir / "arc.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump({"questions": questions}, f, indent=2)

    print(f"Converted ARC: {len(questions)} questions -> {output_file}")
    return questions


def convert_all(
    cache_dir: Path = CACHE_DIR,
    output_dir: Path = UNIFIED_DIR,
    mmlu_sample_size: Optional[int] = None,
):
    """Convert all downloaded datasets to unified format."""
    convert_mmlu(cache_dir, output_dir, sample_size=mmlu_sample_size)
    convert_truthfulqa(cache_dir, output_dir)
    convert_arc(cache_dir, output_dir)
    print("All datasets converted to unified format.")
