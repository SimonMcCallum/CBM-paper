"""Combined (single-turn) prompting strategy.

Asks for both answer and confidence in a single prompt.
Supports both discrete (1-3) and continuous (0.0-1.0) confidence.
"""
from typing import Optional
from .base import PromptingStrategy
from . import templates


class CombinedStrategy(PromptingStrategy):
    """Single-turn prompt: answer + confidence together."""

    def __init__(self, scoring_method: str):
        """
        Args:
            scoring_method: Either 'discrete' or 'hlcc'.
        """
        if scoring_method not in ("discrete", "hlcc"):
            raise ValueError(f"scoring_method must be 'discrete' or 'hlcc', got '{scoring_method}'")
        self._scoring_method = scoring_method

    def build_prompt(self, question: dict) -> str:
        template = (
            templates.DISCRETE_COMBINED_PROMPT
            if self._scoring_method == "discrete"
            else templates.HLCC_COMBINED_PROMPT
        )
        return template.format(
            question=question["question"],
            options=self.format_options(question["options"]),
        )

    def build_followup(self, question: dict, model_answer: str) -> Optional[str]:
        return None  # Single-turn, no follow-up

    @property
    def is_multi_turn(self) -> bool:
        return False

    @property
    def name(self) -> str:
        return f"{self._scoring_method}_combined"
