# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a research repository for a Confidence Based Marking (CBM) paper that analyzes AI and human performance on quiz questions. The repository contains four main components:

1. **Research Code** (`Code/` directory) - Python scripts for data analysis and AI model evaluation
2. **CBM Benchmark System** (`benchmark/` directory) - Comprehensive benchmarking framework for evaluating LLM confidence calibration across MMLU, TruthfulQA, ARC, and ambiguous questions
3. **Benchmark Dashboard** (`website/` directory) - Vue 3 SPA for displaying benchmark results
4. **Canvas Integration Tools** (`Canvas_update/` directory) - Tools for inserting confidence questions into Canvas quizzes
5. **Chrome Extension** (`ChromeQuizDownloader/` directory) - Browser extension to download Canvas quizzes as QTI packages
6. **PDF Novelty Detector** (`novelty_detector/` directory) - LLM-based system for analyzing novelty in PDF documents

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

### CBM Benchmark System
```bash
# Install Python dependencies
pip install -r benchmark/requirements.txt

# Download and convert datasets
python -m benchmark.run_benchmark --download-only --sample-size 10

# Run benchmark (small test)
python -m benchmark.run_benchmark --dataset mmlu --variant all --sample-size 10 --repetitions 1

# Run full benchmark
python -m benchmark.run_benchmark --dataset all --variant all

# Export results for website
python -m benchmark.run_export

# Build and serve website locally
cd website && npm install && npm run dev
```

### Deploy Benchmark Website
```bash
# Build and deploy via SFTP
python deploy/sftp_deploy.py --config deploy/deploy_config.json

# Dry run (show what would be deployed)
python deploy/sftp_deploy.py --dry-run
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

### CBM Benchmark Architecture
- **4 Confidence Variants**: {Discrete CBM, Continuous HLCC} x {Combined single-turn, Linear two-turn}
- **Scoring**: Discrete (3 levels: 1.0/0, 1.5/-0.5, 2/-2) and HLCC (correct=x+1, incorrect=-2x^2)
- **Datasets**: MMLU (14K questions), TruthfulQA (817), ARC (3.5K), Ambiguous (25 hand-crafted)
- **Metrics**: ECE, Brier Score, overconfidence rate, calibration gap
- **Pipeline**: Download → Convert → Evaluate → Score → Aggregate → Export JSON → SPA website → SFTP deploy
- **API Keys**: Set OPENAI_API_KEY_CBM, ANTHROPIC_API_KEY_CBM, GEMINI_API_KEY_CBM, DEEPSEEK_API_KEY_CBM, XAI_API_KEY_CBM

## File Structure Notes

- `answers/` - Contains quiz answer data
- `logs/` - Interaction logs for AI model conversations (gitignored)
- `Documentation/overleaf/` - Overleaf project submodule for collaborative writing
- `benchmark/` - CBM benchmark system with datasets/, scoring/, prompting/, engine/, results/ subpackages
- `benchmark/datasets/cache/` - Downloaded raw datasets (gitignored)
- `benchmark/datasets/unified/` - Converted unified-format questions (gitignored)
- `benchmark/results/raw/` - Per-run raw results (gitignored)
- `benchmark/results/published/` - Aggregated JSON for website (committed)
- `website/` - Vue 3 SPA dashboard for benchmark results
- `deploy/` - SFTP deployment scripts
- Canvas quiz files are in QTI ZIP format with XML manifests and question definitions
- `novelty_detector/` - Self-contained novelty detection system with its own dependencies and server
- `novelty_detector/uploads/` - Temporary directory for PDF uploads (gitignored)