"""Parse model responses to extract answer and confidence.

Handles JSON responses, malformed JSON, and plain text fallbacks.
Supports both discrete (1-3) and continuous (0.0-1.0) confidence formats.
"""
import json
import re
from dataclasses import dataclass
from typing import Optional


@dataclass
class ParsedResponse:
    """Parsed answer and confidence from a model response."""
    answer: str           # The selected option letter (e.g., "A")
    confidence: float     # Raw confidence value (1-3 for discrete, 0-1 for continuous)
    raw_text: str         # The original response text
    parse_method: str     # How the response was parsed ("json", "regex", "fallback")


def parse_combined_response(content: str, confidence_type: str) -> ParsedResponse:
    """Parse a combined (single-turn) response containing answer + confidence.

    Args:
        content: The model's raw response text.
        confidence_type: Either 'discrete' or 'continuous'.

    Returns:
        ParsedResponse with extracted answer and confidence.
    """
    # Try JSON parsing first
    parsed = _try_json_parse(content, confidence_type)
    if parsed:
        return parsed

    # Try extracting JSON from markdown code blocks
    parsed = _try_json_from_codeblock(content, confidence_type)
    if parsed:
        return parsed

    # Fallback to regex extraction
    return _regex_extract_combined(content, confidence_type)


def parse_answer_only(content: str) -> str:
    """Parse a response that should contain only an answer letter.

    Args:
        content: The model's raw response text.

    Returns:
        The answer letter (e.g., "A"), or empty string if not found.
    """
    text = content.strip().upper()

    # Direct single letter
    if len(text) == 1 and text in "ABCDEFGHIJ":
        return text

    # Letter with period or parenthesis: "A." or "A)"
    match = re.match(r'^([A-J])[.):\s]', text)
    if match:
        return match.group(1)

    # "The answer is X" pattern
    match = re.search(r'(?:answer|option|choice)\s*(?:is|:)\s*([A-Ja-j])', text, re.IGNORECASE)
    if match:
        return match.group(1).upper()

    # Just find the first standalone letter A-J
    match = re.search(r'\b([A-Ja-j])\b', text)
    if match:
        return match.group(1).upper()

    return ""


def parse_confidence_only(content: str, confidence_type: str) -> float:
    """Parse a response that should contain only a confidence value.

    Args:
        content: The model's raw response text.
        confidence_type: Either 'discrete' or 'continuous'.

    Returns:
        The confidence value.
    """
    text = content.strip()

    if confidence_type == "discrete":
        # Look for integer 1, 2, or 3
        match = re.search(r'\b([123])\b', text)
        if match:
            return float(match.group(1))
        return 2.0  # Default to medium

    else:  # continuous
        # Look for a decimal number between 0 and 1
        match = re.search(r'\b(0\.\d+|1\.0|0|1)\b', text)
        if match:
            return float(match.group(1))

        # Look for any number and normalize
        match = re.search(r'(\d+\.?\d*)', text)
        if match:
            val = float(match.group(1))
            if val > 1.0:
                val = val / 100.0  # e.g., 85 -> 0.85
            return max(0.0, min(1.0, val))

        return 0.5  # Default to mid-confidence


def _try_json_parse(content: str, confidence_type: str) -> Optional[ParsedResponse]:
    """Try to parse the content as JSON."""
    text = content.strip()
    # Find JSON object in the text
    start = text.find('{')
    end = text.rfind('}')
    if start == -1 or end == -1:
        return None

    try:
        data = json.loads(text[start:end + 1])
    except json.JSONDecodeError:
        return None

    answer = data.get("answer", data.get("selected_option", ""))
    answer = str(answer).strip().upper()
    if len(answer) > 1:
        # Try to extract just the letter
        match = re.match(r'([A-Ja-j])', answer)
        answer = match.group(1).upper() if match else answer[:1].upper()

    confidence = data.get("confidence", data.get("confidence_level", None))
    if confidence is None:
        confidence = 2.0 if confidence_type == "discrete" else 0.5
    else:
        confidence = float(confidence)
        if confidence_type == "continuous" and confidence > 1.0:
            confidence = confidence / 100.0

    return ParsedResponse(
        answer=answer,
        confidence=confidence,
        raw_text=content,
        parse_method="json",
    )


def _try_json_from_codeblock(content: str, confidence_type: str) -> Optional[ParsedResponse]:
    """Try to extract JSON from markdown code blocks."""
    match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', content, re.DOTALL)
    if match:
        return _try_json_parse(match.group(1), confidence_type)
    return None


def _regex_extract_combined(content: str, confidence_type: str) -> ParsedResponse:
    """Fallback regex extraction for combined responses."""
    answer = parse_answer_only(content)
    confidence = parse_confidence_only(content, confidence_type)

    return ParsedResponse(
        answer=answer,
        confidence=confidence,
        raw_text=content,
        parse_method="regex" if answer else "fallback",
    )
