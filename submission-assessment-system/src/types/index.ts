/**
 * Core type definitions for CBM Submission Assessment System
 */

// ============================================================================
// LTI Types
// ============================================================================

export interface LTIPlatform {
  id: string;
  platform_url: string;
  client_id: string;
  deployment_id?: string;
  public_key: string;
  auth_endpoint: string;
  token_endpoint: string;
  created_at: Date;
}

export interface LTILaunch {
  id: string;
  platform_id: string;
  user_id: string;
  context_id?: string;
  resource_link_id?: string;
  roles: string[];
  launch_data: Record<string, any>;
  created_at: Date;
}

// ============================================================================
// Submission Types
// ============================================================================

export type SubmissionStatus = 'uploaded' | 'analyzing' | 'ready' | 'completed' | 'error';

export interface Submission {
  id: string;
  lti_launch_id: string;
  student_id: string;
  course_id: string;
  assignment_id: string;

  // File data
  original_filename: string;
  stored_filename: string;
  file_type: string;
  file_size: number;

  // Processing status
  status: SubmissionStatus;
  error_message?: string;

  // Novelty analysis results
  novelty_scores?: NoveltyScore[];
  novel_sections?: ContentChunk[];
  standard_sections?: ContentChunk[];

  // Content analysis
  extracted_text?: string;
  content_summary?: string;
  topics?: string[];
  complexity_analysis?: ComplexityAnalysis;

  // Embeddings
  embedding_ids?: string[];

  created_at: Date;
  analyzed_at?: Date;
  completed_at?: Date;
}

export interface NoveltyScore {
  chunk_index: number;
  novelty_score: number; // 0.0-1.0
  avg_similarity: number;
  similar_chunks: Array<{
    index: number;
    similarity: number;
  }>;
  text_preview: string;
}

export interface ContentChunk {
  chunk_index: number;
  text: string;
  word_start: number;
  word_end: number;
  char_start: number;
  char_end: number;
  word_count: number;
  novelty_score?: number;
  embedding?: number[];
}

export interface ComplexityAnalysis {
  overall_level: number; // 1-10
  bloom_level: BloomLevel;
  readability_score?: number;
  technical_depth?: number;
}

export type BloomLevel = 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create';

// ============================================================================
// Question Bank Types
// ============================================================================

export type QuestionType = 'multiple_choice' | 'true_false' | 'short_answer';
export type QuestionSource = 'qti_import' | 'manual' | 'llm_generated';

export interface QuestionBank {
  id: string;

  // Question content
  question_text: string;
  question_type: QuestionType;
  correct_answer: string;
  options?: string[]; // For MCQs
  explanation?: string;

  // Metadata
  topic?: string;
  subtopic?: string;
  keywords?: string[];
  bloom_level: BloomLevel;
  complexity_level: number; // 1-10

  // Source tracking
  source: QuestionSource;
  source_reference?: string;
  created_by?: string;

  // Embeddings for RAG
  embedding_vector?: number[];

  // Usage statistics
  times_used: number;
  avg_correct_rate?: number;
  avg_confidence?: number;

  created_at: Date;
  updated_at: Date;
}

// ============================================================================
// Assessment Question Types
// ============================================================================

export type QuestionCategory = 'standard' | 'novel' | 'oral';

export interface AssessmentQuestion {
  id: string;
  submission_id: string;

  // Question source
  question_source: QuestionSource | 'llm_generated_novel' | 'llm_generated_oral';
  question_bank_id?: string;

  // Question content
  question_text: string;
  question_type: QuestionType;
  correct_answer: string;
  options?: string[];

  // Context
  related_content?: string;
  novelty_score?: number;
  question_category: QuestionCategory;

  // Assessment parameters
  requires_confidence: boolean;
  points_possible: number;
  bloom_level: BloomLevel;
  complexity_level: number;

  // Ordering
  display_order: number;

  created_at: Date;
}

// ============================================================================
// Student Response Types
// ============================================================================

export interface StudentResponse {
  id: string;
  submission_id: string;
  question_id: string;
  student_id: string;

  // Response data
  answer: string;
  confidence_level: number; // 1-5
  confidence_reasoning?: string;

  // Scoring
  is_correct: boolean;
  cbm_score: number;
  points_earned: number;

  // Timing
  time_spent_seconds?: number;
  submitted_at: Date;
}

// ============================================================================
// CBM Scoring Types
// ============================================================================

export interface CBMScoringRule {
  id: string;
  rule_name: string;
  confidence_level: number; // 1-5
  correct_score: number;
  incorrect_score: number;
  active: boolean;
}

