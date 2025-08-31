# Enhanced AI Testing System with Confidence-Based Marking (CBM)

This document describes the enhanced AI testing system that has been integrated into the CBM-paper project. The system tests various generative AI models using confidence-based marking to evaluate their performance on multiple choice questions.

## Overview

The enhanced AI testing system consists of:

1. **Python Testing Engine** (`Code/enhanced_ai_tester.py`) - Asynchronous testing of multiple AI models
2. **Node.js API** (`cbm-question-system/src/routes/ai-testing.js`) - REST API for managing tests and results
3. **Web Dashboard** - Interactive web interface for running tests and viewing results
4. **Confidence-Based Marking** - Advanced scoring system that considers both correctness and confidence

## Features

### 🤖 Multi-Model AI Testing
- **OpenAI**: GPT-4o, GPT-4o-mini, GPT-4-turbo, GPT-4, GPT-3.5-turbo
- **Anthropic Claude**: Claude-3.5-sonnet, Claude-3.5-haiku, Claude-3-sonnet, Claude-3-haiku
- **Google Gemini**: Gemini-1.5-pro, Gemini-1.5-flash, Gemini-1.0-pro
- **DeepSeek**: DeepSeek-chat, DeepSeek-coder

### 📊 Confidence-Based Marking (CBM)
CBM scoring matrix rewards confident correct answers and penalizes confident incorrect answers:

| Confidence Level | Correct Answer | Incorrect Answer |
|------------------|----------------|------------------|
| Very High (1.0)  | +2.0          | -2.0            |
| High (0.8)       | +1.5          | -1.5            |
| Medium (0.6)     | +1.0          | -1.0            |
| Low (0.4)        | +0.5          | -0.5            |
| Very Low (0.2)   | 0.0           | 0.0             |

### 📈 Comprehensive Analytics
- **Vendor Performance Comparison** - Accuracy, confidence, and CBM scores by AI provider
- **Confidence Calibration Analysis** - How well models align confidence with accuracy
- **Temperature Impact Analysis** - Performance across different temperature settings
- **Question Difficulty Assessment** - Which questions are most challenging for AI models

### 🌐 Interactive Web Dashboard
- Real-time test execution and monitoring
- Visual analytics with charts and graphs
- Detailed result exploration with drill-down capabilities
- Export functionality for research purposes

## Installation and Setup

### Prerequisites
- Python 3.8+
- Node.js 16+
- API keys for the AI services you want to test

### 1. Install Python Dependencies
```bash
pip install -r requirements.txt
```

### 2. Install Node.js Dependencies
```bash
cd cbm-question-system
npm install
```

### 3. Configure API Keys
Create a `.env` file in the project root with your API keys:

```env
# OpenAI
OPENAI_API_KEY_CBM=your_openai_api_key

# Anthropic Claude
ANTHROPIC_API_KEY_CBM=your_anthropic_api_key

# Google Gemini
GEMINI_API_KEY_CBM=your_gemini_api_key

# DeepSeek
DEEPSEEK_API_KEY_CBM=your_deepseek_api_key
```

### 4. Prepare Question Data
Ensure your questions are in the correct format in `Code/mcq.json`:

```json
{
  "questions": [
    {
      "id": 1,
      "question": "Your question text here",
      "options": [
        {"key": "a", "text": "Option A"},
        {"key": "b", "text": "Option B"},
        {"key": "c", "text": "Option C"},
        {"key": "d", "text": "Option D"}
      ],
      "correctAnswer": "a"
    }
  ]
}
```

## Usage

### Running Tests via Web Interface

1. **Start the Web Server**
   ```bash
   cd cbm-question-system
   npm start
   ```

2. **Access the Dashboard**
   Open http://localhost:3000 in your browser

3. **Navigate to AI Testing**
   Click on "AI Testing" in the navigation menu

4. **Run Tests**
   Click "Run AI Testing" to start comprehensive testing

### Running Tests via Command Line

```bash
cd Code
python enhanced_ai_tester.py
```

### Configuration Options

Edit `Code/config.py` to customize testing parameters:

