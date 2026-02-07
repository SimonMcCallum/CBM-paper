"""Calibration metrics for evaluating confidence quality.

Metrics:
  - ECE (Expected Calibration Error): Weighted average of |accuracy - confidence| per bin
  - Brier Score: Mean squared error of confidence as probability estimate
  - Overconfidence Rate: Fraction of bins where confidence > accuracy
  - Reliability Diagram: Per-bin accuracy vs confidence data for plotting
"""
from typing import List, Tuple
import math


def compute_ece(
    confidences: List[float],
    correctness: List[bool],
    n_bins: int = 10,
) -> float:
    """Compute Expected Calibration Error.

    Args:
        confidences: Normalized confidence values in [0, 1].
        correctness: Whether each prediction was correct.
        n_bins: Number of bins for grouping.

    Returns:
        ECE value (0 = perfectly calibrated, 1 = worst).
    """
    if not confidences:
        return 0.0

    n = len(confidences)
    bin_boundaries = [i / n_bins for i in range(n_bins + 1)]
    ece = 0.0

    for i in range(n_bins):
        lo, hi = bin_boundaries[i], bin_boundaries[i + 1]
        indices = [
            j for j, c in enumerate(confidences)
            if (lo <= c < hi) or (i == n_bins - 1 and c == hi)
        ]
        if not indices:
            continue
        bin_accuracy = sum(1 for j in indices if correctness[j]) / len(indices)
        bin_confidence = sum(confidences[j] for j in indices) / len(indices)
        ece += (len(indices) / n) * abs(bin_accuracy - bin_confidence)

    return ece


def compute_brier_score(
    confidences: List[float],
    correctness: List[bool],
) -> float:
    """Compute Brier Score (mean squared error of probability estimates).

    Args:
        confidences: Normalized confidence values in [0, 1].
        correctness: Whether each prediction was correct.

    Returns:
        Brier score (0 = perfect, 1 = worst).
    """
    if not confidences:
        return 0.0

    n = len(confidences)
    return sum(
        (confidences[i] - (1.0 if correctness[i] else 0.0)) ** 2
        for i in range(n)
    ) / n


def compute_overconfidence_rate(
    confidences: List[float],
    correctness: List[bool],
    n_bins: int = 10,
) -> float:
    """Compute fraction of bins where mean confidence exceeds accuracy.

    Args:
        confidences: Normalized confidence values in [0, 1].
        correctness: Whether each prediction was correct.
        n_bins: Number of bins.

    Returns:
        Fraction of non-empty bins that are overconfident (0 to 1).
    """
    if not confidences:
        return 0.0

    bin_boundaries = [i / n_bins for i in range(n_bins + 1)]
    overconfident = 0
    total_nonempty = 0

    for i in range(n_bins):
        lo, hi = bin_boundaries[i], bin_boundaries[i + 1]
        indices = [
            j for j, c in enumerate(confidences)
            if (lo <= c < hi) or (i == n_bins - 1 and c == hi)
        ]
        if not indices:
            continue
        total_nonempty += 1
        bin_accuracy = sum(1 for j in indices if correctness[j]) / len(indices)
        bin_confidence = sum(confidences[j] for j in indices) / len(indices)
        if bin_confidence > bin_accuracy:
            overconfident += 1

    return overconfident / total_nonempty if total_nonempty > 0 else 0.0


def compute_reliability_diagram(
    confidences: List[float],
    correctness: List[bool],
    n_bins: int = 10,
) -> List[dict]:
    """Compute reliability diagram data (per-bin accuracy vs confidence).

    Args:
        confidences: Normalized confidence values in [0, 1].
        correctness: Whether each prediction was correct.
        n_bins: Number of bins.

    Returns:
        List of dicts with keys: bin_center, accuracy, confidence, count.
    """
    if not confidences:
        return []

    bin_boundaries = [i / n_bins for i in range(n_bins + 1)]
    bins = []

    for i in range(n_bins):
        lo, hi = bin_boundaries[i], bin_boundaries[i + 1]
        indices = [
            j for j, c in enumerate(confidences)
            if (lo <= c < hi) or (i == n_bins - 1 and c == hi)
        ]
        bin_center = (lo + hi) / 2
        if not indices:
            bins.append({
                "bin_center": bin_center,
                "accuracy": None,
                "confidence": None,
                "count": 0,
            })
        else:
            bins.append({
                "bin_center": bin_center,
                "accuracy": sum(1 for j in indices if correctness[j]) / len(indices),
                "confidence": sum(confidences[j] for j in indices) / len(indices),
                "count": len(indices),
            })

    return bins
