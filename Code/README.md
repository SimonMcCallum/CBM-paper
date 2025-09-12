# Code Directory

This directory contains the core Python scripts and tools for the Confidence Based Marking (CBM) research project. The code implements AI model evaluation, data analysis, and QTI quiz generation functionality.

## Main Scripts

### AI Model Testing
- **`enhanced_ai_tester.py`** - Advanced AI testing framework that evaluates multiple models (OpenAI, Claude, Gemini, DeepSeek) on quiz questions with confidence scoring
- **`test_system.py`** - System testing utilities for validating AI model responses
- **`askAll.py`** - Batch processing script to test all configured AI models on question sets
- **`askClaude.py`** - Specific interface for testing Claude models
- **`api_calls.py`** - Common API interaction utilities for different AI providers

### Data Analysis
- **`score_analysis.py`** - Main analysis script that generates statistics, histograms, and performance metrics for the research paper
- **`ai-scatter-plot.py`** - Creates scatter plot visualizations of AI performance data
- **`graph-visualise.py`** - General graph visualization utilities
- **`summary.py`** - Generates summary statistics from experimental results

### Quiz and Assessment Tools
- **`createQTIquiz.py`** - Converts question data into QTI (Question & Test Interoperability) format
- **`run_experiment.py`** - Orchestrates complete experimental runs with multiple models and configurations

### Data Processing
- **`conversation.py`** - Handles conversational AI interactions and logging
- **`combineLinearprompts.py`** - Combines linear prompt variations for testing
- **`combineCombinedprompts.py`** - Merges combined prompt variations

## Configuration Files

- **`config.py`** - Central configuration management for API keys, model settings, and experimental parameters
- **`models.json`** - Model configuration including supported providers, temperature settings, and API endpoints
- **`prompts.json`** - Template prompts for different question types and confidence levels
- **`mcq_eval_format.json`** - Format specifications for multiple choice question evaluation
- **`mcq.json`** - Multiple choice question definitions

## QTI Converter Module

The `qti_converter/` subdirectory contains tools for converting questions to QTI format:

- **`convertjson2qti.py`** - Main conversion script from JSON to QTI XML format
- **`qti_scheme.json`** - QTI schema definitions
- **`qti_MQC_scheme.json`** - Multiple choice specific QTI schema
- **`templates/`** - Jinja2 templates for different question types:
  - `multiple_choice.xml.j2` - Multiple choice questions
  - `true_false.xml.j2` - True/false questions
  - `essay.xml.j2` - Essay questions
  - `fill_in_blank.xml.j2` - Fill-in-the-blank questions
  - `matching.xml.j2` - Matching questions
  - `multiple_answers.xml.j2` - Multiple answer questions
  - `imsmanifest.xml.j2` - IMS manifest template

## Key Features

### AI Model Support
- **OpenAI**: GPT-4o, GPT-4o-mini, GPT-4-turbo, GPT-4, GPT-3.5-turbo
- **Anthropic**: Claude 3.5 Sonnet, Claude 3.5 Haiku, Claude 3 Sonnet, Claude 3 Haiku
- **Google**: Gemini 1.5 Pro, Gemini 1.5 Flash, Gemini 1.0 Pro
- **DeepSeek**: DeepSeek Chat, DeepSeek Coder

### Temperature Testing
- Tests models at multiple temperature settings (0.0, 0.7, 1.0)
- Performs configurable repetitions per temperature for statistical reliability
- Automated confidence scoring and performance analysis

### CBM Scoring System
The enhanced AI tester implements a confidence-based marking matrix:
- Very confident (1.0): +2.0 (correct), -2.0 (incorrect)
- Confident (0.8): +1.5 (correct), -1.5 (incorrect)
- Somewhat confident (0.6): +1.0 (correct), -1.0 (incorrect)
- Uncertain (0.4): +0.5 (correct), -0.5 (incorrect)
- Very uncertain (0.2): 0.0 (correct), 0.0 (incorrect)

### Data Pipeline
1. **Input**: Quiz questions and human performance data from CSV files
2. **Processing**: AI model evaluation with confidence scoring
3. **Analysis**: Statistical analysis and visualization generation
4. **Output**: Research paper figures and performance metrics

## Usage Examples

### Run Complete Analysis
```bash
python3 score_analysis.py
```

### Test All AI Models
```bash
python3 askAll.py
```

### Enhanced AI Testing with CBM
```bash
python3 enhanced_ai_tester.py
```

### Generate QTI Quiz
```bash
python3 createQTIquiz.py
```

### Test with Configuration
```bash
python3 enhanced_ai_tester.py --config test_config.json
```

## Dependencies

Key Python packages required:
- `openai` - OpenAI API client
- `anthropic` - Claude API client
- `google-generativeai` - Gemini API client
- `requests` - HTTP requests
- `aiohttp` - Async HTTP client
- `json` - JSON processing
- `matplotlib` - Data visualization
- `numpy` - Numerical computing
- `jinja2` - Template engine for QTI generation

See `../requirements.txt` for complete dependency list.

## Environment Setup

Configure API keys as environment variables:
```bash
export OPENAI_API_KEY_CBM="your_openai_key"
export ANTHROPIC_API_KEY_CBM="your_claude_key"
export GEMINI_API_KEY_CBM="your_gemini_key"
export DEEPSEEK_API_KEY_CBM="your_deepseek_key"
```

## Output Files

The analysis scripts generate files in `../Documentation/generated/figures/`:
- `ai_scores.dat` - AI performance data for plotting
- `human_hist.dat` - Human score histograms
- `human_correct_dist.dat` - Human correctness distributions
- `stats.txt` - Summary statistics

Results from AI testing are stored in `../results/` directory:
- `answers.json` - Raw AI responses and scores
- `test_summary.json` - Comprehensive test statistics
- `evaluations.json` - Evaluation metrics

## Configuration Format

Example configuration for enhanced testing:
```json
{
  "selected_vendors": ["OpenAI", "Claude"],
  "temperatures": [0.0, 0.7, 1.0],
  "num_repetitions": 10
}
```

## Research Methodology

The code implements comprehensive CBM evaluation:
1. **Question Loading**: Reads multiple choice questions from JSON format
2. **Model Testing**: Tests each AI model with confidence prompts
3. **Response Parsing**: Extracts answers and confidence levels from AI responses
4. **CBM Scoring**: Calculates confidence-based marking scores
5. **Statistical Analysis**: Generates comparative performance metrics
6. **Visualization**: Creates data files for research paper figures
