# PDF Novelty Detector

A sophisticated PDF novelty detection server that analyzes PDFs and annotates them based on the novelty of each text segment using LLM-based analysis and FAISS embeddings.

## Overview

This system allows you to:

- Upload PDF documents for automated novelty analysis
- Chunk text into semantically meaningful segments (~100-200 words)
- Use LLMs (Claude, ChatGPT, or Gemini) to generate semantic prompts for each chunk
- Analyze chunk uniqueness using FAISS similarity search on embeddings
- Download annotated PDFs with color-coded novelty indicators
- Get detailed JSON reports with novelty scores and statistics

## Features

- **Multi-LLM Support**: Works with Anthropic Claude, OpenAI GPT, and Google Gemini
- **Smart Chunking**: Intelligently splits text into overlapping segments with context
- **Semantic Analysis**: Uses LLMs to capture the essence of each text segment
- **FAISS Similarity**: Fast similarity search using Facebook's FAISS library
- **Visual Annotations**: Color-coded PDF annotations showing novelty levels
- **REST API**: Simple HTTP endpoints for easy integration
- **Comprehensive Testing**: Full test suite with mocks for reliable operation

## Novelty Detection Algorithm

The system uses a sophisticated multi-step approach:

1. **Text Extraction**: Extract text from PDF using PyMuPDF
2. **Smart Chunking**: Break text into ~100-200 word segments with overlap
3. **Prompt Generation**: Use LLM to analyze each chunk with surrounding context and generate a semantic prompt
4. **Embedding**: Create vector embeddings using sentence transformers
5. **Similarity Search**: Use FAISS to find similar chunks within the document
6. **Novelty Scoring**: Calculate novelty based on uniqueness (lower similarity = higher novelty)
7. **Annotation**: Generate color-coded PDF showing novelty levels

## Installation

### Prerequisites

- Python 3.8+
- pip
- At least one LLM API key (Anthropic, OpenAI, or Google)

### Setup

1. Clone or navigate to the repository:
```bash
cd CBM-paper/novelty_detector
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Download NLTK data (if needed):
```bash
python -c "import nltk; nltk.download('punkt')"
```

4. Configure API keys:
```bash
cp .env.example .env
# Edit .env and add your API keys
```

You need at least one of:
- `ANTHROPIC_API_KEY` for Claude
- `OPENAI_API_KEY` for ChatGPT
- `GOOGLE_API_KEY` for Gemini

5. Run the server:
```bash
python server.py
```

The server will start on `http://localhost:5000`

## API Usage

### Health Check

```bash
curl http://localhost:5000/health
```

### Get Configuration

```bash
curl http://localhost:5000/config
```

### Upload and Analyze PDF

```bash
curl -X POST -F "file=@document.pdf" \
  -F "llm_provider=anthropic" \
  -F "chunk_size=150" \
  -F "overlap=20" \
  http://localhost:5000/upload
```

**Parameters:**
- `file` (required): PDF file to analyze
- `llm_provider` (optional): LLM to use ('anthropic', 'openai', or 'google'), default: 'anthropic'
- `chunk_size` (optional): Target words per chunk, default: 150
- `overlap` (optional): Words to overlap between chunks, default: 20
- `k_neighbors` (optional): Number of similar chunks to compare, default: 5

**Response:**
```json
{
  "success": true,
  "original_filename": "document.pdf",
  "annotated_filename": "annotated_document.pdf",
  "results_filename": "document_results.json",
  "chunks_analyzed": 15,
  "statistics": {
    "total_chunks": 15,
    "mean_novelty": 0.62,
    "median_novelty": 0.58,
    "high_novelty_count": 4,
    "medium_novelty_count": 8,
    "low_novelty_count": 2,
    "very_low_novelty_count": 1
  },
  "novelty_scores": [...],
  "download_url": "/download/annotated_document.pdf",
  "results_url": "/download/document_results.json"
}
```

### Download Annotated PDF

```bash
curl -O http://localhost:5000/download/annotated_document.pdf
```

### Download Results JSON

```bash
curl -O http://localhost:5000/download/document_results.json
```

### Analyze Text Directly (Testing)

```bash
curl -X POST http://localhost:5000/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Your text here...",
    "chunk_size": 150,
    "llm_provider": "anthropic"
  }'
```

## Novelty Score Legend

- **High Novelty (>0.7)**: Green - Unique content, highly novel
- **Medium Novelty (0.4-0.7)**: Yellow - Moderately novel content
- **Low Novelty (0.2-0.4)**: Orange - Somewhat repetitive content
- **Very Low Novelty (<0.2)**: Red - Highly repetitive or common content

