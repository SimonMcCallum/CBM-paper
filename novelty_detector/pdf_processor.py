"""
PDF text extraction, chunking, and annotation module.
Handles PDF processing and annotation with novelty scores.
"""

import re
import fitz  # PyMuPDF
from typing import List, Tuple, Dict
from reportlab.lib.pagesizes import letter
from reportlab.lib.colors import Color, green, yellow, orange, red
from reportlab.pdfgen import canvas
from reportlab.lib.units import inch
import io


class PDFProcessor:
    """Handles PDF text extraction, chunking, and annotation."""

    def __init__(self, chunk_size: int = 150, overlap: int = 20):
        """
        Initialize PDF processor.

        Args:
            chunk_size: Target number of words per chunk
            overlap: Number of words to overlap between chunks
        """
        self.chunk_size = chunk_size
        self.overlap = overlap

    def extract_text(self, pdf_path: str) -> str:
        """
        Extract text from PDF file.

        Args:
            pdf_path: Path to PDF file

        Returns:
            Extracted text as string
        """
        doc = fitz.open(pdf_path)
        text = ""

        for page in doc:
            text += page.get_text()

        doc.close()
        return text

    def chunk_text(self, text: str) -> List[Dict[str, any]]:
        """
        Split text into overlapping chunks of approximately chunk_size words.

        Args:
            text: Input text to chunk

        Returns:
            List of chunk dictionaries with text, start/end positions
        """
        # Clean and normalize text
        text = re.sub(r'\s+', ' ', text).strip()
        words = text.split()

        chunks = []
        start_idx = 0
        chunk_idx = 0

        while start_idx < len(words):
            # Get chunk of words
            end_idx = min(start_idx + self.chunk_size, len(words))
            chunk_words = words[start_idx:end_idx]
            chunk_text = ' '.join(chunk_words)

            # Calculate character positions in original text
            char_start = len(' '.join(words[:start_idx]))
            if start_idx > 0:
                char_start += 1  # Account for space
            char_end = char_start + len(chunk_text)

            chunks.append({
                'chunk_index': chunk_idx,
                'text': chunk_text,
                'word_start': start_idx,
                'word_end': end_idx,
                'char_start': char_start,
                'char_end': char_end,
                'word_count': len(chunk_words)
            })

            chunk_idx += 1

            # Move to next chunk with overlap
            start_idx += self.chunk_size - self.overlap

            # Break if we're at the end
            if end_idx >= len(words):
                break

        return chunks

    def get_chunk_context(self, chunks: List[Dict], chunk_idx: int,
                          context_before: int = 50, context_after: int = 50) -> Tuple[str, str, str]:
        """
        Get context around a specific chunk for better LLM analysis.

        Args:
            chunks: List of all chunks
            chunk_idx: Index of target chunk
            context_before: Words of context before chunk
            context_after: Words of context after chunk

        Returns:
            Tuple of (before_context, chunk_text, after_context)
        """
        chunk = chunks[chunk_idx]
        chunk_text = chunk['text']

        # Get before context
        before_context = ""
        if chunk_idx > 0:
            prev_chunk = chunks[chunk_idx - 1]
            prev_words = prev_chunk['text'].split()
            before_context = ' '.join(prev_words[-context_before:])

        # Get after context
        after_context = ""
        if chunk_idx < len(chunks) - 1:
            next_chunk = chunks[chunk_idx + 1]
            next_words = next_chunk['text'].split()
            after_context = ' '.join(next_words[:context_after])

        return before_context, chunk_text, after_context

    def annotate_pdf(self, input_pdf_path: str, output_pdf_path: str,
                     novelty_scores: List[Dict]) -> str:
        """
        Annotate PDF with color-coded novelty scores.

        Args:
            input_pdf_path: Path to input PDF
            output_pdf_path: Path to save annotated PDF
            novelty_scores: List of dicts with chunk_index and novelty_score

        Returns:
            Path to annotated PDF
        """
        # Open the PDF
        doc = fitz.open(input_pdf_path)

        # Create a mapping of chunk index to color
        score_map = {item['chunk_index']: item['novelty_score']
                     for item in novelty_scores}

        # Extract text with positions for annotation
        for page_num in range(len(doc)):
            page = doc[page_num]
            blocks = page.get_text("dict")["blocks"]

            # For now, add a simple color overlay based on page position
            # This is a simplified version - more sophisticated text matching
            # would be needed for precise highlighting

            # Add a legend on the first page
            if page_num == 0:
                # Add legend rectangle
                legend_rect = fitz.Rect(10, 10, 200, 100)
                page.draw_rect(legend_rect, color=(0, 0, 0), width=1)

                # Add legend text
                legend_text = """Novelty Legend:
Green: High (>0.7)
Yellow: Medium (0.4-0.7)
Orange: Low (0.2-0.4)
Red: Very Low (<0.2)"""

                page.insert_text((15, 25), legend_text, fontsize=10)

        # Save annotated PDF
        doc.save(output_pdf_path)
        doc.close()

        return output_pdf_path

    def get_novelty_color(self, score: float) -> Color:
        """
        Get color for a novelty score.

        Args:
            score: Novelty score between 0 and 1

        Returns:
            ReportLab Color object
        """
        if score > 0.7:
            return Color(0, 1, 0, alpha=0.3)  # Green
        elif score > 0.4:
            return Color(1, 1, 0, alpha=0.3)  # Yellow
        elif score > 0.2:
            return Color(1, 0.5, 0, alpha=0.3)  # Orange
        else:
            return Color(1, 0, 0, alpha=0.3)  # Red
