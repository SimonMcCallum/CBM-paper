/**
 * Type definitions for course system
 */

import { BloomLevel } from './index';

// ============================================================================
// Course Types
// ============================================================================

export interface Course {
  id: string;
  code: string; // e.g., "CS101"
  name: string;
  description?: string;
  semester?: string;
  instructor?: string;

  // Mock mode flag
  is_mock: boolean;
  lti_context_id?: string;

  // Status
  active: boolean;

  created_at: Date;
  updated_at: Date;
}

export interface CourseOverview extends Course {
  material_count: number;
  submission_count: number;
  question_count: number;
  processed_materials: number;
}

// ============================================================================
// Course Material Types
// ============================================================================

export type MaterialType = 'lecture_notes' | 'textbook_chapter' | 'article' | 'slides' | 'reference' | 'other';
export type ProcessingStatus = 'pending' | 'processing' | 'ready' | 'error';

export interface CourseMaterial {
  id: string;
  course_id: string;

  // Metadata
  title: string;
  description?: string;
  material_type: MaterialType;

  // File info
  original_filename: string;
  stored_filename: string;
  file_type: string;
  file_size: number;

  // Processed content
  extracted_text?: string;
  summary?: string;

  // Embeddings for novelty comparison
  embedding_chunks?: EmbeddingChunk[];

  // Ordering
  display_order: number;
  visible: boolean;

  // Processing
  processing_status: ProcessingStatus;
  error_message?: string;

  created_at: Date;
  updated_at: Date;
}

export interface EmbeddingChunk {
  text: string;
  embedding: number[];
  chunk_index: number;
}

// ============================================================================
// Novelty Detection Configuration
// ============================================================================

export interface NoveltyDetectionConfig {
  id: string;
  course_id: string;

  // Chunking parameters
  chunk_size: number;
  chunk_overlap: number;

  // Similarity thresholds
  novelty_threshold_high: number; // > this = novel
  novelty_threshold_low: number;  // < this = standard

  // Embedding model
  embedding_model: string;

  // LLM for semantic prompts
  llm_provider: string;
  llm_model?: string;
  llm_temperature: number;

  // Comparison strategy
  compare_to_materials: boolean;
  compare_to_past_submissions: boolean;

  // K-nearest neighbors
  k_neighbors: number;

  created_at: Date;
  updated_at: Date;
}

// ============================================================================
// Question Generation Configuration
// ============================================================================

export interface QuestionGenerationConfig {
  id: string;
  course_id: string;

  // Question counts
  standard_questions_count: number;
  novel_questions_count: number;
  oral_questions_count: number;

  // Selection parameters
  min_similarity_threshold: number;
  diversity_weight: number;

  // Bloom distribution
  bloom_distribution_standard: Record<BloomLevel, number>;
  bloom_levels_novel: BloomLevel[];
  bloom_levels_oral: BloomLevel[];

  // LLM configuration
  llm_provider: string;
  llm_model?: string;
  llm_temperature: number;

  // Quality settings
  require_explanation: boolean;
  generate_distractors: boolean;
  distractor_count: number;

  created_at: Date;
  updated_at: Date;
}

// ============================================================================
// Material Processing Status View
// ============================================================================

export interface MaterialProcessingStatus {
  course_id: string;
  course_code: string;
  material_type: MaterialType;
  total: number;
  ready: number;
  processing: number;
  pending: number;
  errors: number;
}

// ============================================================================
// Request/Response Types
// ============================================================================

export interface CreateCourseRequest {
  code: string;
  name: string;
  description?: string;
  semester?: string;
  instructor?: string;
}

export interface UpdateCourseRequest {
  code?: string;
  name?: string;
  description?: string;
  semester?: string;
  instructor?: string;
  active?: boolean;
}

export interface UploadCourseMaterialRequest {
  title: string;
  description?: string;
  material_type: MaterialType;
  display_order?: number;
  visible?: boolean;
}

export interface UpdateNoveltyConfigRequest {
  chunk_size?: number;
  chunk_overlap?: number;
  novelty_threshold_high?: number;
  novelty_threshold_low?: number;
  embedding_model?: string;
  llm_provider?: string;
  llm_model?: string;
  llm_temperature?: number;
  compare_to_materials?: boolean;
  compare_to_past_submissions?: boolean;
  k_neighbors?: number;
}

export interface UpdateQuestionConfigRequest {
  standard_questions_count?: number;
  novel_questions_count?: number;
  oral_questions_count?: number;
  min_similarity_threshold?: number;
  diversity_weight?: number;
  bloom_distribution_standard?: Record<BloomLevel, number>;
  bloom_levels_novel?: BloomLevel[];
  bloom_levels_oral?: BloomLevel[];
  llm_provider?: string;
  llm_model?: string;
  llm_temperature?: number;
  require_explanation?: boolean;
  generate_distractors?: boolean;
  distractor_count?: number;
}
