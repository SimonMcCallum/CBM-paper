/**
 * Core type definitions for CBM LTI Plugin.
 */

// ── Tool Modes ──

export type ToolMode = 'quiz_runner' | 'submission_validator';
export type ScoringModel = 'hlcc' | 'discrete_cbm';
export type TimingMode = 'immediate' | 'deadline' | 'tutorial';
export type SessionStatus = 'active' | 'submitted' | 'expired';
export type SubmissionStatus = 'uploaded' | 'analyzing' | 'ready' | 'completed' | 'error';
export type DeferredStatus = 'pending' | 'available' | 'in_progress' | 'submitted' | 'expired';
export type QuestionSource = 'bank' | 'generated' | 'oral' | 'imported';
export type QuestionCategory = 'standard' | 'novel' | 'oral';

// ── Assignment Config ──

export interface AssignmentConfig {
  id: string;
  course_id: string;
  assignment_id: string;
  tool_mode: ToolMode;
  title: string;

  // Quiz Runner
  qti_json?: string;
  question_count?: number;

  // Submission Validator
  timing_mode: TimingMode;
  deadline_hours?: number;
  mcq_count: number;
  oral_count: number;

  // Scoring
  scoring_model: ScoringModel;
  confidence_levels: number;
  max_grade_multiplier: number;

  // LTI
  line_item_url?: string;
  platform_id?: string;
  created_by?: string;
}

// ── Questions ──

export interface QuestionOption {
  id: string;
  text: string;
}

export interface Question {
  id: string;
  question_text: string;
  question_type: string;
  options: QuestionOption[];
  correct_answer: string;
  explanation?: string;
  topic?: string;
  subtopic?: string;
  keywords?: string[];
  complexity_level?: number;
  source?: QuestionSource;
}

export interface AssessmentQuestion extends Question {
  question_order: number;
  category: QuestionCategory;
  is_oral: boolean;
  question_bank_id?: string;
  quiz_session_id?: string;
  submission_id?: string;
}

// ── Quiz Session (System 1) ──

export interface QuizSession {
  id: string;
  assignment_config_id: string;
  student_id: string;
  student_name?: string;
  course_id: string;
  status: SessionStatus;
  questions_json: string;
  started_at: string;
  submitted_at?: string;
  raw_score?: number;
  max_possible?: number;
  normalized_score?: number;
  grade_submitted: boolean;
}

// ── Submission (System 2) ──

export interface Submission {
  id: string;
  assignment_config_id: string;
  student_id: string;
  student_name?: string;
  course_id: string;
  original_filename: string;
  stored_path: string;
  file_size?: number;
  word_count?: number;
  status: SubmissionStatus;
  error_message?: string;
  chunk_count?: number;
  matched_question_count?: number;
  generated_question_count?: number;
}

// ── Student Response ──

export interface StudentResponse {
  id: string;
  assessment_question_id: string;
  student_id: string;
  selected_answer: string;
  is_correct: boolean;
  confidence_level: number;
  cbm_score: number;
  time_spent_seconds?: number;
}

// ── Scoring ──

export interface ScoringRule {
  confidence_level: number;
  correct_score: number;
  incorrect_score: number;
  label: string;
}

export interface ScoreResult {
  question_id: string;
  is_correct: boolean;
  confidence_level: number;
  cbm_score: number;
}

export interface AssessmentResult {
  scores: ScoreResult[];
  raw_total: number;
  max_possible: number;
  normalized: number;       // 0-100 for Canvas
  num_correct: number;
  num_questions: number;
  avg_confidence: number;
}

// ── Deferred Assessment (System 2 timing) ──

export interface DeferredAssessment {
  id: string;
  submission_id: string;
  student_id: string;
  course_id: string;
  timing_mode: TimingMode;
  available_at?: string;
  deadline_at?: string;
  status: DeferredStatus;
  raw_score?: number;
  max_possible?: number;
  normalized_score?: number;
  grade_submitted: boolean;
}

// ── QTI Parsing ──

export interface QTIQuestion {
  qti_identifier: string;
  question_text: string;
  question_type: string;
  options: QuestionOption[];
  correct_answer: string;
  explanation?: string;
  topic?: string;
  complexity_level?: number;
  keywords?: string[];
  metadata?: Record<string, unknown>;
}

// ── Python Sidecar API ──

export interface EmbeddingSearchResult {
  question_id: string;
  similarity: number;
}

export interface GeneratedMCQ {
  question_text: string;
  options: QuestionOption[];
  correct_answer: string;
  explanation: string;
  source_chunk: string;
  topic: string;
}

export interface OralQuestion {
  question_text: string;
  expected_answer_points: string[];
  topic: string;
  difficulty: string;
}

// ── API Responses ──

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
