/**
 * Configuration loader and validator
 */

import dotenv from 'dotenv';
import path from 'path';
import { SystemConfig, CBMScoringRule, LLMProvider } from '../types';

// Load environment variables
dotenv.config();

/**
 * Load configuration from environment variables
 */
function loadConfig(): SystemConfig {
  // Server configuration
  const server = {
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || 'localhost',
    nodeEnv: process.env.NODE_ENV || 'development',
  };

  // Database configuration
  const database = {
    type: (process.env.DB_TYPE || 'sqlite') as 'sqlite' | 'postgresql',
    path: process.env.DB_PATH || path.join(__dirname, '../../data/cbm_assessment.db'),
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : undefined,
    name: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    poolSize: process.env.DB_POOL_SIZE ? parseInt(process.env.DB_POOL_SIZE, 10) : 20,
  };

  // LTI configuration
  const lti = {
    key: process.env.LTI_KEY || 'cbm-assessment-tool',
    issuer: process.env.LTI_ISSUER || 'https://canvas.instructure.com',
    toolUrl: process.env.LTI_TOOL_URL || 'http://localhost:3000/lti',
    deepLinkingUrl: process.env.LTI_DEEP_LINKING_URL || 'http://localhost:3000/lti/deep-link',
    publicKeyPath: process.env.LTI_PUBLIC_KEY_PATH || path.join(__dirname, '../../secrets/lti_public_key.pem'),
    privateKeyPath: process.env.LTI_PRIVATE_KEY_PATH || path.join(__dirname, '../../secrets/lti_private_key.pem'),
  };

  // Upload configuration
  const upload = {
    dir: process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads'),
    maxFileSizeMB: parseInt(process.env.MAX_FILE_SIZE_MB || '50', 10),
    allowedFileTypes: (process.env.ALLOWED_FILE_TYPES || 'pdf').split(','),
  };

  // Novelty detector configuration
  const noveltyDetector = {
    url: process.env.NOVELTY_DETECTOR_URL || 'http://localhost:5000',
    thresholdHigh: parseFloat(process.env.NOVELTY_THRESHOLD_HIGH || '0.7'),
    thresholdLow: parseFloat(process.env.NOVELTY_THRESHOLD_LOW || '0.4'),
  };

  // Embeddings configuration
  const embeddings = {
    model: process.env.EMBEDDING_MODEL || 'sentence-transformers/all-MiniLM-L6-v2',
    dimension: parseInt(process.env.EMBEDDING_DIMENSION || '384', 10),
    vectorStore: (process.env.VECTOR_STORE || 'faiss') as 'faiss' | 'pgvector',
  };

  // Question selection configuration
  const questionSelection = {
    standardContent: {
      questionsPerSubmission: parseInt(process.env.STANDARD_QUESTIONS_COUNT || '15', 10),
      minSimilarity: parseFloat(process.env.MIN_SIMILARITY_THRESHOLD || '0.6'),
      diversityWeight: 0.3,
      bloomDistribution: {
        remember: 0.2,
        understand: 0.3,
        apply: 0.3,
        analyze: 0.2,
        evaluate: 0.0,
        create: 0.0,
      },
    },
    novelContent: {
      questionsPerSubmission: parseInt(process.env.NOVEL_QUESTIONS_COUNT || '10', 10),
      questionsPerChunk: 2,
      targetBloomLevels: ['understand', 'analyze', 'evaluate'] as any[],
    },
    oralAssessment: {
      questionsPerSubmission: parseInt(process.env.ORAL_QUESTIONS_COUNT || '8', 10),
      targetBloomLevels: ['analyze', 'evaluate', 'create'] as any[],
    },
  };

  // LLM configuration
  const llmProvider = (process.env.LLM_PROVIDER || 'claude') as LLMProvider;

  const llm = {
    provider: llmProvider,
    model: getLLMModel(llmProvider),
    maxTokens: getLLMMaxTokens(llmProvider),
    temperature: getLLMTemperature(llmProvider),
    apiKey: getLLMApiKey(llmProvider),
    endpoint: llmProvider === 'local' ? process.env.LOCAL_LLM_ENDPOINT : undefined,
  };

  // CBM scoring rules
  const cbmScoring: CBMScoringRule[] = [
    {
      id: 'cbm-5',
      rule_name: 'default',
      confidence_level: 5,
      correct_score: parseFloat(process.env.CBM_CONFIDENCE_5_CORRECT || '2.0'),
      incorrect_score: parseFloat(process.env.CBM_CONFIDENCE_5_INCORRECT || '-2.0'),
      active: true,
    },
    {
      id: 'cbm-4',
      rule_name: 'default',
      confidence_level: 4,
      correct_score: parseFloat(process.env.CBM_CONFIDENCE_4_CORRECT || '1.5'),
      incorrect_score: parseFloat(process.env.CBM_CONFIDENCE_4_INCORRECT || '-1.5'),
      active: true,
    },
    {
      id: 'cbm-3',
      rule_name: 'default',
      confidence_level: 3,
      correct_score: parseFloat(process.env.CBM_CONFIDENCE_3_CORRECT || '1.0'),
      incorrect_score: parseFloat(process.env.CBM_CONFIDENCE_3_INCORRECT || '-1.0'),
      active: true,
    },
    {
      id: 'cbm-2',
      rule_name: 'default',
      confidence_level: 2,
      correct_score: parseFloat(process.env.CBM_CONFIDENCE_2_CORRECT || '0.5'),
      incorrect_score: parseFloat(process.env.CBM_CONFIDENCE_2_INCORRECT || '-0.5'),
      active: true,
    },
    {
      id: 'cbm-1',
      rule_name: 'default',
      confidence_level: 1,
      correct_score: parseFloat(process.env.CBM_CONFIDENCE_1_CORRECT || '0.0'),
      incorrect_score: parseFloat(process.env.CBM_CONFIDENCE_1_INCORRECT || '0.0'),
      active: true,
    },
  ];

  // Export configuration
  const exports = {
    dir: process.env.EXPORT_DIR || path.join(__dirname, '../../exports'),
    formats: (process.env.EXPORT_FORMATS || 'csv,xlsx,pdf').split(',') as any[],
    includePII: process.env.EXPORT_INCLUDE_PII === 'true',
    retentionDays: parseInt(process.env.EXPORT_RETENTION_DAYS || '365', 10),
  };

  // Security configuration
  const security = {
    jwtSecret: process.env.JWT_SECRET || 'change-in-production',
    sessionSecret: process.env.SESSION_SECRET || 'change-in-production',
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '10', 10),
  };

  // Logging configuration
  const logging = {
    level: process.env.LOG_LEVEL || 'info',
    dir: process.env.LOG_DIR || path.join(__dirname, '../../logs'),
  };

  return {
    server,
    database,
    lti,
    upload,
    noveltyDetector,
    embeddings,
    questionSelection,
    llm,
    cbmScoring,
    exports,
    security,
    logging,
  };
}

