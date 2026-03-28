"""
Novelty detection module using LLM-based prompt generation and FAISS similarity search.
Supports Ollama (local), Anthropic, OpenAI, and Google providers with per-request API keys.
"""

import os
import numpy as np
from typing import List, Dict, Optional
from sentence_transformers import SentenceTransformer
import faiss
from tqdm import tqdm

from ollama_client import OllamaClient
from cost_config import PROVIDERS


class NoveltyDetector:
    """Detects novelty in text chunks using LLM-generated prompts and FAISS embeddings."""

    def __init__(self, embedding_model: str = None,
                 llm_provider: str = "ollama",
                 llm_model: str = None,
                 embedding_provider: str = None,
                 embedding_model_name: str = None,
                 api_keys: Optional[Dict[str, str]] = None):
        """
        Initialize novelty detector.

        Args:
            embedding_model: Name of sentence transformer model (for local provider)
            llm_provider: LLM provider ('ollama', 'anthropic', 'openai', 'google')
            llm_model: Specific model override (uses provider default if None)
            embedding_provider: Embedding provider ('local', 'ollama', 'openai')
            embedding_model_name: Override embedding model name
            api_keys: Dict of provider API keys (e.g. {'anthropic': 'sk-...'})
        """
        self.llm_provider = llm_provider
        self.api_keys = api_keys or {}
        self.embeddings = None
        self.index = None
        self.chunk_prompts = []
        self.embedding_provider = embedding_provider or os.getenv("EMBEDDING_PROVIDER", "local")
        embedding_model = embedding_model or os.getenv("EMBEDDING_MODEL", "BAAI/bge-large-en-v1.5")

        # Resolve LLM model
        provider_config = PROVIDERS.get(llm_provider, PROVIDERS["ollama"])
        self.llm_model = llm_model or provider_config["default_model"]

        # Initialize embedding model
        if embedding_provider == "local":
            model_name = embedding_model_name or embedding_model
            self.embedding_model = SentenceTransformer(model_name)
        elif embedding_provider == "ollama":
            self.ollama_embed_model = embedding_model_name or os.getenv(
                "OLLAMA_EMBED_MODEL", "nomic-embed-text")
            self.ollama_client_embed = OllamaClient()
        elif embedding_provider == "openai":
            import openai as openai_mod
            key = self._get_api_key("openai")
            self.openai_embed_client = openai_mod.OpenAI(api_key=key)
            self.openai_embed_model = embedding_model_name or "text-embedding-3-small"

        # Initialize LLM client
        self._init_llm_client()

    def _get_api_key(self, provider: str) -> str:
        """Get API key from per-request keys or environment."""
        if provider in self.api_keys and self.api_keys[provider]:
            return self.api_keys[provider]
        env_map = {
            "anthropic": "ANTHROPIC_API_KEY",
            "openai": "OPENAI_API_KEY",
            "google": "GOOGLE_API_KEY",
        }
        key = os.getenv(env_map.get(provider, ""), "")
        if not key:
            raise ValueError(
                f"No API key available for {provider}. "
                f"Provide via request header or set {env_map.get(provider)} env var."
            )
        return key

    def _init_llm_client(self):
        """Initialize the LLM client based on provider."""
        if self.llm_provider == "ollama":
            self.llm_client = OllamaClient()
        elif self.llm_provider == "anthropic":
            from anthropic import Anthropic
            self.llm_client = Anthropic(api_key=self._get_api_key("anthropic"))
        elif self.llm_provider == "openai":
            import openai as openai_mod
            self.llm_client = openai_mod.OpenAI(api_key=self._get_api_key("openai"))
        elif self.llm_provider == "google":
            import google.generativeai as genai
            genai.configure(api_key=self._get_api_key("google"))
            self.llm_client = genai
        else:
            raise ValueError(f"Unsupported LLM provider: {self.llm_provider}")

    def _encode_texts(self, texts: List[str]) -> np.ndarray:
        """Encode texts to embeddings using the configured provider."""
        if self.embedding_provider == "local":
            return self.embedding_model.encode(texts, show_progress_bar=True)
        elif self.embedding_provider == "ollama":
            embeddings = []
            for text in tqdm(texts, desc="Ollama embeddings"):
                vec = self.ollama_client_embed.embeddings(text, model=self.ollama_embed_model)
                embeddings.append(vec)
            return np.array(embeddings, dtype="float32")
        elif self.embedding_provider == "openai":
            # Batch in groups of 100
            all_embeddings = []
            for i in range(0, len(texts), 100):
                batch = texts[i:i+100]
                resp = self.openai_embed_client.embeddings.create(
                    input=batch, model=self.openai_embed_model
                )
                for item in resp.data:
                    all_embeddings.append(item.embedding)
            return np.array(all_embeddings, dtype="float32")
        else:
            raise ValueError(f"Unsupported embedding provider: {self.embedding_provider}")

    def generate_prompt_for_chunk(self, chunk_text: str, before_context: str = "",
                                  after_context: str = "") -> str:
        """
        Use LLM to generate a prompt that captures the essence of the text chunk.

        Args:
            chunk_text: The main text chunk
            before_context: Context before the chunk
            after_context: Context after the chunk

        Returns:
            Generated prompt that could regenerate this text
        """
        analysis_prompt = f"""Analyze the following text passage and create a concise prompt that captures its core meaning and could be used to regenerate similar content.

Context before: {before_context if before_context else "[Beginning of document]"}

TARGET TEXT: {chunk_text}

Context after: {after_context if after_context else "[End of document]"}

Generate a prompt (2-3 sentences max) that captures the essential meaning, topic, and key points of the TARGET TEXT. This prompt should be specific enough that someone could use it to write similar content.

Respond with ONLY the prompt, no additional explanation."""

        try:
            if self.llm_provider == "ollama":
                return self.llm_client.generate(analysis_prompt, model=self.llm_model)

            elif self.llm_provider == "anthropic":
                response = self.llm_client.messages.create(
                    model=self.llm_model,
                    max_tokens=200,
                    messages=[{"role": "user", "content": analysis_prompt}]
                )
                return response.content[0].text.strip()

            elif self.llm_provider == "openai":
                response = self.llm_client.chat.completions.create(
                    model=self.llm_model,
                    max_tokens=200,
                    messages=[{"role": "user", "content": analysis_prompt}]
                )
                return response.choices[0].message.content.strip()

            elif self.llm_provider == "google":
                model = self.llm_client.GenerativeModel(self.llm_model)
                response = model.generate_content(analysis_prompt)
                return response.text.strip()

        except Exception as e:
            print(f"Error generating prompt: {e}")
            return chunk_text

    def analyze_chunks(self, chunks: List[Dict], pdf_processor) -> List[str]:
        """
        Generate prompts for all chunks using LLM.

        Args:
            chunks: List of chunk dictionaries
            pdf_processor: PDFProcessor instance to get context

        Returns:
            List of generated prompts
        """
        prompts = []

        print("Generating prompts for chunks...")
        for i, chunk in enumerate(tqdm(chunks)):
            before_context, chunk_text, after_context = pdf_processor.get_chunk_context(
                chunks, i
            )

            prompt = self.generate_prompt_for_chunk(
                chunk_text, before_context, after_context
            )
            prompts.append(prompt)

        self.chunk_prompts = prompts
        return prompts

    def build_faiss_index(self, prompts: List[str]) -> None:
        """
        Build FAISS index from prompt embeddings.

        Args:
            prompts: List of generated prompts
        """
        print("Generating embeddings...")
        self.embeddings = self._encode_texts(prompts)

        # Normalize embeddings for cosine similarity
        norms = np.linalg.norm(self.embeddings, axis=1, keepdims=True)
        norms[norms == 0] = 1  # avoid division by zero
        self.embeddings = self.embeddings / norms

        # Build FAISS index
        dimension = self.embeddings.shape[1]
        self.index = faiss.IndexFlatIP(dimension)  # Inner product for cosine similarity
        self.index.add(self.embeddings.astype('float32'))

        print(f"FAISS index built with {self.index.ntotal} vectors")

    def calculate_novelty_scores(self, k: int = 5) -> List[Dict]:
        """
        Calculate novelty scores for each chunk based on similarity to others.

        Args:
            k: Number of nearest neighbors to consider

        Returns:
            List of dicts with chunk_index, novelty_score, and similar_chunks
        """
        if self.index is None or self.embeddings is None:
            raise ValueError("FAISS index not built. Call build_faiss_index first.")

        novelty_scores = []

        print("Calculating novelty scores...")
        for i in tqdm(range(len(self.embeddings))):
            query_vector = self.embeddings[i:i+1].astype('float32')

            # Search for k+1 nearest neighbors (including itself)
            distances, indices = self.index.search(query_vector, k + 1)

            # Remove self from results
            mask = indices[0] != i
            similar_indices = indices[0][mask][:k]
            similar_distances = distances[0][mask][:k]

            # Calculate novelty score
            avg_similarity = np.mean(similar_distances)
            novelty_score = 1.0 - avg_similarity

            novelty_scores.append({
                'chunk_index': i,
                'novelty_score': float(novelty_score),
                'avg_similarity': float(avg_similarity),
                'similar_chunks': [
                    {
                        'index': int(idx),
                        'similarity': float(sim)
                    }
                    for idx, sim in zip(similar_indices, similar_distances)
                ],
                'text_preview': self.chunk_prompts[i][:100] + "..."
                if len(self.chunk_prompts[i]) > 100 else self.chunk_prompts[i]
            })

        return novelty_scores

    def analyze_document(self, chunks: List[Dict], pdf_processor,
                        k: int = 5) -> List[Dict]:
        """
        Complete novelty analysis pipeline for a document.

        Args:
            chunks: List of text chunks
            pdf_processor: PDFProcessor instance
            k: Number of neighbors for novelty calculation

        Returns:
            List of novelty scores for each chunk
        """
        prompts = self.analyze_chunks(chunks, pdf_processor)
        self.build_faiss_index(prompts)
        novelty_scores = self.calculate_novelty_scores(k)
        return novelty_scores

    def get_summary_statistics(self, novelty_scores: List[Dict]) -> Dict:
        """
        Get summary statistics for novelty scores.

        Args:
            novelty_scores: List of novelty score dicts

        Returns:
            Dictionary with summary statistics
        """
        scores = [item['novelty_score'] for item in novelty_scores]

        return {
            'total_chunks': len(scores),
            'mean_novelty': float(np.mean(scores)),
            'median_novelty': float(np.median(scores)),
            'std_novelty': float(np.std(scores)),
            'min_novelty': float(np.min(scores)),
            'max_novelty': float(np.max(scores)),
            'high_novelty_count': sum(1 for s in scores if s > 0.7),
            'medium_novelty_count': sum(1 for s in scores if 0.4 <= s <= 0.7),
            'low_novelty_count': sum(1 for s in scores if 0.2 <= s < 0.4),
            'very_low_novelty_count': sum(1 for s in scores if s < 0.2)
        }
