"""
LLM Provider Abstraction Layer

Provides a unified interface for different LLM backends used in novelty detection.
Supports Anthropic, OpenAI, Google Gemini, Ollama (local), and a keyword-based fallback.

Adapted from readingnovelty project and integrated with CBM cost_config and OllamaClient.
"""

import os
import logging
from typing import Optional, Dict

from ollama_client import OllamaClient
from cost_config import PROVIDERS

logger = logging.getLogger(__name__)


SYSTEM_PROMPT = """You are an expert at analyzing text and creating prompts.
Given a piece of text and its surrounding context, generate a concise prompt that could
be used to regenerate that specific text. Focus on the key concepts, themes, and
information conveyed."""


def _build_user_message(chunk: str, context_before: str, context_after: str) -> str:
    """Build the standard user message for prompt generation."""
    return f"""Context before:
{context_before[-200:] if context_before else '[Beginning of document]'}

Target text:
{chunk}

Context after:
{context_after[:200] if context_after else '[End of document]'}

Generate a concise prompt (2-3 sentences) that captures the essence of the target text
and could be used to regenerate it. Respond with ONLY the prompt."""


class LLMProvider:
    """Base class for LLM providers."""

    name: str = "base"

    def generate_prompt(self, chunk: str, context_before: str = "",
                        context_after: str = "") -> str:
        raise NotImplementedError

    def is_available(self) -> bool:
        """Check if this provider is ready to use."""
        return True


class AnthropicProvider(LLMProvider):
    """Anthropic Claude provider."""

    name = "anthropic"

    def __init__(self, api_key: str, model: str = None):
        from anthropic import Anthropic
        default = PROVIDERS["anthropic"]["default_model"]
        self.client = Anthropic(api_key=api_key)
        self.model = model or default

    def generate_prompt(self, chunk: str, context_before: str = "",
                        context_after: str = "") -> str:
        message = self.client.messages.create(
            model=self.model,
            max_tokens=200,
            system=SYSTEM_PROMPT,
            messages=[
                {"role": "user", "content": _build_user_message(chunk, context_before, context_after)}
            ]
        )
        return message.content[0].text.strip()


class OpenAIProvider(LLMProvider):
    """OpenAI ChatGPT provider."""

    name = "openai"

    def __init__(self, api_key: str, model: str = None):
        from openai import OpenAI
        default = PROVIDERS["openai"]["default_model"]
        self.client = OpenAI(api_key=api_key)
        self.model = model or default

    def generate_prompt(self, chunk: str, context_before: str = "",
                        context_after: str = "") -> str:
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": _build_user_message(chunk, context_before, context_after)}
            ],
            max_tokens=200,
            temperature=0.7
        )
        return response.choices[0].message.content.strip()


class GoogleProvider(LLMProvider):
    """Google Gemini provider."""

    name = "google"

    def __init__(self, api_key: str, model: str = None):
        import google.generativeai as genai
        default = PROVIDERS["google"]["default_model"]
        genai.configure(api_key=api_key)
        self.genai = genai
        self.model = model or default

    def generate_prompt(self, chunk: str, context_before: str = "",
                        context_after: str = "") -> str:
        model = self.genai.GenerativeModel(self.model)
        prompt = SYSTEM_PROMPT + "\n\n" + _build_user_message(chunk, context_before, context_after)
        response = model.generate_content(prompt)
        return response.text.strip()


class OllamaProvider(LLMProvider):
    """Ollama provider using the existing OllamaClient."""

    name = "ollama"

    def __init__(self, client: OllamaClient = None, model: str = None):
        default = PROVIDERS["ollama"]["default_model"]
        self.client = client or OllamaClient()
        self.model = model or default

    def is_available(self) -> bool:
        return self.client.health().get("available", False)

    def generate_prompt(self, chunk: str, context_before: str = "",
                        context_after: str = "") -> str:
        prompt = SYSTEM_PROMPT + "\n\n" + _build_user_message(chunk, context_before, context_after)
        return self.client.generate(prompt, model=self.model)


class FallbackProvider(LLMProvider):
    """Fallback provider that extracts key words without an LLM.
    Always available, requires no API key or network."""

    name = "fallback"

    def generate_prompt(self, chunk: str, context_before: str = "",
                        context_after: str = "") -> str:
        words = chunk.split()[:50]
        return f"Write about: {' '.join(words)}"


def discover_providers(api_keys: Optional[Dict[str, str]] = None) -> Dict[str, LLMProvider]:
    """
    Discover all available LLM providers from environment and optional per-request keys.

    Args:
        api_keys: Optional dict of provider -> API key overrides (e.g. from request headers).

    Returns:
        Dict mapping provider name to LLMProvider instance.
    """
    api_keys = api_keys or {}
    providers = {}

    def _get_key(provider_id: str) -> Optional[str]:
        """Get key from overrides first, then environment."""
        if provider_id in api_keys and api_keys[provider_id]:
            return api_keys[provider_id]
        env_var = PROVIDERS.get(provider_id, {}).get("key_env", "")
        val = os.getenv(env_var, "")
        return val if val else None

    # Ollama (always try — it's free/local)
    try:
        providers["ollama"] = OllamaProvider()
        logger.info("Registered Ollama provider")
    except Exception as e:
        logger.warning(f"Failed to initialize Ollama provider: {e}")

    # Google Gemini
    key = _get_key("google")
    if key:
        try:
            providers["google"] = GoogleProvider(api_key=key)
            logger.info("Registered Google provider")
        except Exception as e:
            logger.warning(f"Failed to initialize Google provider: {e}")

    # OpenAI
    key = _get_key("openai")
    if key:
        try:
            providers["openai"] = OpenAIProvider(api_key=key)
            logger.info("Registered OpenAI provider")
        except Exception as e:
            logger.warning(f"Failed to initialize OpenAI provider: {e}")

    # Anthropic
    key = _get_key("anthropic")
    if key:
        try:
            providers["anthropic"] = AnthropicProvider(api_key=key)
            logger.info("Registered Anthropic provider")
        except Exception as e:
            logger.warning(f"Failed to initialize Anthropic provider: {e}")

    # Fallback is always available
    providers["fallback"] = FallbackProvider()

    return providers
