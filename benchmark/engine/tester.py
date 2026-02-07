"""Core benchmark runner supporting all 4 confidence variants.

Orchestrates: question loading -> prompting -> API calls -> response parsing -> scoring.
Supports both single-turn (combined) and multi-turn (linear) prompting strategies.
"""
import json
import asyncio
import aiohttp
from datetime import datetime
from dataclasses import dataclass, asdict, field
from typing import List, Dict, Optional
from pathlib import Path

from benchmark.config import TEMPERATURES, NUM_REPETITIONS, ensure_dirs
from benchmark.scoring.base import Scorer
from benchmark.scoring.discrete_cbm import DiscreteCBMScorer
from benchmark.scoring.continuous_hlcc import ContinuousHLCCScorer
from benchmark.prompting.base import PromptingStrategy
from benchmark.prompting.combined import CombinedStrategy
from benchmark.prompting.linear import LinearStrategy
from benchmark.engine.api_clients import call_model
from benchmark.engine.response_parser import (
    parse_combined_response,
    parse_answer_only,
    parse_confidence_only,
)
from benchmark.engine.rate_limiter import RateLimiter


@dataclass
class TestResult:
    """Result of a single question evaluation."""
    question_id: str
    dataset: str
    vendor: str
    model: str
    variant: str          # e.g., "discrete_combined"
    temperature: float
    iteration: int
    answer: str           # Model's selected option
    confidence_raw: float # Raw confidence value
    confidence_normalized: float  # Normalized to [0,1]
    score: float          # CBM or HLCC score
    correct_answer: str
    is_correct: bool
    parse_method: str     # How the response was parsed
    timestamp: str
    processing_time: float
    raw_response: str = ""


def get_scorer(variant: str) -> Scorer:
    """Get the scorer for a variant name."""
    if variant.startswith("discrete"):
        return DiscreteCBMScorer()
    else:
        return ContinuousHLCCScorer()


def get_strategy(variant: str) -> PromptingStrategy:
    """Get the prompting strategy for a variant name."""
    scoring_method = "discrete" if variant.startswith("discrete") else "hlcc"
    if variant.endswith("combined"):
        return CombinedStrategy(scoring_method)
    else:
        return LinearStrategy(scoring_method)


