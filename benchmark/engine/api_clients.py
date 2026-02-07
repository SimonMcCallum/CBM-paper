"""Async API clients for all supported LLM vendors.

Supports: OpenAI, Claude, Gemini, DeepSeek, xAI (Grok).
All clients use a common interface for single-turn and multi-turn calls.
"""
import aiohttp
import asyncio
from typing import List, Dict, Optional
from benchmark.config import API_KEYS, ENDPOINTS


async def call_openai(
    session: aiohttp.ClientSession,
    messages: List[Dict[str, str]],
    model: str,
    temperature: float,
) -> Optional[str]:
    """Call OpenAI API and return the response content."""
    api_key = API_KEYS.get("openai")
    if not api_key:
        return None

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": 500,
    }

    try:
        async with session.post(ENDPOINTS["openai"], headers=headers, json=payload) as resp:
            resp.raise_for_status()
            data = await resp.json()
            return data["choices"][0]["message"]["content"].strip()
    except Exception as e:
        print(f"OpenAI API error ({model}): {e}")
        return None


async def call_claude(
    session: aiohttp.ClientSession,
    messages: List[Dict[str, str]],
    model: str,
    temperature: float,
) -> Optional[str]:
    """Call Claude API and return the response content."""
    api_key = API_KEYS.get("claude")
    if not api_key:
        return None

    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "max_tokens": 500,
        "temperature": temperature,
        "messages": messages,
    }

    try:
        async with session.post(ENDPOINTS["claude"], headers=headers, json=payload) as resp:
            resp.raise_for_status()
            data = await resp.json()
            return data["content"][0]["text"].strip()
    except Exception as e:
        print(f"Claude API error ({model}): {e}")
        return None


async def call_gemini(
    session: aiohttp.ClientSession,
    messages: List[Dict[str, str]],
    model: str,
    temperature: float,
) -> Optional[str]:
    """Call Gemini API and return the response content."""
    api_key = API_KEYS.get("gemini")
    if not api_key:
        return None

    # Gemini uses generateContent endpoint with different format
    url = f"{ENDPOINTS['gemini']}/models/{model}:generateContent?key={api_key}"

    # Convert messages to Gemini format
    contents = []
    for msg in messages:
        role = "user" if msg["role"] == "user" else "model"
        contents.append({"role": role, "parts": [{"text": msg["content"]}]})

    payload = {
        "contents": contents,
        "generationConfig": {
            "temperature": temperature,
            "maxOutputTokens": 500,
        },
    }

    try:
        async with session.post(url, json=payload) as resp:
            resp.raise_for_status()
            data = await resp.json()
            return data["candidates"][0]["content"]["parts"][0]["text"].strip()
    except Exception as e:
        print(f"Gemini API error ({model}): {e}")
        return None


async def call_deepseek(
    session: aiohttp.ClientSession,
    messages: List[Dict[str, str]],
    model: str,
    temperature: float,
) -> Optional[str]:
    """Call DeepSeek API (OpenAI-compatible) and return the response content."""
    api_key = API_KEYS.get("deepseek")
    if not api_key:
        return None

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": 500,
    }

    try:
        async with session.post(ENDPOINTS["deepseek"], headers=headers, json=payload) as resp:
            resp.raise_for_status()
            data = await resp.json()
            return data["choices"][0]["message"]["content"].strip()
    except Exception as e:
        print(f"DeepSeek API error ({model}): {e}")
        return None


async def call_xai(
    session: aiohttp.ClientSession,
    messages: List[Dict[str, str]],
    model: str,
    temperature: float,
) -> Optional[str]:
    """Call xAI (Grok) API (OpenAI-compatible) and return the response content."""
    api_key = API_KEYS.get("xai")
    if not api_key:
        return None

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": 500,
    }

    try:
        async with session.post(ENDPOINTS["xai"], headers=headers, json=payload) as resp:
            resp.raise_for_status()
            data = await resp.json()
            return data["choices"][0]["message"]["content"].strip()
    except Exception as e:
        print(f"xAI API error ({model}): {e}")
        return None


# Vendor routing table
VENDOR_CLIENTS = {
    "openai": call_openai,
    "claude": call_claude,
    "gemini": call_gemini,
    "deepseek": call_deepseek,
    "xai": call_xai,
}


async def call_model(
    session: aiohttp.ClientSession,
    vendor: str,
    messages: List[Dict[str, str]],
    model: str,
    temperature: float,
) -> Optional[str]:
    """Route a call to the appropriate vendor API.

    Args:
        session: aiohttp session.
        vendor: Vendor key (e.g., "openai", "claude").
        messages: Conversation messages in OpenAI format [{"role": ..., "content": ...}].
        model: Model identifier.
        temperature: Sampling temperature.

    Returns:
        Response content string, or None on failure.
    """
    client_fn = VENDOR_CLIENTS.get(vendor)
    if not client_fn:
        print(f"Unknown vendor: {vendor}")
        return None
    return await client_fn(session, messages, model, temperature)
