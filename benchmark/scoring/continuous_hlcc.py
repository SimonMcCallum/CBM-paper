"""Continuous HLCC (Human-calibrated Log-loss with Confidence) scorer.

Scoring function:
  Correct answer:   score = x + 1       (range: 1.0 to 2.0)
  Incorrect answer:  score = -2 * x^2    (range: 0.0 to -2.0)

Where x is confidence in [0, 1].

Properties:
  - At x=0: correct=1.0, incorrect=0.0 (safe default)
  - At x=1: correct=2.0, incorrect=-2.0 (maximum stakes)
  - Incentive-compatible: optimal x = P(correct)
  - The expected score is maximized when reported confidence equals true probability
"""
from .base import Scorer


class ContinuousHLCCScorer(Scorer):
    """Continuous confidence scoring with HLCC function."""

    def score(self, confidence: float, is_correct: bool) -> float:
        x = max(0.0, min(1.0, float(confidence)))
        if is_correct:
            return x + 1.0
        else:
            return -2.0 * x * x

    def normalize_confidence(self, raw_confidence) -> float:
        return max(0.0, min(1.0, float(raw_confidence)))

    @property
    def name(self) -> str:
        return "Continuous HLCC"

    @property
    def confidence_type(self) -> str:
        return "continuous"