class BenchmarkRunner:
    """Runs benchmarks across models, variants, temperatures, and questions."""

    def __init__(self, models_file: Path = None):
        self.rate_limiter = RateLimiter()
        self.results: List[TestResult] = []
        self._models = None
        self._models_file = models_file

    def load_models(self, models_file: Path = None) -> Dict:
        """Load model configurations from JSON."""
        filepath = models_file or self._models_file
        if filepath is None:
            from benchmark.config import MODEL_FILE
            filepath = MODEL_FILE

        with open(filepath, "r", encoding="utf-8") as f:
            self._models = json.load(f)
        return self._models

    def load_questions(self, dataset_path: Path) -> List[Dict]:
        """Load questions from a unified-format JSON file."""
        with open(dataset_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        if "questions" in data:
            return data["questions"]
        elif "eval_data" in data:
            return data["eval_data"]
        elif isinstance(data, list):
            return data
        else:
            return []

    async def _run_single(
        self,
        session: aiohttp.ClientSession,
        question: Dict,
        vendor: str,
        model: str,
        variant: str,
        temperature: float,
        iteration: int,
    ) -> Optional[TestResult]:
        """Run a single question through one model with one variant."""
        scorer = get_scorer(variant)
        strategy = get_strategy(variant)
        confidence_type = scorer.confidence_type

        start_time = datetime.now()

        async with self.rate_limiter.get(vendor):
            if strategy.is_multi_turn:
                # Linear strategy: two turns
                prompt1 = strategy.build_prompt(question)
                messages = [{"role": "user", "content": prompt1}]

                response1 = await call_model(session, vendor, messages, model, temperature)
                if response1 is None:
                    return None

                answer = parse_answer_only(response1)

                # Build follow-up with conversation context
                messages.append({"role": "assistant", "content": response1})
                prompt2 = strategy.build_followup(question, response1)
                messages.append({"role": "user", "content": prompt2})

                response2 = await call_model(session, vendor, messages, model, temperature)
                if response2 is None:
                    return None

                confidence = parse_confidence_only(response2, confidence_type)
                raw_text = f"Turn 1: {response1}\nTurn 2: {response2}"
                parse_method = "linear"

            else:
                # Combined strategy: single turn
                prompt = strategy.build_prompt(question)
                messages = [{"role": "user", "content": prompt}]

                response = await call_model(session, vendor, messages, model, temperature)
                if response is None:
                    return None

                parsed = parse_combined_response(response, confidence_type)
                answer = parsed.answer
                confidence = parsed.confidence
                raw_text = parsed.raw_text
                parse_method = parsed.parse_method

        processing_time = (datetime.now() - start_time).total_seconds()

        # Determine correctness
        correct_answer = question.get("correctAnswer", question.get("correct_answer", ""))
        is_correct = answer.upper() == correct_answer.upper()

        # Score
        score = scorer.score(confidence, is_correct)
        confidence_normalized = scorer.normalize_confidence(confidence)

        dataset_name = question.get("dataset", "unknown")

        return TestResult(
            question_id=str(question.get("id", "")),
            dataset=dataset_name,
            vendor=vendor,
            model=model,
            variant=variant,
            temperature=temperature,
            iteration=iteration,
            answer=answer,
            confidence_raw=confidence,
            confidence_normalized=confidence_normalized,
            score=score,
            correct_answer=correct_answer,
            is_correct=is_correct,
            parse_method=parse_method,
            timestamp=start_time.isoformat(),
            processing_time=processing_time,
            raw_response=raw_text[:500],  # Truncate for storage
        )

    async def run(
        self,
        dataset_path: Path,
        variants: List[str],
        vendors: List[str] = None,
        models_filter: List[str] = None,
        temperatures: List[float] = None,
        repetitions: int = None,
        progress_callback=None,
    ) -> List[TestResult]:
        """Run the benchmark.

        Args:
            dataset_path: Path to unified-format JSON questions file.
            variants: List of variant names to test (e.g., ["discrete_combined", "hlcc_linear"]).
            vendors: Vendor keys to include (default: all with API keys).
            models_filter: Specific model names to test (default: all for selected vendors).
            temperatures: Temperature values to test (default: config TEMPERATURES).
            repetitions: Number of repetitions per combination (default: config NUM_REPETITIONS).
            progress_callback: Optional callback(completed, total) for progress reporting.

        Returns:
            List of TestResult objects.
        """
        from benchmark.config import API_KEYS

        questions = self.load_questions(dataset_path)
        if not questions:
            print(f"No questions found in {dataset_path}")
            return []

        if self._models is None:
            self.load_models()

        temps = temperatures or TEMPERATURES
        reps = repetitions or NUM_REPETITIONS

        # Determine available vendors
        available_vendors = {}
        for vendor_name, vendor_data in self._models.items():
            vendor_key = vendor_data.get("vendor", vendor_name.lower())
            if vendors and vendor_key not in vendors:
                continue
            if not API_KEYS.get(vendor_key):
                continue
            model_list = vendor_data["models"]
            if models_filter:
                model_list = [m for m in model_list if m in models_filter]
            if model_list:
                available_vendors[vendor_key] = model_list

        if not available_vendors:
            print("No vendors available (check API keys and vendor filter)")
            return []

        # Build task list
        tasks = []
        for question in questions:
            for variant in variants:
                for vendor_key, model_list in available_vendors.items():
                    for model_name in model_list:
                        for temp in temps:
                            for rep in range(1, reps + 1):
                                tasks.append((question, vendor_key, model_name, variant, temp, rep))

        total = len(tasks)
        print(f"Benchmark: {len(questions)} questions x {len(variants)} variants x "
              f"{len(available_vendors)} vendors x {len(temps)} temps x {reps} reps = {total} tasks")

        # Execute all tasks with rate limiting
        completed = 0
        results = []

        async with aiohttp.ClientSession() as session:
            # Process in batches to avoid overwhelming memory
            batch_size = 100
            for i in range(0, len(tasks), batch_size):
                batch = tasks[i:i + batch_size]
                coros = [
                    self._run_single(session, q, vendor, model, variant, temp, rep)
                    for q, vendor, model, variant, temp, rep in batch
                ]
                batch_results = await asyncio.gather(*coros, return_exceptions=True)

                for r in batch_results:
                    if isinstance(r, TestResult):
                        results.append(r)
                    elif isinstance(r, Exception):
                        print(f"Task error: {r}")

                completed += len(batch)
                if progress_callback:
                    progress_callback(completed, total)
                else:
                    print(f"  Progress: {completed}/{total} ({completed*100//total}%)")

        self.results = results
        print(f"Completed: {len(results)} successful out of {total} tasks")
        return results

    def save_results(self, output_path: Path):
        """Save raw results to JSON."""
        output_path.parent.mkdir(parents=True, exist_ok=True)
        data = [asdict(r) for r in self.results]
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        print(f"Results saved to {output_path}")