export interface CBMScoreCalculation {
  response: StudentResponse;
  rule_applied: CBMScoringRule;
  points_earned: number;
  max_possible: number;
}

// ============================================================================
// Oral Assessment Types
// ============================================================================

export interface OralAssessmentQuestion {
  id: string;
  submission_id: string;

  question_text: string;
  question_purpose: string;
  related_section?: string;
  expected_key_points?: string[];
  bloom_level: BloomLevel;

  display_order: number;
  created_at: Date;
}

// ============================================================================
// LLM Request Tracking Types
// ============================================================================

export type LLMProvider = 'claude' | 'gemini' | 'gpt' | 'local';
export type LLMRequestType = 'novelty_analysis' | 'question_generation' | 'oral_questions' | 'content_analysis';

export interface LLMRequest {
  id: string;
  submission_id?: string;

  provider: LLMProvider;
  model: string;
  request_type: LLMRequestType;

  prompt: string;
  response: string;

  tokens_used?: number;
  estimated_cost?: number;
  processing_time_ms: number;

  created_at: Date;
}

// ============================================================================
// Export Types
// ============================================================================

export type ExportType = 'novelty_report' | 'oral_questions' | 'detailed_scores' | 'summary';
export type ExportFormat = 'csv' | 'xlsx' | 'pdf';

export interface ExportLog {
  id: string;
  exported_by: string;
  export_type: ExportType;
  submission_ids: string[];
  course_id?: string;

  file_format: ExportFormat;
  file_path: string;

  created_at: Date;
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface QuestionSelectionConfig {
  standardContent: {
    questionsPerSubmission: number;
    minSimilarity: number;
    diversityWeight: number;
    bloomDistribution: Record<BloomLevel, number>;
  };
  novelContent: {
    questionsPerSubmission: number;
    questionsPerChunk: number;
    targetBloomLevels: BloomLevel[];
  };
  oralAssessment: {
    questionsPerSubmission: number;
    targetBloomLevels: BloomLevel[];
  };
}

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  maxTokens: number;
  temperature: number;
  apiKey?: string;
  endpoint?: string;
}

export interface SystemConfig {
  server: {
    port: number;
    host: string;
    nodeEnv: string;
  };
  database: {
    type: 'sqlite' | 'postgresql';
    path?: string;
    host?: string;
    port?: number;
    name?: string;
    user?: string;
    password?: string;
    poolSize?: number;
  };
  lti: {
    key: string;
    issuer: string;
    toolUrl: string;
    deepLinkingUrl: string;
    publicKeyPath: string;
    privateKeyPath: string;
  };
  upload: {
    dir: string;
    maxFileSizeMB: number;
    allowedFileTypes: string[];
  };
  noveltyDetector: {
    url: string;
    thresholdHigh: number;
    thresholdLow: number;
  };
  embeddings: {
    model: string;
    dimension: number;
    vectorStore: 'faiss' | 'pgvector';
  };
  questionSelection: QuestionSelectionConfig;
  llm: LLMConfig;
  cbmScoring: CBMScoringRule[];
  exports: {
    dir: string;
    formats: ExportFormat[];
    includePII: boolean;
    retentionDays: number;
  };
  security: {
    jwtSecret: string;
    sessionSecret: string;
    bcryptRounds: number;
  };
  logging: {
    level: string;
    dir: string;
  };
}

// ============================================================================
// API Response Types
// ============================================================================

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    timestamp: string;
    version: string;
  };
}

export interface PaginatedResponse<T> extends APIResponse<T[]> {
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

// ============================================================================
// Service Response Types
// ============================================================================

export interface NoveltyDetectorResponse {
  chunks: ContentChunk[];
  novelty_scores: NoveltyScore[];
  annotated_pdf_path?: string;
  summary: {
    total_chunks: number;
    novel_chunks: number;
    avg_novelty: number;
    max_novelty: number;
  };
}

export interface QuestionGenerationResponse {
  questions: AssessmentQuestion[];
  llm_requests: LLMRequest[];
  quality_metrics?: {
    avg_complexity: number;
    bloom_distribution: Record<BloomLevel, number>;
  };
}

export interface AssessmentResult {
  submission: Submission;
  questions: AssessmentQuestion[];
  responses: StudentResponse[];
  score: {
    total_points: number;
    max_possible: number;
    percentage: number;
    cbm_adjusted_score: number;
  };
  confidence_analysis: {
    avg_confidence: number;
    calibration_score: number; // How well confidence matches correctness
    overconfident_count: number;
    underconfident_count: number;
  };
}
