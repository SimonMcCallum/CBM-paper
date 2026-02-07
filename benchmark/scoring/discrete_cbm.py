"""Discrete 3-level Confidence-Based Marking scorer.

Scoring matrix (from prompts.json):
  Level 1 (Low):    correct +1.0,  incorrect  0.0
  Level 2 (Medium): correct +1.5,  incorrect -0.5
  Level 3 (High):   correct +2.0,  incorrect -2.0
"""
from .base import Scorer

CBM_MATRIX = {
    1: {"correct": 1.0, "incorrect": 0.0, "label": "Low (<50%)"},
    2: {"correct": 1.5, "incorrect": -0.5, "label": "Medium (50-75%)"},
    3: {"correct": 2.0, "incorrect": -2.0, "label": "High (>75%)"},
}

# Mapping from discrete level to normalized [0,1] confidence
LEVEL_TO_NORMALIZED = {1: 0.25, 2: 0.625, 3: 0.875}


class DiscreteCBMScorer(Scorer):
    """Three-level discrete confidence-based marking."""

    def score(self, confidence: int, is_correct: bool) -> float:
        level = int(round(confidence))
        level = max(1, min(3, level))
        key = "correct" if is_correct else "incorrect"
        return CBM_MATRIX[level][key]

    def normalize_confidence(self, raw_confidence) -> float:
        level = int(round(raw_confidence))
        level = max(1, min(3, level))
        return LEVEL_TO_NORMALIZED[level]

    @property
    def name(self) -> str:
        return "Discrete CBM"

    @property
    def confidence_type(self) -> str:
        return "discrete"
