const axios = require('axios');
const { getDatabase } = require('../models/database');

class LLMService {
  constructor() {
    this.providers = {
      gemini: new GeminiProvider(),
      claude: new ClaudeProvider(),
      openai: new OpenAIProvider(),
      deepseek: new DeepseekProvider(),
      custom: new CustomProvider()
    };
  }

  async analyzePDFContent(content, options = {}) {
    const provider = this.providers[options.provider || 'gemini'];
    
    if (!provider) {
      throw new Error(`Unsupported LLM provider: ${options.provider}`);
    }

    const prompt = this.buildAnalysisPrompt(content, options);
    
    const startTime = Date.now();
    const response = await provider.makeRequest(prompt, 'analysis');
    const processingTime = Date.now() - startTime;

    await this.logRequest({
      provider: options.provider,
      request_type: 'analysis',
      prompt,
      response: JSON.stringify(response),
      processing_time: processingTime,
      assessment_id: options.assessmentId
    });

    return this.parseAnalysisResponse(response);
  }

  async generateQuestions(content, analysis, options = {}) {
    const provider = this.providers[options.provider || 'gemini'];
    
    const prompt = this.buildQuestionGenerationPrompt(content, analysis, options);
    
    const startTime = Date.now();
    const response = await provider.makeRequest(prompt, 'question_generation');
    const processingTime = Date.now() - startTime;

    await this.logRequest({
      provider: options.provider,
      request_type: 'question_generation',
      prompt,
      response: JSON.stringify(response),
      processing_time: processingTime,
      assessment_id: options.assessmentId
    });

    return this.parseQuestionResponse(response);
  }

  buildAnalysisPrompt(content, options) {
    return `Analyze the following academic content and provide a structured response:

Content: ${content.text.substring(0, 4000)}...

Please provide analysis in the following JSON format:
{
  "summary": "Brief summary of the content",
  "topics": ["topic1", "topic2", "topic3"],
  "complexity_level": 1-10,
  "key_concepts": ["concept1", "concept2"],
  "question_areas": ["area1", "area2"],
  "recommended_difficulty": 1-10
}

Focus on identifying:
1. Main topics and subtopics
2. Key concepts that could be assessed
3. Appropriate complexity level for questions
4. Areas suitable for different question types

Target difficulty level: ${options.difficulty || 5}
Number of questions needed: ${options.questionCount || 10}`;
  }

  buildQuestionGenerationPrompt(content, analysis, options) {
    return `Based on the following content analysis, generate ${options.questionCount || 10} assessment questions:

Content Summary: ${analysis.summary}
Topics: ${analysis.topics.join(', ')}
Complexity Level: ${analysis.complexity_level}

Generate questions in the following JSON format:
{
  "questions": [
    {
      "question_text": "Question text here",
      "question_type": "multiple_choice|true_false|short_answer|essay",
      "options": ["A", "B", "C", "D"], // only for multiple_choice
      "correct_answer": "Correct answer",
      "complexity_level": 1-10,
      "explanation": "Why this answer is correct",
      "confidence_required": true
    }
  ]
}

Requirements:
- Mix of question types (40% multiple choice, 20% true/false, 30% short answer, 10% essay)
- Varying complexity levels around ${options.difficulty || 5}
- Questions should test understanding, not just memorization
- Include confidence-based marking considerations
- Ensure questions are directly related to the content`;
  }

  parseAnalysisResponse(response) {
    try {
      return typeof response === 'string' ? JSON.parse(response) : response;
    } catch (error) {
      return {
        summary: "Content analysis completed",
        topics: ["General"],
        complexity_level: 5,
        key_concepts: [],
        question_areas: [],
        recommended_difficulty: 5
      };
    }
  }

  parseQuestionResponse(response) {
    try {
      const parsed = typeof response === 'string' ? JSON.parse(response) : response;
      return parsed.questions || [];
    } catch (error) {
      return [];
    }
  }

  async logRequest(data) {
    const db = getDatabase();
    
    return new Promise((resolve, reject) => {
      const stmt = db.prepare(`
        INSERT INTO llm_requests (assessment_id, provider, request_type, prompt, response, processing_time, created_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);
      
      stmt.run([
        data.assessment_id || null,
        data.provider,
        data.request_type,
        data.prompt,
        data.response,
        data.processing_time
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
      
      stmt.finalize();
    });
  }
}

class GeminiProvider {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
  }

  async makeRequest(prompt, type) {
    if (!this.apiKey) {
      throw new Error('Gemini API key not configured');
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/models/gemini-pro:generateContent?key=${this.apiKey}`,
        {
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2048
          }
        }
      );

      return response.data.candidates[0].content.parts[0].text;
    } catch (error) {
      throw new Error(`Gemini API error: ${error.response?.data?.error?.message || error.message}`);
    }
  }
}

class ClaudeProvider {
  constructor() {
    this.apiKey = process.env.CLAUDE_API_KEY;
    this.baseUrl = 'https://api.anthropic.com/v1';
  }

  async makeRequest(prompt, type) {
    if (!this.apiKey) {
      throw new Error('Claude API key not configured');
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/messages`,
        {
          model: 'claude-3-sonnet-20240229',
          max_tokens: 2048,
          messages: [{ role: 'user', content: prompt }]
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey
          }
        }
      );

      return response.data.content[0].text;
    } catch (error) {
      throw new Error(`Claude API error: ${error.response?.data?.error?.message || error.message}`);
    }
  }
}

class OpenAIProvider {
  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY;
    this.baseUrl = 'https://api.openai.com/v1';
  }

  async makeRequest(prompt, type) {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 2048,
          temperature: 0.3
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
      throw new Error(`OpenAI API error: ${error.response?.data?.error?.message || error.message}`);
    }
  }
}

class DeepseekProvider {
  constructor() {
    this.apiKey = process.env.DEEPSEEK_API_KEY;
    this.baseUrl = 'https://api.deepseek.com/v1';
  }

  async makeRequest(prompt, type) {
    if (!this.apiKey) {
      throw new Error('Deepseek API key not configured');
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 2048,
          temperature: 0.3
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
      throw new Error(`Deepseek API error: ${error.response?.data?.error?.message || error.message}`);
    }
  }
}

class CustomProvider {
  constructor() {
    this.apiKey = process.env.CUSTOM_LLM_API_KEY;
    this.baseUrl = process.env.CUSTOM_LLM_URL;
  }

  async makeRequest(prompt, type) {
    if (!this.baseUrl) {
      throw new Error('Custom LLM URL not configured');
    }

    try {
      const headers = {
        'Content-Type': 'application/json'
      };

      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: 'custom-model',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 2048,
          temperature: 0.3
        },
        { headers }
      );

      return response.data.choices[0].message.content;
    } catch (error) {
      throw new Error(`Custom LLM API error: ${error.response?.data?.error?.message || error.message}`);
    }
  }
}

const llmService = new LLMService();

async function analyzePDFContent(content, options = {}) {
  return llmService.analyzePDFContent(content, options);
}

async function generateQuestions(content, analysis, options = {}) {
  return llmService.generateQuestions(content, analysis, options);
}

module.exports = {
  LLMService,
  analyzePDFContent,
  generateQuestions
};