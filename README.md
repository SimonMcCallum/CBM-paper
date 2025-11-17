# CBM-paper

This repository contains the research code and documentation for a study on Confidence Based Marking (CBM) comparing AI and human performance on quiz questions.

## Repository Structure

- **`Code/`** - Python analysis scripts and AI model evaluation tools for the core research
- **`Documentation/`** - Research paper documentation and generated figures
- **`Canvas_update/`** - Tools for Canvas LMS integration and CBM question insertion
- **`ChromeQuizDownloader/`** - Browser extension for quiz extraction from Canvas
- **`cbm-question-system/`** - Web-based CBM question system with database backend
- **`server/`** - Node.js server for QTI processing and quiz management
- **`web/`** - Static web interface for quiz interaction
- **`novelty_detector/`** - PDF novelty detection system using LLM and FAISS embeddings

## Core Research Code (`Code/` Directory)

The `Code/` directory contains the main research implementation with several key components:

### AI Model Evaluation Framework
- **Multi-model Testing**: Supports OpenAI GPT models, Anthropic Claude, Google Gemini, and DeepSeek
- **Temperature Cycling**: Tests each model at temperatures 0.0, 0.7, and 1.0 with configurable repetitions for statistical reliability
- **Confidence Scoring**: Implements confidence-based marking where AI models provide both answers and confidence levels
- **Automated Analysis**: Generates statistical comparisons between AI and human performance

### Key Research Scripts
- `enhanced_ai_tester.py` - Main AI evaluation framework with advanced testing capabilities
- `score_analysis.py` - Statistical analysis and figure generation for the research paper
- `askAll.py` - Batch processing for testing multiple AI models on question sets
- `config.py` - Centralized configuration for API keys and experimental parameters

### Data Pipeline
1. **Input Data**: `AI_Scores.csv` and `Human_Scores.csv` containing performance metrics
2. **Processing**: AI models answer questions with confidence ratings, results stored in `results/`
3. **Analysis**: Statistical analysis generates figures in `Documentation/generated/figures/`
4. **Output**: LaTeX tables and figures for the research paper

### QTI Integration
- **QTI Conversion**: Tools to convert questions between JSON and QTI (Question & Test Interoperability) format
- **Template System**: Jinja2 templates for different question types (multiple choice, true/false, essay, etc.)
- **Canvas Integration**: Seamless integration with Canvas LMS through QTI package import/export

## Installation

1. Clone the repository with submodules:
```bash
git clone --recurse-submodules https://github.com/SimonMcCallum/CBM-paper.git
cd CBM-paper
```

2. Install Python dependencies:
```bash
pip install -r requirements.txt
```

3. Configure API keys in `Code/config.py` for AI model testing:
   - OpenAI API key for GPT models
   - Anthropic API key for Claude models  
   - Google API key for Gemini models
   - DeepSeek API key for DeepSeek models

4. Install Node.js dependencies for the server:
```bash
cd server
npm install
```

## Usage

### Core Research Workflow

#### 1. Generate Research Figures and Statistics
```bash
python3 Code/score_analysis.py
```
This creates figures and statistics in `Documentation/generated/figures/` used by the research paper.

#### 2. Run Complete AI Model Evaluation
```bash
python3 Code/askAll.py
```
Tests all configured AI models on the question set with multiple temperature settings and repetitions.

#### 3. Advanced AI Testing with Enhanced Features
```bash
python3 Code/enhanced_ai_tester.py
```
Provides detailed AI model evaluation with confidence scoring and performance analysis.

#### 4. Build Research Paper
```bash
cd Documentation/generated
pdflatex main.tex
```

### Supporting Tools

#### QTI Processing Server
```bash
cd server
npm start
```
Starts the Node.js server for processing QTI quiz packages.

#### Canvas Integration
```bash
python3 Canvas_update/insertCBM.py <qti_file>
```
Inserts confidence-based marking questions into Canvas quiz QTI packages.

#### Web Interface
```bash
cd cbm-question-system
npm install
npm start
```
Launches the web-based CBM question system with database backend.

## Research Methodology

The code implements a comprehensive evaluation comparing AI model performance with human performance on quiz questions using confidence-based marking:

1. **Question Sets**: Multiple choice questions with varying difficulty levels
2. **AI Models**: Tests 4 major AI providers with different model variants
3. **Confidence Scoring**: Both AI and humans provide confidence ratings (1-5 scale)
4. **Statistical Analysis**: Generates comparative performance metrics and visualizations
5. **Temperature Analysis**: Evaluates how model temperature affects confidence calibration
6. **Repetition Testing**: Multiple runs per configuration ensure statistical significance

The research examines whether AI models can effectively utilize confidence-based marking and how their confidence calibration compares to human participants.

## PDF Novelty Detection

The repository now includes a sophisticated novelty detection system for analyzing PDF documents:

### Features
- **LLM-Based Analysis**: Uses Claude, GPT, or Gemini to generate semantic prompts for text chunks
- **FAISS Similarity**: Fast similarity search using Facebook's FAISS library for novelty scoring
- **Smart Chunking**: Intelligently splits documents into overlapping segments with context
- **Visual Annotations**: Color-coded PDF annotations showing novelty levels
- **REST API**: Flask server with endpoints for upload, analysis, and download

### Quick Start

```bash
cd novelty_detector
pip install -r requirements.txt
cp .env.example .env
# Add your API keys to .env
python server.py
```

Then upload a PDF:
```bash
curl -X POST -F "file=@document.pdf" http://localhost:5000/upload
```

See `novelty_detector/README.md` for complete documentation.

### Use Cases
- Identify novel contributions in research papers
- Highlight unique content in documents
- Find repetitive sections for editing
- Analyze document structure and content distribution
