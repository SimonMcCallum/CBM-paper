"""Centralized configuration for the CBM benchmark system."""
import os
from pathlib import Path

# Base directories
BENCHMARK_DIR = Path(__file__).parent
PROJECT_ROOT = BENCHMARK_DIR.parent

# Dataset paths
DATASETS_DIR = BENCHMARK_DIR / "datasets"
CACHE_DIR = DATASETS_DIR / "cache"
UNIFIED_DIR = DATASETS_DIR / "unified"
AMBIGUOUS_FILE = DATASETS_DIR / "ambiguous_questions.json"

# Results paths
RESULTS_DIR = BENCHMARK_DIR / "results"
RAW_RESULTS_DIR = RESULTS_DIR / "raw"
PUBLISHED_DIR = RESULTS_DIR / "published"

# LaTeX output (follows existing pattern from Code/score_analysis.py)
LATEX_FIGURES_DIR = PROJECT_ROOT / "Documentation" / "generated" / "figures"

# Model registry
MODEL_FILE = BENCHMARK_DIR / "models.json"

# Temperature settings
TEMPERATURES = [0.0, 0.7, 1.0]

# Default repetitions per (model, temperature, question, variant) combination
NUM_REPETITIONS = 3

# Default sample size per subject (for MMLU). None = full dataset.
DEFAULT_SAMPLE_SIZE = 100

# API Keys from environment
API_KEYS = {
    "openai": os.environ.get("OPENAI_API_KEY_CBM"),
    "claude": os.environ.get("ANTHROPIC_API_KEY_CBM"),
    "gemini": os.environ.get("GEMINI_API_KEY_CBM"),
    "deepseek": os.environ.get("DEEPSEEK_API_KEY_CBM"),
    "xai": os.environ.get("XAI_API_KEY_CBM"),
}

# API Endpoints
ENDPOINTS = {
    "openai": "https://api.openai.com/v1/chat/completions",
    "claude": "https://api.anthropic.com/v1/messages",
    "gemini": "https://generativelanguage.googleapis.com/v1beta",
    "deepseek": "https://api.deepseek.com/v1/chat/completions",
    "xai": "https://api.x.ai/v1/chat/completions",
}

# Rate limiting (max concurrent requests per vendor)
RATE_LIMITS = {
    "openai": 50,
    "claude": 20,
    "gemini": 30,
    "deepseek": 20,
    "xai": 10,
}

# Supported datasets
AVAILABLE_DATASETS = ["mmlu", "truthfulqa", "arc", "ambiguous"]

# Confidence variants
VARIANTS = [
    "discrete_combined",
    "discrete_linear",
    "hlcc_combined",
    "hlcc_linear",
]


def ensure_dirs():
    """Create all required output directories."""
    for d in [CACHE_DIR, UNIFIED_DIR, RAW_RESULTS_DIR, PUBLISHED_DIR, LATEX_FIGURES_DIR]:
        d.mkdir(parents=True, exist_ok=True)
