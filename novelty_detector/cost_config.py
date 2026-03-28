"""
Provider metadata, pricing data, and cost estimation for novelty detection.
"""

# Pricing per 1K tokens (USD)
PROVIDERS = {
    "ollama": {
        "name": "Ollama (Local)",
        "tier": "Free",
        "requires_key": False,
        "models": {
            "qwen2.5:7b": {"input": 0.0, "output": 0.0},
            "mistral:7b": {"input": 0.0, "output": 0.0},
            "llama3.2": {"input": 0.0, "output": 0.0},
            "llama3.1": {"input": 0.0, "output": 0.0},
            "gemma2": {"input": 0.0, "output": 0.0},
        },
        "default_model": "qwen2.5:7b",
    },
    "google": {
        "name": "Google Gemini",
        "tier": "Budget",
        "requires_key": True,
        "key_env": "GOOGLE_API_KEY",
        "models": {
            "gemini-2.0-flash": {"input": 0.00010, "output": 0.00040},
            "gemini-1.5-flash": {"input": 0.000075, "output": 0.00030},
        },
        "default_model": "gemini-2.0-flash",
    },
    "openai": {
        "name": "OpenAI",
        "tier": "Mid",
        "requires_key": True,
        "key_env": "OPENAI_API_KEY",
        "models": {
            "gpt-4o-mini": {"input": 0.00015, "output": 0.00060},
            "gpt-4o": {"input": 0.0025, "output": 0.0100},
        },
        "default_model": "gpt-4o-mini",
    },
    "anthropic": {
        "name": "Anthropic Claude",
        "tier": "Premium",
        "requires_key": True,
        "key_env": "ANTHROPIC_API_KEY",
        "models": {
            "claude-sonnet-4-20250514": {"input": 0.003, "output": 0.015},
            "claude-haiku-4-5-20251001": {"input": 0.0008, "output": 0.004},
        },
        "default_model": "claude-sonnet-4-20250514",
    },
}

EMBEDDING_PROVIDERS = {
    "local": {
        "name": "Sentence Transformers (Local)",
        "cost_per_1k_tokens": 0.0,
        "models": ["BAAI/bge-large-en-v1.5", "all-MiniLM-L6-v2", "all-mpnet-base-v2"],
        "default_model": "BAAI/bge-large-en-v1.5",
    },
    "ollama": {
        "name": "Ollama Embeddings (Local)",
        "cost_per_1k_tokens": 0.0,
        "models": ["nomic-embed-text", "mxbai-embed-large"],
        "default_model": "nomic-embed-text",
    },
    "openai": {
        "name": "OpenAI Embeddings",
        "cost_per_1k_tokens": 0.00002,
        "models": ["text-embedding-3-small", "text-embedding-3-large"],
        "default_model": "text-embedding-3-small",
    },
}


def estimate_cost(word_count: int, chunk_size: int = 150, overlap: int = 20,
                  llm_provider: str = "ollama", llm_model: str = None,
                  embedding_provider: str = "local") -> dict:
    """
    Estimate cost for analyzing a document.

    Args:
        word_count: Number of words in the document
        chunk_size: Words per chunk
        overlap: Overlap between chunks
        llm_provider: LLM provider name
        llm_model: Specific model (uses provider default if None)
        embedding_provider: Embedding provider name

    Returns:
        Dict with cost breakdown
    """
    if word_count <= 0:
        return {"total_cost": 0.0, "chunks": 0, "llm_cost": 0.0, "embedding_cost": 0.0}

    # Calculate number of chunks
    step = max(chunk_size - overlap, 1)
    chunks = max(1, (word_count - overlap + step - 1) // step)

    # Get provider pricing
    provider = PROVIDERS.get(llm_provider, PROVIDERS["ollama"])
    model = llm_model or provider["default_model"]
    pricing = provider["models"].get(model, {"input": 0.0, "output": 0.0})

    # Estimate tokens per chunk
    # Input: chunk text + context (~160 words) + prompt template, * 1.3 for tokenization
    input_tokens_per_chunk = (chunk_size + 160) * 1.3
    # Output: ~2-3 sentence response (~60 words)
    output_tokens_per_chunk = 60 * 1.3

    llm_cost = chunks * (
        input_tokens_per_chunk * pricing["input"] / 1000 +
        output_tokens_per_chunk * pricing["output"] / 1000
    )

    # Embedding cost
    embed_provider = EMBEDDING_PROVIDERS.get(embedding_provider, EMBEDDING_PROVIDERS["local"])
    embed_cost = chunks * output_tokens_per_chunk * embed_provider["cost_per_1k_tokens"] / 1000

    total = llm_cost + embed_cost

    return {
        "total_cost": round(total, 6),
        "llm_cost": round(llm_cost, 6),
        "embedding_cost": round(embed_cost, 6),
        "chunks": chunks,
        "word_count": word_count,
        "provider": llm_provider,
        "model": model,
        "embedding_provider": embedding_provider,
        "formatted_cost": f"${total:.4f}" if total > 0 else "Free",
    }


def estimate_cost_all_providers(word_count: int, chunk_size: int = 150,
                                 overlap: int = 20) -> list:
    """Estimate cost for all providers for comparison."""
    results = []
    for provider_id in PROVIDERS:
        est = estimate_cost(word_count, chunk_size, overlap, llm_provider=provider_id)
        est["provider_name"] = PROVIDERS[provider_id]["name"]
        est["tier"] = PROVIDERS[provider_id]["tier"]
        est["requires_key"] = PROVIDERS[provider_id]["requires_key"]
        results.append(est)
    return results