/**
 * Helper functions to get LLM-specific configuration
 */
function getLLMModel(provider: LLMProvider): string {
  switch (provider) {
    case 'claude':
      return process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929';
    case 'gemini':
      return process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp';
    case 'gpt':
      return process.env.GPT_MODEL || 'gpt-4';
    case 'local':
      return process.env.LOCAL_LLM_MODEL || 'llama3';
    default:
      return 'claude-sonnet-4-5-20250929';
  }
}

function getLLMMaxTokens(provider: LLMProvider): number {
  switch (provider) {
    case 'claude':
      return parseInt(process.env.CLAUDE_MAX_TOKENS || '4096', 10);
    case 'gemini':
      return 8192; // Gemini default
    case 'gpt':
      return 4096;
    case 'local':
      return 4096;
    default:
      return 4096;
  }
}

function getLLMTemperature(provider: LLMProvider): number {
  switch (provider) {
    case 'claude':
      return parseFloat(process.env.CLAUDE_TEMPERATURE || '0.7');
    case 'gemini':
      return parseFloat(process.env.GEMINI_TEMPERATURE || '0.7');
    case 'gpt':
      return parseFloat(process.env.GPT_TEMPERATURE || '0.7');
    case 'local':
      return parseFloat(process.env.LOCAL_LLM_TEMPERATURE || '0.7');
    default:
      return 0.7;
  }
}

function getLLMApiKey(provider: LLMProvider): string | undefined {
  switch (provider) {
    case 'claude':
      return process.env.ANTHROPIC_API_KEY;
    case 'gemini':
      return process.env.GOOGLE_API_KEY;
    case 'gpt':
      return process.env.OPENAI_API_KEY;
    case 'local':
      return undefined; // No API key needed for local
    default:
      return undefined;
  }
}

/**
 * Validate configuration
 */
function validateConfig(config: SystemConfig): void {
  const errors: string[] = [];

  // Validate LLM API key
  if (config.llm.provider !== 'local' && !config.llm.apiKey) {
    errors.push(`Missing API key for LLM provider: ${config.llm.provider}`);
  }

  // Validate database configuration
  if (config.database.type === 'postgresql') {
    if (!config.database.host || !config.database.name || !config.database.user || !config.database.password) {
      errors.push('Incomplete PostgreSQL configuration');
    }
  }

  // Validate security secrets in production
  if (config.server.nodeEnv === 'production') {
    if (config.security.jwtSecret === 'change-in-production') {
      errors.push('JWT_SECRET must be changed in production');
    }
    if (config.security.sessionSecret === 'change-in-production') {
      errors.push('SESSION_SECRET must be changed in production');
    }
  }

  // Validate CBM scoring rules
  const confidenceLevels = config.cbmScoring.map(r => r.confidence_level);
  const expectedLevels = [1, 2, 3, 4, 5];
  const missingLevels = expectedLevels.filter(l => !confidenceLevels.includes(l));
  if (missingLevels.length > 0) {
    errors.push(`Missing CBM scoring rules for confidence levels: ${missingLevels.join(', ')}`);
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}

// Load and validate configuration
const config = loadConfig();
validateConfig(config);

export default config;
export { loadConfig, validateConfig };
