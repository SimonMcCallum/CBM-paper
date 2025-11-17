-- CBM Submission Assessment System - Initial Schema
-- Migration 001: Create all tables

-- ============================================================================
-- LTI Tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS lti_platforms (
  id TEXT PRIMARY KEY,
  platform_url TEXT NOT NULL,
  client_id TEXT NOT NULL,
  deployment_id TEXT,
  public_key TEXT NOT NULL,
  auth_endpoint TEXT NOT NULL,
  token_endpoint TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lti_launches (
  id TEXT PRIMARY KEY,
  platform_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  context_id TEXT,
  resource_link_id TEXT,
  roles TEXT, -- JSON array stored as TEXT
  launch_data TEXT, -- JSON stored as TEXT
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (platform_id) REFERENCES lti_platforms(id) ON DELETE CASCADE
);

-- ============================================================================
-- Submission Tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  lti_launch_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  assignment_id TEXT NOT NULL,

  -- File data
  original_filename TEXT NOT NULL,
  stored_filename TEXT NOT NULL,
  file_type TEXT DEFAULT 'pdf',
  file_size INTEGER,

  -- Processing status
  status TEXT DEFAULT 'uploaded', -- uploaded, analyzing, ready, completed, error
  error_message TEXT,

  -- Novelty analysis results (stored as JSON TEXT)
  novelty_scores TEXT, -- JSON array
  novel_sections TEXT, -- JSON array
  standard_sections TEXT, -- JSON array

  -- Content analysis
  extracted_text TEXT,
  content_summary TEXT,
  topics TEXT, -- JSON array
  complexity_analysis TEXT, -- JSON object

  -- Embeddings stored separately for RAG
  embedding_ids TEXT, -- JSON array of references

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  analyzed_at TIMESTAMP,
  completed_at TIMESTAMP,

  FOREIGN KEY (lti_launch_id) REFERENCES lti_launches(id) ON DELETE CASCADE
);

CREATE INDEX idx_submissions_student ON submissions(student_id);
CREATE INDEX idx_submissions_course ON submissions(course_id);
CREATE INDEX idx_submissions_assignment ON submissions(assignment_id);
CREATE INDEX idx_submissions_status ON submissions(status);

