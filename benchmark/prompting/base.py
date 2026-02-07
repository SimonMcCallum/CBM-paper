"""Abstract base class for prompting strategies."""
from abc import ABC, abstractmethod
from typing import List, Tuple, Optional


class PromptingStrategy(ABC):
    """Base class for confidence elicitation prompting strategies."""

    @abstractmethod
    def build_prompt(self, question: dict) -> str:
        """Build the initial prompt for a question.

        Args:
            question: Unified question dict with keys: question, options, correctAnswer.

        Returns:
            The prompt string to send to the model.
        """

    @abstractmethod
    def build_followup(self, question: dict, model_answer: str) -> Optional[str]:
        """Build a follow-up prompt for confidence (if multi-turn).

        Args:
            question: The original question dict.
            model_answer: The model's answer from the first turn.

        Returns:
            Follow-up prompt string, or None if single-turn.
        """

    @property
    @abstractmethod
    def is_multi_turn(self) -> bool:
        """Whether this strategy requires multiple conversation turns."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Human-readable name of this strategy."""

    def format_options(self, options: list) -> str:
        """Format options list into readable text."""
        return "\n".join(f"  {opt['key']}) {opt['text']}" for opt in options)
