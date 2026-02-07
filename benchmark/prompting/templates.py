"""Prompt templates for all 4 confidence variants.

Variants:
  - discrete_combined: Answer + confidence level {1,2,3} in one prompt
  - discrete_linear: Turn 1 answer, Turn 2 confidence level {1,2,3}
  - hlcc_combined: Answer + confidence [0.0-1.0] in one prompt
  - hlcc_linear: Turn 1 answer, Turn 2 confidence [0.0-1.0]
"""

DISCRETE_COMBINED_PROMPT = """Answer the following multiple choice question and state your confidence level.

Question: {question}

Options:
{options}

Respond in JSON format exactly like this:
{{"answer": "A", "confidence": 2}}

Where confidence is:
  1 = Low (you are guessing; correct +1.0, incorrect 0)
  2 = Medium (you are somewhat confident; correct +1.5, incorrect -0.5)
  3 = High (you are very confident; correct +2.0, incorrect -2.0)

Respond ONLY with the JSON object, no other text."""

DISCRETE_LINEAR_PROMPT_Q = """Answer the following multiple choice question.

Question: {question}

Options:
{options}

Respond with ONLY a single letter (e.g., A), no other text."""

DISCRETE_LINEAR_PROMPT_C = """Now rate your confidence in your previous answer.

The confidence level will change your score on the question:
  1 = Low (correct +1.0, incorrect 0)
  2 = Medium (correct +1.5, incorrect -0.5)
  3 = High (correct +2.0, incorrect -2.0)

Respond with ONLY a single number (1, 2, or 3), no other text."""

HLCC_COMBINED_PROMPT = """Answer the following multiple choice question and state your confidence as a decimal between 0.0 and 1.0.

Question: {question}

Options:
{options}

Respond in JSON format exactly like this:
{{"answer": "A", "confidence": 0.85}}

Your confidence score (x) affects your mark:
  - If correct: score = x + 1 (range: 1.0 to 2.0)
  - If incorrect: score = -2 * x^2 (range: 0 to -2.0)

Your optimal strategy is to set confidence equal to your true probability of being correct.

Respond ONLY with the JSON object, no other text."""

HLCC_LINEAR_PROMPT_Q = """Answer the following multiple choice question.

Question: {question}

Options:
{options}

Respond with ONLY a single letter (e.g., A), no other text."""

HLCC_LINEAR_PROMPT_C = """Now rate your confidence in your previous answer as a decimal between 0.0 and 1.0.

Your confidence score (x) affects your mark:
  - If correct: score = x + 1 (range: 1.0 to 2.0)
  - If incorrect: score = -2 * x^2 (range: 0 to -2.0)

Your optimal strategy is to set confidence equal to your true probability of being correct.

Respond with ONLY a single decimal number between 0.0 and 1.0, no other text."""