-- ============================================================================
-- Question Bank Tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS question_bank (
  id TEXT PRIMARY KEY,

  -- Question content
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL, -- multiple_choice, true_false, short_answer
  correct_answer TEXT NOT NULL,
  options TEXT, -- JSON array for MCQs
  explanation TEXT,

  -- Metadata
  topic TEXT,
  subtopic TEXT,
  keywords TEXT, -- JSON array
  bloom_level TEXT NOT NULL, -- remember, understand, apply, analyze, evaluate, create
  complexity_level INTEGER CHECK (complexity_level BETWEEN 1 AND 10),

  -- Source tracking
  source TEXT NOT NULL, -- qti_import, manual, llm_generated
  source_reference TEXT,
  created_by TEXT,

  -- Embeddings for RAG (stored as JSON array of floats)
  embedding_vector TEXT,

  -- Usage statistics
  times_used INTEGER DEFAULT 0,
  avg_correct_rate REAL,
  avg_confidence REAL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_question_bank_topic ON question_bank(topic);
CREATE INDEX idx_question_bank_bloom ON question_bank(bloom_level);
CREATE INDEX idx_question_bank_complexity ON question_bank(complexity_level);
CREATE INDEX idx_question_bank_source ON question_bank(source);

-- ============================================================================
-- Assessment Questions Tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS assessment_questions (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL,

  -- Question source
  question_source TEXT NOT NULL, -- question_bank, llm_generated_novel, llm_generated_oral
  question_bank_id TEXT, -- NULL if LLM-generated

  -- Question content (may be modified from bank)
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  options TEXT, -- JSON array

  -- Context
  related_content TEXT, -- The chunk/section this question tests
  novelty_score REAL, -- Novelty score of related content
  question_category TEXT NOT NULL, -- standard, novel, oral

  -- Assessment parameters
  requires_confidence INTEGER DEFAULT 1, -- Boolean: 1 = true, 0 = false
  points_possible REAL DEFAULT 2.0,
  bloom_level TEXT NOT NULL,
  complexity_level INTEGER,

  -- Ordering
  display_order INTEGER,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
  FOREIGN KEY (question_bank_id) REFERENCES question_bank(id) ON DELETE SET NULL
);

CREATE INDEX idx_assessment_questions_submission ON assessment_questions(submission_id);
CREATE INDEX idx_assessment_questions_category ON assessment_questions(question_category);
CREATE INDEX idx_assessment_questions_order ON assessment_questions(submission_id, display_order);

-- ============================================================================
-- Student Response Tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS student_responses (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  student_id TEXT NOT NULL,

  -- Response data
  answer TEXT NOT NULL,
  confidence_level INTEGER CHECK (confidence_level BETWEEN 1 AND 5),
  confidence_reasoning TEXT,

  -- Scoring
  is_correct INTEGER, -- Boolean: 1 = true, 0 = false
  cbm_score REAL,
  points_earned REAL,

  -- Timing
  time_spent_seconds INTEGER,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES assessment_questions(id) ON DELETE CASCADE
);

CREATE INDEX idx_student_responses_submission ON student_responses(submission_id);
CREATE INDEX idx_student_responses_student ON student_responses(student_id);
CREATE INDEX idx_student_responses_question ON student_responses(question_id);

-- ============================================================================
-- CBM Scoring Rules Tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS cbm_scoring_rules (
  id TEXT PRIMARY KEY,
  rule_name TEXT DEFAULT 'default',
  confidence_level INTEGER CHECK (confidence_level BETWEEN 1 AND 5),
  correct_score REAL NOT NULL,
  incorrect_score REAL NOT NULL,
  active INTEGER DEFAULT 1, -- Boolean: 1 = true, 0 = false

  UNIQUE(rule_name, confidence_level)
);

-- Insert default CBM scoring rules
INSERT OR IGNORE INTO cbm_scoring_rules (id, rule_name, confidence_level, correct_score, incorrect_score, active) VALUES
  ('cbm-default-5', 'default', 5, 2.0, -2.0, 1),   -- Very confident
  ('cbm-default-4', 'default', 4, 1.5, -1.5, 1),   -- Confident
  ('cbm-default-3', 'default', 3, 1.0, -1.0, 1),   -- Moderately confident
  ('cbm-default-2', 'default', 2, 0.5, -0.5, 1),   -- Somewhat uncertain
  ('cbm-default-1', 'default', 1, 0.0, 0.0, 1);    -- Very uncertain / guess

-- ============================================================================
-- Oral Assessment Questions Tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS oral_assessment_questions (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL,

  question_text TEXT NOT NULL,
  question_purpose TEXT, -- e.g., "Test understanding of methodology"
  related_section TEXT,
  expected_key_points TEXT, -- JSON array - LLM-generated key points for grading rubric
  bloom_level TEXT NOT NULL,

  display_order INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE
);

CREATE INDEX idx_oral_questions_submission ON oral_assessment_questions(submission_id);

-- ============================================================================
-- LLM Request Tracking Tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS llm_requests (
  id TEXT PRIMARY KEY,
  submission_id TEXT, -- NULL for non-submission requests

  provider TEXT NOT NULL, -- claude, gemini, gpt, local
  model TEXT NOT NULL,
  request_type TEXT NOT NULL, -- novelty_analysis, question_generation, oral_questions, content_analysis

  prompt TEXT,
  response TEXT,

  tokens_used INTEGER,
  estimated_cost REAL,
  processing_time_ms INTEGER,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE
);

CREATE INDEX idx_llm_requests_submission ON llm_requests(submission_id);
CREATE INDEX idx_llm_requests_provider ON llm_requests(provider);
CREATE INDEX idx_llm_requests_type ON llm_requests(request_type);
CREATE INDEX idx_llm_requests_created ON llm_requests(created_at);

-- ============================================================================
-- Export Log Tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS export_log (
  id TEXT PRIMARY KEY,
  exported_by TEXT NOT NULL,
  export_type TEXT NOT NULL, -- novelty_report, oral_questions, detailed_scores, summary
  submission_ids TEXT, -- JSON array
  course_id TEXT,

  file_format TEXT NOT NULL, -- csv, xlsx, pdf
  file_path TEXT NOT NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_export_log_exported_by ON export_log(exported_by);
CREATE INDEX idx_export_log_type ON export_log(export_type);
CREATE INDEX idx_export_log_course ON export_log(course_id);
CREATE INDEX idx_export_log_created ON export_log(created_at);

-- ============================================================================
-- Views for Common Queries
-- ============================================================================

-- View: Submission summary with question counts
CREATE VIEW IF NOT EXISTS submission_summary AS
SELECT
  s.id,
  s.student_id,
  s.course_id,
  s.assignment_id,
  s.original_filename,
  s.status,
  s.created_at,
  s.completed_at,
  COUNT(DISTINCT aq.id) as total_questions,
  COUNT(DISTINCT CASE WHEN aq.question_category = 'standard' THEN aq.id END) as standard_questions,
  COUNT(DISTINCT CASE WHEN aq.question_category = 'novel' THEN aq.id END) as novel_questions,
  COUNT(DISTINCT oaq.id) as oral_questions,
  COUNT(DISTINCT sr.id) as responses_submitted
FROM submissions s
LEFT JOIN assessment_questions aq ON s.id = aq.submission_id
LEFT JOIN oral_assessment_questions oaq ON s.id = oaq.submission_id
LEFT JOIN student_responses sr ON s.id = sr.submission_id
GROUP BY s.id;

-- View: Student performance summary
CREATE VIEW IF NOT EXISTS student_performance AS
SELECT
  s.id as submission_id,
  s.student_id,
  s.course_id,
  s.assignment_id,
  COUNT(sr.id) as total_responses,
  SUM(CASE WHEN sr.is_correct = 1 THEN 1 ELSE 0 END) as correct_responses,
  SUM(sr.points_earned) as total_points,
  SUM(aq.points_possible) as max_possible_points,
  AVG(sr.confidence_level) as avg_confidence,
  AVG(CASE WHEN sr.is_correct = 1 THEN sr.confidence_level ELSE 0 END) as avg_confidence_correct,
  AVG(CASE WHEN sr.is_correct = 0 THEN sr.confidence_level ELSE 0 END) as avg_confidence_incorrect
FROM submissions s
LEFT JOIN student_responses sr ON s.id = sr.submission_id
LEFT JOIN assessment_questions aq ON sr.question_id = aq.id
GROUP BY s.id;

-- ============================================================================
-- Triggers for Updated At
-- ============================================================================

-- Trigger to update question_bank.updated_at
CREATE TRIGGER IF NOT EXISTS update_question_bank_timestamp
AFTER UPDATE ON question_bank
FOR EACH ROW
BEGIN
  UPDATE question_bank SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- ============================================================================
-- Migration Complete
-- ============================================================================
