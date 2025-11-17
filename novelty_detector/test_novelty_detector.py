"""
Test suite for PDF novelty detection system.
"""

import os
import sys
import unittest
from unittest.mock import Mock, patch, MagicMock
import tempfile
import json

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from pdf_processor import PDFProcessor
from novelty_detector import NoveltyDetector


class TestPDFProcessor(unittest.TestCase):
    """Test cases for PDFProcessor class."""

    def setUp(self):
        """Set up test fixtures."""
        self.processor = PDFProcessor(chunk_size=100, overlap=10)

    def test_chunk_text_simple(self):
        """Test basic text chunking."""
        text = " ".join([f"word{i}" for i in range(250)])  # 250 words
        chunks = self.processor.chunk_text(text)

        # Should create multiple chunks
        self.assertGreater(len(chunks), 1)

        # First chunk should be close to chunk_size
        self.assertLessEqual(chunks[0]['word_count'], 100)

        # Chunks should have proper indices
        for i, chunk in enumerate(chunks):
            self.assertEqual(chunk['chunk_index'], i)

    def test_chunk_text_overlap(self):
        """Test that chunks have proper overlap."""
        text = " ".join([f"word{i}" for i in range(200)])
        chunks = self.processor.chunk_text(text)

        if len(chunks) > 1:
            # Check that there's overlap between consecutive chunks
            chunk0_words = set(chunks[0]['text'].split())
            chunk1_words = set(chunks[1]['text'].split())

            # Should have some overlap
            overlap = chunk0_words.intersection(chunk1_words)
            self.assertGreater(len(overlap), 0)

    def test_chunk_text_empty(self):
        """Test chunking empty text."""
        chunks = self.processor.chunk_text("")
        self.assertEqual(len(chunks), 0)

    def test_chunk_text_short(self):
        """Test chunking text shorter than chunk_size."""
        text = "This is a short text with only a few words"
        chunks = self.processor.chunk_text(text)

        self.assertEqual(len(chunks), 1)
        self.assertEqual(chunks[0]['chunk_index'], 0)

    def test_get_chunk_context(self):
        """Test context extraction around chunks."""
        text = " ".join([f"word{i}" for i in range(300)])
        chunks = self.processor.chunk_text(text)

        # Get context for middle chunk
        if len(chunks) > 2:
            before, chunk, after = self.processor.get_chunk_context(chunks, 1)

            self.assertIsInstance(before, str)
            self.assertIsInstance(chunk, str)
            self.assertIsInstance(after, str)

            # Before context should not be empty for middle chunks
            self.assertGreater(len(before), 0)
            self.assertGreater(len(after), 0)

    def test_get_chunk_context_first(self):
        """Test context for first chunk."""
        text = " ".join([f"word{i}" for i in range(200)])
        chunks = self.processor.chunk_text(text)

        before, chunk, after = self.processor.get_chunk_context(chunks, 0)

        # First chunk should have no before context
        self.assertEqual(before, "")
        self.assertGreater(len(chunk), 0)

    def test_get_chunk_context_last(self):
        """Test context for last chunk."""
        text = " ".join([f"word{i}" for i in range(200)])
        chunks = self.processor.chunk_text(text)

        if len(chunks) > 1:
            before, chunk, after = self.processor.get_chunk_context(
                chunks, len(chunks) - 1
            )

            # Last chunk should have no after context
            self.assertGreater(len(before), 0)
            self.assertEqual(after, "")

    def test_get_novelty_color(self):
        """Test novelty score to color mapping."""
        # High novelty - green
        color_high = self.processor.get_novelty_color(0.8)
        self.assertIsNotNone(color_high)

        # Medium novelty - yellow
        color_medium = self.processor.get_novelty_color(0.5)
        self.assertIsNotNone(color_medium)

        # Low novelty - orange
        color_low = self.processor.get_novelty_color(0.3)
        self.assertIsNotNone(color_low)

        # Very low novelty - red
        color_very_low = self.processor.get_novelty_color(0.1)
        self.assertIsNotNone(color_very_low)