## Architecture

```
novelty_detector/
├── server.py              # Flask REST API server
├── pdf_processor.py       # PDF extraction, chunking, annotation
├── novelty_detector.py    # LLM-based novelty analysis with FAISS
├── test_novelty_detector.py  # Comprehensive test suite
├── requirements.txt       # Python dependencies
├── .env.example          # Environment variable template
├── uploads/              # Temporary upload directory
└── README.md             # This file
```

### Components

**server.py**
- Flask web server with REST API endpoints
- File upload handling with security
- Request validation and error handling
- CORS support for web integration

**pdf_processor.py**
- PDF text extraction using PyMuPDF (fitz)
- Smart text chunking with overlap
- Context extraction for LLM analysis
- PDF annotation with color-coded novelty

**novelty_detector.py**
- LLM client initialization (Anthropic, OpenAI, Google)
- Semantic prompt generation for text chunks
- FAISS index building for similarity search
- Novelty score calculation based on uniqueness
- Summary statistics generation

## Testing

Run the test suite:

```bash
python test_novelty_detector.py
```

Tests cover:
- Text chunking with various inputs
- Context extraction
- Color mapping
- FAISS index building
- Novelty score calculation
- Full pipeline integration

## Configuration

Environment variables (set in `.env`):

### API Keys
- `ANTHROPIC_API_KEY`: Your Anthropic API key
- `OPENAI_API_KEY`: Your OpenAI API key
- `GOOGLE_API_KEY`: Your Google API key

### Flask Settings
- `FLASK_ENV`: Environment (development/production)
- `FLASK_DEBUG`: Enable debug mode (1/0)
- `PORT`: Server port (default: 5000)
- `UPLOAD_FOLDER`: Directory for uploads (default: uploads)
- `MAX_CONTENT_LENGTH`: Max upload size in bytes (default: 16MB)

### Analysis Parameters
- `DEFAULT_CHUNK_SIZE`: Target words per chunk (default: 150)
- `CHUNK_OVERLAP`: Words to overlap (default: 20)
- `NOVELTY_THRESHOLD_HIGH`: High novelty threshold (default: 0.7)
- `NOVELTY_THRESHOLD_MEDIUM`: Medium novelty threshold (default: 0.4)
- `NOVELTY_THRESHOLD_LOW`: Low novelty threshold (default: 0.2)
- `EMBEDDING_MODEL`: Sentence transformer model (default: all-MiniLM-L6-v2)

## Use Cases

### Academic Research
Analyze research papers to identify novel contributions vs. background material.

### Document Review
Highlight unique content in legal documents, contracts, or reports.

### Content Analysis
Identify repetitive sections in long documents for editing and refinement.

### Plagiarism Detection
Find sections with low novelty that may need citation or revision.

### Literature Review
Quickly identify the most novel sections of papers when surveying literature.

## Performance

- **Speed**: Processes ~1-2 pages per second depending on LLM response time
- **Accuracy**: Novelty scores are relative within the document
- **Scalability**: FAISS enables efficient similarity search even for large documents
- **Memory**: Uses ~100MB RAM for typical documents, more for very large PDFs

## Limitations

- Novelty is measured relative to other chunks in the **same document**
- Does not compare against external corpora or databases
- LLM API calls add latency (~1-2 seconds per chunk)
- PDF annotation is basic (legend only, not inline highlighting yet)
- Requires at least one LLM API key to function

## Future Enhancements

- [ ] Inline PDF highlighting with precise text positioning
- [ ] External corpus comparison for absolute novelty
- [ ] Batch processing multiple PDFs
- [ ] Caching of embeddings for faster reanalysis
- [ ] Interactive web UI for results visualization
- [ ] Export to various formats (Markdown, HTML, etc.)
- [ ] Support for Word documents and other formats

## License

This project is part of the CBM-paper repository. See the main repository for license information.

## Contributing

Contributions are welcome! Please:

1. Run tests before submitting PRs
2. Follow existing code style
3. Add tests for new features
4. Update documentation as needed

## Troubleshooting

**Issue**: "No API key found"
- Solution: Set at least one API key in `.env` file

**Issue**: "PDF extraction failed"
- Solution: Ensure PDF is not password-protected or corrupted

**Issue**: "FAISS import error"
- Solution: Install faiss-cpu: `pip install faiss-cpu`

**Issue**: "Slow processing"
- Solution: Reduce chunk_size or use faster LLM (e.g., gpt-4o-mini instead of gpt-4)

## Support

For issues or questions:
- Check the test suite for examples
- Review API documentation above
- Open an issue in the main repository
