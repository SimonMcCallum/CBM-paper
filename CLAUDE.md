# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a research repository for a Confidence Based Marking (CBM) paper that analyzes AI and human performance on quiz questions. The repository contains four main components:

1. **Research Code** (`Code/` directory) - Python scripts for data analysis and AI model evaluation
2. **Canvas Integration Tools** (`Canvas_update/` directory) - Tools for inserting confidence questions into Canvas quizzes
3. **Chrome Extension** (`ChromeQuizDownloader/` directory) - Browser extension to download Canvas quizzes as QTI packages
4. **PDF Novelty Detector** (`novelty_detector/` directory) - LLM-based system for analyzing novelty in PDF documents

## Key Commands

### Data Analysis
```bash
# Generate statistics and figures for the paper
python3 Code/score_analysis.py
```

### PDF Generation
```bash
# Build the paper PDF from generated LaTeX
pdflatex Documentation/generated/main.tex
```

### QTI Quiz Processing Server
```bash
# Install server dependencies
cd server && npm install

# Start development server with auto-reload
npm run dev

# Start production server
npm start
```

### PDF Novelty Detection Server
```bash
# Install Python dependencies
cd novelty_detector
pip install -r requirements.txt

# Configure API keys
cp .env.example .env
# Edit .env and add your API keys (ANTHROPIC_API_KEY, OPENAI_API_KEY, or GOOGLE_API_KEY)

# Start server
python server.py

# Run tests
python test_novelty_detector.py
```

### Repository Setup
```bash
# Clone with submodules (includes Overleaf project)
git clone --recurse-submodules <repo>

# Or if already cloned, initialize submodules
git submodule update --init --recursive
```

## Architecture

### Data Flow
- **Input**: `AI_Scores.csv` and `Human_Scores.csv` contain performance data
- **Processing**: `score_analysis.py` generates statistics and histogram data
- **Output**: Generated figures and stats are written to `Documentation/generated/figures/`
- **Paper**: LaTeX source in `Documentation/generated/main.tex` uses the generated data files

### Canvas Quiz Processing
- **QTI Format**: Uses XML-based QTI (Question & Test Interoperability) format for quiz exchange
- **CBM Insertion**: `insertCBM.py` parses QTI XML and inserts confidence questions after each quiz question
- **Templates**: Supports both 5-choice confidence questions and True/False confidence questions
- **UUID Management**: Generates fresh UUIDs for new questions and updates manifest files

### AI Model Evaluation Framework
- **Configuration**: `config.py` manages API keys and model settings
- **Models**: Supports OpenAI, Anthropic Claude, Gemini, and DeepSeek APIs
- **Temperature Cycling**: Tests models at temperatures [0.0, 0.7, 1.0] with 10 repetitions each
- **Data Storage**: Results stored in JSON format in `results/` directory

### PDF Novelty Detection System
- **LLM Analysis**: Uses Claude, GPT, or Gemini to generate semantic prompts for text chunks
- **FAISS Embeddings**: Fast similarity search to determine novelty within documents
- **Smart Chunking**: Splits PDFs into ~100-200 word overlapping segments with context
- **REST API**: Flask server at port 5000 with endpoints for upload/analyze/download
- **Color Coding**: Annotates PDFs with green (high novelty), yellow (medium), orange (low), red (very low)

## File Structure Notes

- `answers/` - Contains quiz answer data
- `logs/` - Interaction logs for AI model conversations (gitignored)
- `Documentation/overleaf/` - Overleaf project submodule for collaborative writing
- Canvas quiz files are in QTI ZIP format with XML manifests and question definitions
- `novelty_detector/` - Self-contained novelty detection system with its own dependencies and server
- `novelty_detector/uploads/` - Temporary directory for PDF uploads (gitignored)