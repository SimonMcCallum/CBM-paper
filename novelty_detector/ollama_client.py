"""
HTTP client for Ollama LLM server.
Handles text generation, embeddings, model listing, and health checks.
"""

import os
import requests
from typing import Optional


OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434")


class OllamaClient:
    """HTTP client for Ollama API."""

    def __init__(self, base_url: str = None):
        self.base_url = (base_url or OLLAMA_BASE_URL).rstrip("/")

    def health(self) -> dict:
        """Check if Ollama is reachable."""
        try:
            resp = requests.get(f"{self.base_url}/api/tags", timeout=5)
            return {"available": resp.status_code == 200}
        except requests.RequestException:
            return {"available": False}

    def list_models(self) -> list:
        """List models pulled in Ollama."""
        try:
            resp = requests.get(f"{self.base_url}/api/tags", timeout=10)
            resp.raise_for_status()
            data = resp.json()
            return [m["name"] for m in data.get("models", [])]
        except requests.RequestException:
            return []

    def generate(self, prompt: str, model: str = None,
                 max_tokens: int = 200) -> str:
        """
        Generate text completion.

        Args:
            prompt: Input prompt
            model: Model name (defaults to env OLLAMA_DEFAULT_MODEL)
            max_tokens: Maximum tokens in response

        Returns:
            Generated text
        """
        model = model or os.getenv("OLLAMA_DEFAULT_MODEL", "llama3.2")
        resp = requests.post(
            f"{self.base_url}/api/generate",
            json={
                "model": model,
                "prompt": prompt,
                "stream": False,
                "options": {"num_predict": max_tokens},
            },
            timeout=120,
        )
        resp.raise_for_status()
        return resp.json().get("response", "").strip()

    def embeddings(self, text: str, model: str = None) -> list:
        """
        Get embeddings for text.

        Args:
            text: Input text
            model: Embedding model name

        Returns:
            List of floats (embedding vector)
        """
        model = model or os.getenv("OLLAMA_EMBED_MODEL", "nomic-embed-text")
        resp = requests.post(
            f"{self.base_url}/api/embed",
            json={"model": model, "input": text},
            timeout=60,
        )
        resp.raise_for_status()
        data = resp.json()
        # Handle both single and batch responses
        embeddings = data.get("embeddings", [])
        if embeddings:
            return embeddings[0]
        return data.get("embedding", [])
