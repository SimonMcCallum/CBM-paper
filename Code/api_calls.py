# api_calls.py
import requests
import json
from config import (
    OPENAI_API_KEY, OPENAI_ENDPOINT,
    CLAUDE_API_KEY, CLAUDE_ENDPOINT,
    GEMINI_API_KEY, GEMINI_ENDPOINT
)

def get_openai_response(prompt: str, temperature: float):
    """
    Query OpenAI endpoint with given prompt and temperature.
    """
    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "gpt-3.5-turbo",  # or whichever model you plan to use
        "messages": [{"role": "user", "content": prompt}],
        "temperature": temperature
    }
    response = requests.post(OPENAI_ENDPOINT, headers=headers, json=payload)
    response.raise_for_status()
    data = response.json()
    # Extract the content of the first choice
    return data["choices"][0]["message"]["content"]

def get_claude_response(prompt: str, temperature: float):
    """
    Query Claude endpoint with given prompt and temperature.
    Note: The actual API parameters and format may vary for Claude.
    """
    headers = {
        "x-api-key": CLAUDE_API_KEY,
        "Content-Type": "application/json"
    }
    payload = {
        "prompt": prompt,
        "temperature": temperature,
        "max_tokens_to_sample": 512
    }
    response = requests.post(CLAUDE_ENDPOINT, headers=headers, json=payload)
    response.raise_for_status()
    data = response.json()
    # Extract response content (depends on Claude's actual JSON structure)
    return data.get("completion", "")

def get_gemini_response(prompt: str, temperature: float):
    """
    Query Gemini endpoint with given prompt and temperature.
    Placeholder – details of your Gemini API may differ.
    """
    headers = {
        "Authorization": f"Bearer {GEMINI_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "gemini-1",  # or whichever model you plan to use
        "messages": [{"role": "user", "content": prompt}],
        "temperature": temperature
    }
    response = requests.post(GEMINI_ENDPOINT, headers=headers, json=payload)
    response.raise_for_status()
    data = response.json()
    # Extract the content of the first choice
    return data["choices"][0]["message"]["content"]