class TestNoveltyDetector(unittest.TestCase):
    """Test cases for NoveltyDetector class."""

    def setUp(self):
        """Set up test fixtures."""
        # Use a mock LLM provider for testing
        os.environ['ANTHROPIC_API_KEY'] = 'test_key'

    @patch('novelty_detector.Anthropic')
    def test_initialization_anthropic(self, mock_anthropic):
        """Test NoveltyDetector initialization with Anthropic."""
        detector = NoveltyDetector(llm_provider='anthropic')
        self.assertEqual(detector.llm_provider, 'anthropic')
        mock_anthropic.assert_called_once()

    @patch('novelty_detector.openai')
    def test_initialization_openai(self, mock_openai):
        """Test NoveltyDetector initialization with OpenAI."""
        os.environ['OPENAI_API_KEY'] = 'test_key'
        detector = NoveltyDetector(llm_provider='openai')
        self.assertEqual(detector.llm_provider, 'openai')

    def test_initialization_invalid_provider(self):
        """Test initialization with invalid provider."""
        with self.assertRaises(ValueError):
            NoveltyDetector(llm_provider='invalid_provider')

    @patch('novelty_detector.Anthropic')
    def test_generate_prompt_for_chunk(self, mock_anthropic):
        """Test prompt generation for a chunk."""
        # Mock the Anthropic API response
        mock_client = Mock()
        mock_response = Mock()
        mock_response.content = [Mock(text="Generated prompt for testing")]
        mock_client.messages.create.return_value = mock_response
        mock_anthropic.return_value = mock_client

        detector = NoveltyDetector(llm_provider='anthropic')

        chunk_text = "This is a test chunk about machine learning concepts."
        prompt = detector.generate_prompt_for_chunk(chunk_text)

        self.assertIsInstance(prompt, str)
        self.assertGreater(len(prompt), 0)

    @patch('novelty_detector.Anthropic')
    def test_build_faiss_index(self, mock_anthropic):
        """Test FAISS index building."""
        mock_client = Mock()
        mock_anthropic.return_value = mock_client

        detector = NoveltyDetector(llm_provider='anthropic')

        prompts = [
            "Prompt about topic A",
            "Prompt about topic B",
            "Prompt about topic C",
            "Another prompt about topic A"
        ]

        detector.build_faiss_index(prompts)

        # Check that index was built
        self.assertIsNotNone(detector.index)
        self.assertIsNotNone(detector.embeddings)
        self.assertEqual(detector.index.ntotal, len(prompts))

    @patch('novelty_detector.Anthropic')
    def test_calculate_novelty_scores(self, mock_anthropic):
        """Test novelty score calculation."""
        mock_client = Mock()
        mock_anthropic.return_value = mock_client

        detector = NoveltyDetector(llm_provider='anthropic')

        # Build index with test data
        prompts = [
            "Machine learning is a subset of artificial intelligence.",
            "Deep learning uses neural networks with multiple layers.",
            "Natural language processing enables computers to understand text.",
            "Machine learning algorithms learn from data.",
        ]

        detector.chunk_prompts = prompts
        detector.build_faiss_index(prompts)

        # Calculate novelty scores
        scores = detector.calculate_novelty_scores(k=2)

        # Should have scores for all prompts
        self.assertEqual(len(scores), len(prompts))

        # Each score should have required fields
        for score in scores:
            self.assertIn('chunk_index', score)
            self.assertIn('novelty_score', score)
            self.assertIn('similar_chunks', score)
            self.assertIsInstance(score['novelty_score'], float)
            self.assertGreaterEqual(score['novelty_score'], 0)
            self.assertLessEqual(score['novelty_score'], 1)

    @patch('novelty_detector.Anthropic')
    def test_get_summary_statistics(self, mock_anthropic):
        """Test summary statistics generation."""
        mock_client = Mock()
        mock_anthropic.return_value = mock_client

        detector = NoveltyDetector(llm_provider='anthropic')

        novelty_scores = [
            {'chunk_index': 0, 'novelty_score': 0.8},
            {'chunk_index': 1, 'novelty_score': 0.5},
            {'chunk_index': 2, 'novelty_score': 0.3},
            {'chunk_index': 3, 'novelty_score': 0.1},
        ]

        stats = detector.get_summary_statistics(novelty_scores)

        # Check all required statistics are present
        self.assertIn('total_chunks', stats)
        self.assertIn('mean_novelty', stats)
        self.assertIn('median_novelty', stats)
        self.assertIn('std_novelty', stats)
        self.assertIn('high_novelty_count', stats)
        self.assertIn('medium_novelty_count', stats)

        self.assertEqual(stats['total_chunks'], 4)
        self.assertEqual(stats['high_novelty_count'], 1)  # 0.8
        self.assertEqual(stats['medium_novelty_count'], 1)  # 0.5


class TestIntegration(unittest.TestCase):
    """Integration tests for the complete pipeline."""

    @patch('novelty_detector.Anthropic')
    def test_full_pipeline(self, mock_anthropic):
        """Test complete analysis pipeline with mock data."""
        # Mock LLM responses
        mock_client = Mock()
        mock_response = Mock()
        mock_response.content = [Mock(text="Test prompt")]
        mock_client.messages.create.return_value = mock_response
        mock_anthropic.return_value = mock_client

        # Create test text
        test_text = """
        Artificial intelligence is transforming the world in unprecedented ways.
        Machine learning algorithms can now process vast amounts of data.
        Deep learning has revolutionized computer vision and natural language processing.
        Neural networks are inspired by the structure of the human brain.
        Reinforcement learning enables agents to learn through trial and error.
        The future of AI holds both promise and challenges for society.
        """ * 10  # Repeat to create enough text for multiple chunks

        # Initialize components
        pdf_processor = PDFProcessor(chunk_size=50, overlap=10)
        novelty_detector = NoveltyDetector(llm_provider='anthropic')

        # Process text
        chunks = pdf_processor.chunk_text(test_text)
        self.assertGreater(len(chunks), 1)

        # Analyze novelty
        novelty_scores = novelty_detector.analyze_document(chunks, pdf_processor, k=3)

        # Verify results
        self.assertEqual(len(novelty_scores), len(chunks))

        for score in novelty_scores:
            self.assertIn('chunk_index', score)
            self.assertIn('novelty_score', score)
            self.assertIsInstance(score['novelty_score'], float)


def run_tests():
    """Run all tests."""
    # Create test suite
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()

    # Add test classes
    suite.addTests(loader.loadTestsFromTestCase(TestPDFProcessor))
    suite.addTests(loader.loadTestsFromTestCase(TestNoveltyDetector))
    suite.addTests(loader.loadTestsFromTestCase(TestIntegration))

    # Run tests
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)

    return result.wasSuccessful()


if __name__ == '__main__':
    success = run_tests()
    sys.exit(0 if success else 1)
