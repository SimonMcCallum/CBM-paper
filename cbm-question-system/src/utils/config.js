require('dotenv').config();

const config = {
  server: {
    port: parseInt(process.env.PORT) || 3000,
    env: process.env.NODE_ENV || 'development'
  },
  
  database: {
    path: process.env.DATABASE_PATH || './database/cbm_system.db'
  },
  
  llm: {
    defaultProvider: process.env.DEFAULT_LLM_PROVIDER || 'gemini',
    providers: {
      gemini: {
        apiKey: process.env.GEMINI_API_KEY,
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta'
      },
      claude: {
        apiKey: process.env.CLAUDE_API_KEY,
        baseUrl: 'https://api.anthropic.com/v1'
      },
      openai: {
        apiKey: process.env.OPENAI_API_KEY,
        baseUrl: 'https://api.openai.com/v1'
      },
      deepseek: {
        apiKey: process.env.DEEPSEEK_API_KEY,
        baseUrl: 'https://api.deepseek.com/v1'
      },
      custom: {
        apiKey: process.env.CUSTOM_LLM_API_KEY,
        baseUrl: process.env.CUSTOM_LLM_URL
      }
    }
  },
  
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760, // 10MB
    allowedTypes: (process.env.ALLOWED_FILE_TYPES || 'pdf').split(','),
    uploadDir: './uploads'
  },
  
  assessment: {
    defaultComplexity: parseInt(process.env.DEFAULT_COMPLEXITY_LEVEL) || 5,
    minQuestions: parseInt(process.env.MIN_QUESTIONS_PER_ASSESSMENT) || 5,
    maxQuestions: parseInt(process.env.MAX_QUESTIONS_PER_ASSESSMENT) || 20
  },
  
  cbm: {
    defaultRules: [
      { confidence: 1, correct: 0.2, incorrect: -0.1, description: "Very Low Confidence" },
      { confidence: 2, correct: 0.4, incorrect: -0.2, description: "Low Confidence" },
      { confidence: 3, correct: 0.6, incorrect: -0.4, description: "Medium Confidence" },
      { confidence: 4, correct: 0.8, incorrect: -0.6, description: "High Confidence" },
      { confidence: 5, correct: 1.0, incorrect: -1.0, description: "Very High Confidence" }
    ]
  }
};

function validateConfig() {
  const errors = [];
  
  if (!config.llm.providers[config.llm.defaultProvider]?.apiKey) {
    errors.push(`API key missing for default LLM provider: ${config.llm.defaultProvider}`);
  }
  
  if (config.upload.maxFileSize <= 0) {
    errors.push('MAX_FILE_SIZE must be greater than 0');
  }
  
  if (config.assessment.minQuestions > config.assessment.maxQuestions) {
    errors.push('MIN_QUESTIONS_PER_ASSESSMENT cannot be greater than MAX_QUESTIONS_PER_ASSESSMENT');
  }
  
  return errors;
}

function getProviderConfig(provider) {
  return config.llm.providers[provider];
}

function isProviderConfigured(provider) {
  const providerConfig = config.llm.providers[provider];
  return providerConfig && providerConfig.apiKey;
}

function getAvailableProviders() {
  return Object.keys(config.llm.providers).filter(provider => 
    isProviderConfigured(provider)
  );
}

module.exports = {
  config,
  validateConfig,
  getProviderConfig,
  isProviderConfigured,
  getAvailableProviders
};