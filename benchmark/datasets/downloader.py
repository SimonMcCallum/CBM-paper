"""Download benchmark datasets from HuggingFace."""
import json
from pathlib import Path
from benchmark.config import CACHE_DIR, UNIFIED_DIR


def download_mmlu(cache_dir: Path = CACHE_DIR) -> dict:
    """Download MMLU dataset from HuggingFace.

    Returns dict with subjects as keys, each containing list of question dicts.
    """
    from datasets import load_dataset

    cache_dir.mkdir(parents=True, exist_ok=True)
    cache_file = cache_dir / "mmlu_raw.json"

    if cache_file.exists():
        print("Loading MMLU from cache...")
        with open(cache_file, "r", encoding="utf-8") as f:
            return json.load(f)

    print("Downloading MMLU from HuggingFace...")
    dataset = load_dataset("cais/mmlu", "all", trust_remote_code=True)

    result = {}
    for split_name in ["test"]:
        split = dataset[split_name]
        for row in split:
            subject = row.get("subject", "unknown")
            if subject not in result:
                result[subject] = []
            result[subject].append({
                "question": row["question"],
                "choices": row["choices"],
                "answer": row["answer"],  # int 0-3
            })

    with open(cache_file, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)

    total = sum(len(v) for v in result.values())
    print(f"Downloaded MMLU: {total} questions across {len(result)} subjects")
    return result


def download_truthfulqa(cache_dir: Path = CACHE_DIR) -> list:
    """Download TruthfulQA dataset from HuggingFace.

    Returns list of question dicts with mc1 (single correct) targets.
    """
    from datasets import load_dataset

    cache_dir.mkdir(parents=True, exist_ok=True)
    cache_file = cache_dir / "truthfulqa_raw.json"

    if cache_file.exists():
        print("Loading TruthfulQA from cache...")
        with open(cache_file, "r", encoding="utf-8") as f:
            return json.load(f)

    print("Downloading TruthfulQA from HuggingFace...")
    dataset = load_dataset("truthful_qa", "multiple_choice", trust_remote_code=True)

    result = []
    for row in dataset["validation"]:
        result.append({
            "question": row["question"],
            "mc1_targets": row["mc1_targets"],  # {"choices": [...], "labels": [0,1,...]}
            "mc2_targets": row["mc2_targets"],
        })

    with open(cache_file, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)

    print(f"Downloaded TruthfulQA: {len(result)} questions")
    return result


def download_arc(cache_dir: Path = CACHE_DIR) -> dict:
    """Download ARC dataset from HuggingFace.

    Returns dict with 'challenge' and 'easy' splits.
    """
    from datasets import load_dataset

    cache_dir.mkdir(parents=True, exist_ok=True)
    cache_file = cache_dir / "arc_raw.json"

    if cache_file.exists():
        print("Loading ARC from cache...")
        with open(cache_file, "r", encoding="utf-8") as f:
            return json.load(f)

    print("Downloading ARC from HuggingFace...")
    result = {"challenge": [], "easy": []}

    for config, key in [("ARC-Challenge", "challenge"), ("ARC-Easy", "easy")]:
        dataset = load_dataset("allenai/ai2_arc", config, trust_remote_code=True)
        for row in dataset["test"]:
            result[key].append({
                "question": row["question"],
                "choices_text": row["choices"]["text"],
                "choices_label": row["choices"]["label"],
                "answerKey": row["answerKey"],
            })

    with open(cache_file, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)

    total = sum(len(v) for v in result.values())
    print(f"Downloaded ARC: {total} questions ({len(result['challenge'])} challenge, {len(result['easy'])} easy)")
    return result


def download_all(cache_dir: Path = CACHE_DIR):
    """Download all datasets."""
    download_mmlu(cache_dir)
    download_truthfulqa(cache_dir)
    download_arc(cache_dir)
    print("All datasets downloaded.")