```python
# Temperature settings to test
TEMPERATURES = [0.0, 0.7, 1.0]

# Number of repetitions per model/temperature combination
NUM_REPETITIONS = 3

# File paths
QUESTION_FILE = "code/mcq.json"
MODEL_FILE = "code/models.json"
RESULTS_FILE = "results/answers.json"
```

## API Endpoints

### GET `/api/ai-testing/results`
Retrieve all AI testing results and summary statistics.

### GET `/api/ai-testing/analysis/confidence`
Get confidence calibration analysis showing how well models align confidence with accuracy.

### GET `/api/ai-testing/analysis/cbm`
Get CBM scoring analysis including score distributions and vendor performance.

### POST `/api/ai-testing/run-test`
Trigger a new AI testing run. This will execute the Python testing script asynchronously.

### GET `/api/ai-testing/results/vendor/:vendor`
Get results filtered by specific AI vendor (OpenAI, Claude, Gemini, DeepSeek).

## Understanding the Results

### Accuracy Metrics
- **Overall Accuracy**: Percentage of questions answered correctly
- **Vendor Accuracy**: Accuracy broken down by AI provider
- **Model Accuracy**: Accuracy for specific models within each vendor

### Confidence Metrics
- **Average Confidence**: Mean confidence level across all responses (0.0-1.0)
- **Confidence Calibration**: How well confidence correlates with actual correctness
- **Confidence Buckets**: Performance analysis grouped by confidence ranges

### CBM Scores
- **Positive Scores**: Confident correct answers (good performance)
- **Negative Scores**: Confident incorrect answers (overconfident errors)
- **Neutral Scores**: Low-confidence responses (appropriate uncertainty)

### Performance Indicators
- **High CBM Score + High Accuracy**: Well-calibrated, confident, and correct
- **High Accuracy + Low CBM Score**: Correct but under-confident
- **Low Accuracy + High Confidence**: Overconfident and often wrong
- **Low Accuracy + Low Confidence**: Appropriately uncertain when unsure

## Research Applications

This system is designed to support research into:

1. **AI Model Calibration** - How well do different models know what they know?
2. **Confidence-Based Assessment** - Can we improve evaluation by considering confidence?
3. **Cross-Model Comparison** - Which models perform best on different types of questions?
4. **Temperature Effects** - How does randomness affect both accuracy and confidence?
5. **Question Difficulty Analysis** - What makes questions challenging for AI systems?

## File Structure

```
CBM-paper/
├── Code/
│   ├── enhanced_ai_tester.py      # Main testing engine
│   ├── config.py                  # Configuration settings
│   ├── models.json               # AI model definitions
│   └── mcq.json                  # Question bank
├── cbm-question-system/
│   ├── src/routes/ai-testing.js  # API endpoints
│   ├── public/index.html         # Web dashboard
│   └── public/js/app.js          # Frontend JavaScript
├── results/
│   ├── answers.json              # Raw test results
│   └── test_summary.json         # Aggregated statistics
└── logs/
    └── interaction_log.json      # Detailed interaction logs
```

## Troubleshooting

### Common Issues

1. **API Key Errors**
   - Ensure all required API keys are set in environment variables
   - Check that keys have sufficient credits/quota

2. **Rate Limiting**
   - The system includes built-in rate limiting and retry logic
   - Consider reducing `NUM_REPETITIONS` if hitting limits frequently

3. **Memory Issues**
   - Large test runs can consume significant memory
   - Consider testing smaller subsets of questions or models

4. **Network Timeouts**
   - Some AI APIs can be slow to respond
   - The system includes timeout handling and will retry failed requests

### Getting Help

- Check the console output for detailed error messages
- Review the `logs/interaction_log.json` file for debugging information
- Ensure all dependencies are installed correctly
- Verify that your question format matches the expected schema

## Contributing

To extend the system:

1. **Adding New AI Providers**: Update `models.json` and add API integration in `enhanced_ai_tester.py`
2. **New Analysis Types**: Add endpoints in `ai-testing.js` and corresponding UI in the web dashboard
3. **Custom Scoring**: Modify the CBM matrix in `enhanced_ai_tester.py`
4. **Additional Metrics**: Extend the summary generation in the `generate_summary()` method

## License

This enhanced AI testing system is part of the CBM-paper research project. Please cite appropriately if used in academic work.
