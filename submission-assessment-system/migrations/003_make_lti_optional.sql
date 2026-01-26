-- Migration 003: Make LTI fields optional for direct submissions
-- Allow submissions without LTI launch (for direct web uploads)

-- SQLite doesn't support ALTER COLUMN directly, so we need to recreate the table
-- First, rename old table
ALTER TABLE submissions RENAME TO submissions_old;

-- Create new table with lti_launch_id as nullable
CREATE TABLE submissions (
  id TEXT PRIMARY KEY,
  lti_launch_id TEXT, -- Now nullable
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

  FOREIGN KEY (lti_launch_id) REFERENCES lti_launches(id) ON DELETE SET NULL
);

-- Copy data from old table (if any exists)
INSERT INTO submissions SELECT * FROM submissions_old;

-- Drop old table
DROP TABLE submissions_old;

-- Recreate indices
CREATE INDEX idx_submissions_student ON submissions(student_id);
CREATE INDEX idx_submissions_course ON submissions(course_id);
CREATE INDEX idx_submissions_assignment ON submissions(assignment_id);
CREATE INDEX idx_submissions_status ON submissions(status);

-- Recreate views that depend on submissions table
DROP VIEW IF EXISTS submission_summary;
CREATE VIEW submission_summary AS
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

DROP VIEW IF EXISTS student_performance;
CREATE VIEW student_performance AS
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
