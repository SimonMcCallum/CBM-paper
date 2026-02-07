"""Linear (two-turn) prompting strategy.

Turn 1: Ask for the answer only.
Turn 2: Ask for confidence level, with the scoring explanation.
The conversation context is maintained between turns.
"""
from typing import Optional
from .base import PromptingStrategy
from . import templates


class LinearStrategy(PromptingStrategy):
    """Two-turn prompt: answer first, then confidence in follow-up."""

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
            templates.DISCRETE_LINEAR_PROMPT_Q
            if self._scoring_method == "discrete"
            else templates.HLCC_LINEAR_PROMPT_Q
        )
        return template.format(
            question=question["question"],
            options=self.format_options(question["options"]),
        )

    def build_followup(self, question: dict, model_answer: str) -> Optional[str]:
        if self._scoring_method == "discrete":
            return templates.DISCRETE_LINEAR_PROMPT_C
        else:
            return templates.HLCC_LINEAR_PROMPT_C

    @property
    def is_multi_turn(self) -> bool:
        return True

    @property
    def name(self) -> str:
        return f"{self._scoring_method}_linear"
