# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a research repository for a Confidence Based Marking (CBM) paper that analyzes AI and human performance on quiz questions. The repository contains three main components:

1. **Research Code** (`Code/` directory) - Python scripts for data analysis and AI model evaluation
2. **Canvas Integration Tools** (`Canvas_update/` directory) - Tools for inserting confidence questions into Canvas quizzes
3. **Chrome Extension** (`ChromeQuizDownloader/` directory) - Browser extension to download Canvas quizzes as QTI packages

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

## File Structure Notes

- `answers/` - Contains quiz answer data
- `logs/` - Interaction logs for AI model conversations
- `Documentation/overleaf/` - Overleaf project submodule for collaborative writing
- Canvas quiz files are in QTI ZIP format with XML manifests and question definitions