# XAI (Grok-4) Integration for CBM Question System

This document describes the integration of XAI's Grok-4 model into the CBM (Confidence-Based Marking) question system.

## Overview

The integration transforms the original `Code/askXAI.py` script into a modular, testable system that can ask single questions and provide detailed analysis with confidence-based marking support.

## Files Added/Modified

### New Files Created

1. **`cbm-question-system/src/services/xaiService.js`**
   - Main XAI service provider
   - Implements single question asking with confidence parsing
   - Calculates CBM (Confidence-Based Marking) scores
   - Handles API communication with XAI's Grok-4 model

2. **`cbm-question-system/test-xai.js`**
   - Node.js test script for testing XAI integration
   - Does not require full server infrastructure
   - Tests both confidence and non-confidence question modes

3. **`cbm-question-system/test-single-question.py`**
   - Python test script equivalent to the original askXAI.py
   - Enhanced with single question functionality and result analysis
   - Maintains compatibility with existing Python-based testing

### Modified Files

1. **`cbm-question-system/src/services/llmService.js`**
   - Added XAI provider to the LLM service ecosystem
   - Integrated XAI alongside existing providers (OpenAI, Claude, Gemini, DeepSeek)

2. **`cbm-question-system/src/routes/ai-testing.js`**
   - Added XAI to API key configuration checks
   - New endpoints for single question testing:
     - `POST /api/ai-testing/test-single-question` - Test custom questions
     - `POST /api/ai-testing/test-mcq-question` - Test questions from MCQ database
     - `GET /api/ai-testing/mcq-questions` - Get available MCQ questions

## Key Features

### XAI Service (`xaiService.js`)

- **Single Question Testing**: Ask individual questions with or without confidence requirements
- **Response Parsing**: Automatically extracts answer (a-e) and confidence level (1-3) from AI responses
- **CBM Scoring**: Calculates confidence-based marking scores using the three-tier system:
  - Level 1 (Low): +1.0 correct, -0.0 incorrect
  - Level 2 (Medium): +1.5 correct, -0.5 incorrect  
  - Level 3 (High): +2.0 correct, -2.0 incorrect
- **Error Handling**: Comprehensive error handling with informative messages

### API Endpoints

#### Test Single Question
```bash
POST /api/ai-testing/test-single-question
Content-Type: application/json

{
  "question": "What do we mean by meaningful play?",
  "options": [
    {"key": "a", "text": "That the rules of the game provide a fair contest"},
    {"key": "b", "text": "That there is an enjoyable outcome from the game"},
    {"key": "c", "text": "That the game has strong narrative content"},
    {"key": "d", "text": "That it is easy to link your actions to consequences"},
    {"key": "e", "text": "That the play results in meaning"}
  ],
  "correctAnswer": "d",
  "includeConfidence": true
}
```

#### Test MCQ Question
```bash
POST /api/ai-testing/test-mcq-question
Content-Type: application/json

{
  "questionId": 1
}
```

## Setup Instructions

### 1. Environment Configuration

Set the XAI API key as an environment variable:

```bash
# For testing
export XAI_API_KEY_CBM=your_xai_api_key_here

# For Windows
set XAI_API_KEY_CBM=your_xai_api_key_here
```

### 2. Install Dependencies

```bash
cd cbm-question-system
npm install
```

### 3. Testing

#### Node.js Test (without server)
```bash
# Set API key and run test
XAI_API_KEY_CBM=your_key_here node test-xai.js
```

#### Python Test (without server)
```bash
# Set API key and run test
XAI_API_KEY_CBM=your_key_here python test-single-question.py
```

#### Full Server Test
```bash
# Start the server (requires database setup)
npm start

# Test endpoints with curl or Postman
curl -X POST http://localhost:3000/api/ai-testing/test-mcq-question \
  -H "Content-Type: application/json" \
  -d '{"questionId": 1}'
```

## Usage Examples

### Basic Question Testing

```javascript
const XAIProvider = require('./src/services/xaiService');

const xai = new XAIProvider();

// Test a question with confidence
const result = await xai.askSingleQuestion(
  "What is the capital of France?",
  [
    {key: "a", text: "London"},
    {key: "b", text: "Berlin"},
    {key: "c", text: "Paris"},
    {key: "d", text: "Madrid"}
  ],
  true  // include confidence
);

console.log(result.answer);           // "c"
console.log(result.confidence_level); // 2
console.log(result.response);         // Raw AI response
```

### CBM Score Calculation

```javascript
// Calculate CBM score
const isCorrect = result.answer.toLowerCase() === "c";
const cbmScore = xai.calculateCBMScore(result.answer, "c", result.confidence_level);

console.log(cbmScore); // 1.5 (if correct with confidence level 2)
```

## Response Format

### Successful Response
```json
{
  "success": true,
  "result": {
    "question": "What do we mean by meaningful play?",
    "response": "Looking at this question about meaningful play...",
    "answer": "d",
    "confidence_level": 2,
    "confidence_description": "Medium (correct +1.5, incorrect -0.5)",
    "processing_time": 1234,
    "provider": "xai",
    "model": "grok-4",
    "is_correct": true,
    "cbm_score": 1.5,
    "correct_answer": "d",
    "timestamp": "2025-08-31T19:51:25.123Z"
  }
}
```

### Error Response
```json
{
  "error": "Failed to test question with XAI",
  "details": "XAI API key not configured. Please set XAI_API_KEY_CBM environment variable."
}
```

## Integration with Existing System

The XAI integration is designed to work seamlessly with the existing CBM system:

1. **LLM Service Integration**: XAI is registered as a provider in the existing LLM service architecture
2. **API Consistency**: Follows the same patterns as other AI providers (OpenAI, Claude, etc.)
3. **CBM Compatibility**: Uses the standard 3-tier confidence scoring system
4. **Database Integration**: Can log requests and responses to the existing database schema
5. **Configuration Management**: Uses the same environment variable pattern as other providers

## Testing and Validation

The implementation includes comprehensive testing:

1. **Unit Tests**: Individual function testing for parsing and scoring
2. **Integration Tests**: End-to-end testing with actual API calls
3. **Error Handling**: Tests for various error conditions
4. **Mock Testing**: Tests that work without requiring API keys

## Future Enhancements

Potential improvements for the XAI integration:

1. **Batch Processing**: Support for asking multiple questions in one request
2. **Advanced Parsing**: More sophisticated response parsing for edge cases
3. **Performance Monitoring**: Detailed metrics on response times and accuracy
4. **Custom Prompting**: Configurable prompts for different question types
5. **Temperature Control**: Support for different temperature settings

## Troubleshooting

### Common Issues

1. **API Key Not Set**: Ensure `XAI_API_KEY_CBM` environment variable is configured
2. **Network Issues**: Check internet connection and XAI API status
3. **Response Parsing**: Some responses may not follow expected format - check raw response
4. **Rate Limiting**: XAI may have rate limits - implement exponential backoff if needed

### Debug Mode

Enable detailed logging by setting:
```bash
export DEBUG=xai:*
```

This integration successfully transforms the original askXAI.py into a robust, testable, and integrated component of the CBM question system.
