"""Abstract base class for scoring engines."""
from abc import ABC, abstractmethod


class Scorer(ABC):
    """Base class for confidence-based scoring methods."""

    @abstractmethod
    def score(self, confidence, is_correct: bool) -> float:
        """Calculate score given confidence and correctness.

        Args:
            confidence: The confidence value (type depends on scorer).
            is_correct: Whether the answer was correct.

        Returns:
            The score as a float.
        """

    @abstractmethod
    def normalize_confidence(self, raw_confidence) -> float:
        """Normalize raw confidence to [0, 1] range for calibration metrics.

        Args:
            raw_confidence: The raw confidence from the model response.

        Returns:
            Confidence as a float in [0, 1].
        """

    @property
    @abstractmethod
    def name(self) -> str:
        """Human-readable name of this scoring method."""

    @property
    @abstractmethod
    def confidence_type(self) -> str:
        """Either 'discrete' or 'continuous'."""
