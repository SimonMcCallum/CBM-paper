const axios = require('axios');

class XAIProvider {
  constructor() {
    this.apiKey = process.env.XAI_API_KEY_CBM;
    this.baseUrl = 'https://api.x.ai/v1';
  }

  async makeRequest(prompt, temperature = 0.3) {
    if (!this.apiKey) {
      throw new Error('XAI API key not configured. Please set XAI_API_KEY_CBM environment variable.');
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: 'grok-4',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 1024,
          temperature: temperature
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.choices[0].message.content;
    } catch (error) {
      throw new Error(`XAI API error: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  async askSingleQuestion(question, options = [], includeConfidence = true) {
    // Build the question text with options
    let questionText = question;
    
    if (options && options.length > 0) {
      questionText += '\n';
      options.forEach(option => {
        questionText += `${option.key.toUpperCase()}. ${option.text}\n`;
      });
    }

    // Build the prompt based on whether confidence is required
    let prompt;
    if (includeConfidence) {
      prompt = `This MCQ system needs an answer from a-e and a confidence which changes the marking system options are 1. <correct +1.0, incorrect -0.0> ; 2. <+1.5, -0.5> and 3. <+2.0,-2.0>.

Question: ${questionText}

Provide the answer and a number for your confidence level. ie something like a,3`;
    } else {
      prompt = `Question: ${questionText}

Please provide your answer as a single letter (a-e).`;
    }

    const startTime = Date.now();
    const response = await this.makeRequest(prompt);
    const processingTime = Date.now() - startTime;

    // Parse the response to extract answer and confidence
    const parsed = this.parseResponse(response, includeConfidence);

    return {
      question: questionText,
      response: response,
      answer: parsed.answer,
      confidence_level: parsed.confidence,
      confidence_description: this.getConfidenceDescription(parsed.confidence),
      processing_time: processingTime,
      provider: 'xai',
      model: 'grok-4'
    };
  }

  parseResponse(response, includeConfidence) {
    const result = {
      answer: null,
      confidence: null
    };

    // Clean and normalize the response
    const cleanResponse = response.toLowerCase().trim();
    
    // Try to extract answer (single letter a-e)
    const answerMatch = cleanResponse.match(/\b([a-e])\b/);
    if (answerMatch) {
      result.answer = answerMatch[1];
    }

    if (includeConfidence) {
      // Try to extract confidence level (1-3)
      const confidenceMatch = cleanResponse.match(/\b([1-3])\b/);
      if (confidenceMatch) {
        result.confidence = parseInt(confidenceMatch[1]);
      }
    }

    return result;
  }

  getConfidenceDescription(confidence) {
    switch(confidence) {
      case 1:
        return 'Low (correct +1.0, incorrect -0.0)';
      case 2:
        return 'Medium (correct +1.5, incorrect -0.5)';
      case 3:
        return 'High (correct +2.0, incorrect -2.0)';
      default:
        return 'Unknown';
    }
  }

  calculateCBMScore(answer, correctAnswer, confidence) {
    const isCorrect = answer && answer.toLowerCase() === correctAnswer.toLowerCase();
    
    switch(confidence) {
      case 1:
        return isCorrect ? 1.0 : 0.0;
      case 2:
        return isCorrect ? 1.5 : -0.5;
      case 3:
        return isCorrect ? 2.0 : -2.0;
      default:
        return 0.0;
    }
  }
}

module.exports = XAIProvider;
