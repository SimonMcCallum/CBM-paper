"""
Novelty detection module using LLM-based prompt generation and FAISS similarity search.
"""

import os
import numpy as np
from typing import List, Dict, Tuple, Optional
from sentence_transformers import SentenceTransformer
import faiss
from anthropic import Anthropic
import openai
from tqdm import tqdm


class NoveltyDetector:
    """Detects novelty in text chunks using LLM-generated prompts and FAISS embeddings."""

    def __init__(self, embedding_model: str = "all-MiniLM-L6-v2",
                 llm_provider: str = "anthropic"):
        """
        Initialize novelty detector.

        Args:
            embedding_model: Name of sentence transformer model
            llm_provider: LLM provider to use ('anthropic', 'openai', or 'google')
        """
        self.embedding_model = SentenceTransformer(embedding_model)
        self.llm_provider = llm_provider
        self.embeddings = None
        self.index = None
        self.chunk_prompts = []

        # Initialize LLM client
        if llm_provider == "anthropic":
            api_key = os.getenv("ANTHROPIC_API_KEY")
            if not api_key:
                raise ValueError("ANTHROPIC_API_KEY not found in environment")
            self.llm_client = Anthropic(api_key=api_key)
        elif llm_provider == "openai":
            api_key = os.getenv("OPENAI_API_KEY")
            if not api_key:
                raise ValueError("OPENAI_API_KEY not found in environment")
            openai.api_key = api_key
            self.llm_client = openai
        elif llm_provider == "google":
            import google.generativeai as genai
            api_key = os.getenv("GOOGLE_API_KEY")
            if not api_key:
                raise ValueError("GOOGLE_API_KEY not found in environment")
            genai.configure(api_key=api_key)
            self.llm_client = genai
        else:
            raise ValueError(f"Unsupported LLM provider: {llm_provider}")

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
        # Construct the analysis prompt for the LLM
        analysis_prompt = f"""Analyze the following text passage and create a concise prompt that captures its core meaning and could be used to regenerate similar content.

Context before: {before_context if before_context else "[Beginning of document]"}

TARGET TEXT: {chunk_text}

Context after: {after_context if after_context else "[End of document]"}

Generate a prompt (2-3 sentences max) that captures the essential meaning, topic, and key points of the TARGET TEXT. This prompt should be specific enough that someone could use it to write similar content.

Respond with ONLY the prompt, no additional explanation."""

        try:
            if self.llm_provider == "anthropic":
                response = self.llm_client.messages.create(
                    model="claude-3-5-sonnet-20241022",
                    max_tokens=200,
                    messages=[{"role": "user", "content": analysis_prompt}]
                )
                return response.content[0].text.strip()

            elif self.llm_provider == "openai":
                response = self.llm_client.chat.completions.create(
                    model="gpt-4o-mini",
                    max_tokens=200,
                    messages=[{"role": "user", "content": analysis_prompt}]
                )
                return response.choices[0].message.content.strip()

            elif self.llm_provider == "google":
                model = self.llm_client.GenerativeModel('gemini-1.5-flash')
                response = model.generate_content(analysis_prompt)
                return response.text.strip()

        except Exception as e:
            print(f"Error generating prompt: {e}")
            # Fallback: use the chunk text itself
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
        self.embeddings = self.embedding_model.encode(prompts, show_progress_bar=True)

        # Normalize embeddings for cosine similarity
        self.embeddings = self.embeddings / np.linalg.norm(
            self.embeddings, axis=1, keepdims=True
        )

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
            # Higher similarity to others = lower novelty
            avg_similarity = np.mean(similar_distances)
            novelty_score = 1.0 - avg_similarity  # Convert to novelty

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
        # Generate prompts for all chunks
        prompts = self.analyze_chunks(chunks, pdf_processor)

        # Build FAISS index
        self.build_faiss_index(prompts)

        # Calculate novelty scores
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
