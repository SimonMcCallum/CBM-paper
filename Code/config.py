# config.py
import os

# File paths
QUESTION_FILE = "mqc_eval_format.json"
MODEL_FILE = "models.json"
INTERACTION_LOG = "logs/interaction_log.json"
ANSWERS_FILE = "results/answers.json"

# Temperature settings to cycle through
TEMPERATURES = [0.0, 0.7, 1.0]

# How many times to ask each model at each temperature for each question
NUM_REPETITIONS = 10

# Example API Keys and Endpoints (replace with valid values for your environment)
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY_CBM")
CLAUDE_API_KEY = os.environ.get("ANTHROPIC_API_KEY_CBM")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY_CBM")
DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY_CBM")

OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions"
CLAUDE_ENDPOINT = "https://api.anthropic.com/v1/complete"
GEMINI_ENDPOINT = "https://api.gemini.com/v1/chat/completions"
DEEPSEEK_ENDPOINT = "https://api.deepseek.com/v1/chat/completions"
# Ensure the output directory exists
