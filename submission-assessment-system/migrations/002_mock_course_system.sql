-- Migration 002: Add Mock Course System
-- Adds tables for testing without LTI integration

-- ============================================================================
-- Mock Courses Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE, -- e.g., "CS101", "PHYS201"
  name TEXT NOT NULL,
  description TEXT,
  semester TEXT, -- e.g., "Fall 2024"
  instructor TEXT,

  -- Mock mode flag (false when using real LTI)
  is_mock INTEGER DEFAULT 1, -- Boolean: 1 = mock, 0 = real LTI course
  lti_context_id TEXT, -- NULL for mock courses, populated for LTI courses

  -- Course settings
  active INTEGER DEFAULT 1, -- Boolean: 1 = active, 0 = archived

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_courses_code ON courses(code);
CREATE INDEX idx_courses_active ON courses(active);
CREATE INDEX idx_courses_lti ON courses(lti_context_id);

-- ============================================================================
-- Course Materials Table (for novelty context)
-- ============================================================================

CREATE TABLE IF NOT EXISTS course_materials (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL,

  -- Material metadata
  title TEXT NOT NULL,
  description TEXT,
  material_type TEXT NOT NULL, -- lecture_notes, textbook_chapter, article, slides, etc.

  -- File information
  original_filename TEXT NOT NULL,
  stored_filename TEXT NOT NULL,
  file_type TEXT NOT NULL, -- pdf, txt, docx, etc.
  file_size INTEGER,

  -- Processed content
  extracted_text TEXT,
  summary TEXT,

  -- Embeddings for novelty comparison (stored as JSON array)
  embedding_chunks TEXT, -- JSON array of {text, embedding} objects

  -- Ordering and visibility
  display_order INTEGER DEFAULT 0,
  visible INTEGER DEFAULT 1, -- Boolean: visible to students for reference

  -- Processing status
  processing_status TEXT DEFAULT 'pending', -- pending, processing, ready, error
  error_message TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

CREATE INDEX idx_course_materials_course ON course_materials(course_id);
CREATE INDEX idx_course_materials_type ON course_materials(material_type);
CREATE INDEX idx_course_materials_status ON course_materials(processing_status);

-- ============================================================================
-- Novelty Detection Parameters (per course)
-- ============================================================================

CREATE TABLE IF NOT EXISTS novelty_detection_config (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL UNIQUE,

  -- Chunking parameters
  chunk_size INTEGER DEFAULT 150, -- words per chunk
  chunk_overlap INTEGER DEFAULT 50, -- words of overlap

  -- Similarity thresholds
  novelty_threshold_high REAL DEFAULT 0.7, -- > this = novel
  novelty_threshold_low REAL DEFAULT 0.4,  -- < this = standard
  -- Between low and high = moderate novelty

  -- Embedding model
  embedding_model TEXT DEFAULT 'sentence-transformers/all-MiniLM-L6-v2',

  -- LLM provider for semantic prompts
  llm_provider TEXT DEFAULT 'claude', -- claude, gemini, gpt, local
  llm_model TEXT,
  llm_temperature REAL DEFAULT 0.7,

  -- Comparison strategy
  compare_to_materials INTEGER DEFAULT 1, -- Compare to course materials
  compare_to_past_submissions INTEGER DEFAULT 0, -- Compare to other student submissions

  -- K-nearest neighbors for similarity
  k_neighbors INTEGER DEFAULT 5,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

-- ============================================================================
-- Question Generation Parameters (per course)
-- ============================================================================

CREATE TABLE IF NOT EXISTS question_generation_config (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL UNIQUE,

  -- Question counts
  standard_questions_count INTEGER DEFAULT 15,
  novel_questions_count INTEGER DEFAULT 10,
  oral_questions_count INTEGER DEFAULT 8,

  -- Selection parameters
  min_similarity_threshold REAL DEFAULT 0.6,
  diversity_weight REAL DEFAULT 0.3,

  -- Bloom taxonomy distribution for standard questions (JSON)
  bloom_distribution_standard TEXT DEFAULT '{"remember": 0.2, "understand": 0.3, "apply": 0.3, "analyze": 0.2, "evaluate": 0.0, "create": 0.0}',

  -- Target Bloom levels for novel questions (JSON array)
  bloom_levels_novel TEXT DEFAULT '["understand", "analyze", "evaluate"]',

  -- Target Bloom levels for oral questions (JSON array)
  bloom_levels_oral TEXT DEFAULT '["analyze", "evaluate", "create"]',

  -- LLM configuration for question generation
  llm_provider TEXT DEFAULT 'claude',
  llm_model TEXT,
  llm_temperature REAL DEFAULT 0.7,

  -- Question quality settings
  require_explanation INTEGER DEFAULT 1, -- Require explanation for answers
  generate_distractors INTEGER DEFAULT 1, -- Auto-generate wrong answers
  distractor_count INTEGER DEFAULT 3, -- Number of wrong answers

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

-- ============================================================================
-- Course-specific Question Bank
-- ============================================================================

-- Add course_id to existing question_bank table
ALTER TABLE question_bank ADD COLUMN course_id TEXT;
CREATE INDEX idx_question_bank_course ON question_bank(course_id);

-- ============================================================================
-- Update submissions table to link to courses
-- ============================================================================

-- Add course reference to submissions (in addition to LTI course_id)
ALTER TABLE submissions ADD COLUMN course_ref TEXT;
CREATE INDEX idx_submissions_course_ref ON submissions(course_ref);

-- Add foreign key constraint (for mock courses)
-- Note: We can't add FK constraint in SQLite after table creation,
-- so this will be enforced at application level

-- ============================================================================
-- Insert Default Mock Courses for Testing
-- ============================================================================

INSERT OR IGNORE INTO courses (id, code, name, description, semester, instructor, is_mock, active) VALUES
  (
    'mock-cs101',
    'CS101',
    'Introduction to Computer Science',
    'Fundamental concepts of computer science including algorithms, data structures, and programming.',
    'Fall 2024',
    'Dr. Alice Johnson',
    1,
    1
  ),
  (
    'mock-phys201',
    'PHYS201',
    'Classical Mechanics',
    'Study of motion, forces, energy, and momentum in classical physics.',
    'Fall 2024',
    'Prof. Bob Smith',
    1,
    1
  ),
  (
    'mock-bio150',
    'BIO150',
    'Introduction to Biology',
    'Core principles of biology including cell structure, genetics, and evolution.',
    'Fall 2024',
    'Dr. Carol White',
    1,
    1
  );

-- Insert default novelty detection configs for mock courses
INSERT OR IGNORE INTO novelty_detection_config (
  id, course_id,
  chunk_size, chunk_overlap,
  novelty_threshold_high, novelty_threshold_low,
  embedding_model, llm_provider, k_neighbors
) VALUES
  ('ndc-cs101', 'mock-cs101', 150, 50, 0.7, 0.4, 'sentence-transformers/all-MiniLM-L6-v2', 'claude', 5),
  ('ndc-phys201', 'mock-phys201', 150, 50, 0.7, 0.4, 'sentence-transformers/all-MiniLM-L6-v2', 'claude', 5),
  ('ndc-bio150', 'mock-bio150', 150, 50, 0.7, 0.4, 'sentence-transformers/all-MiniLM-L6-v2', 'claude', 5);

-- Insert default question generation configs for mock courses
INSERT OR IGNORE INTO question_generation_config (
  id, course_id,
  standard_questions_count, novel_questions_count, oral_questions_count,
  min_similarity_threshold, diversity_weight,
  llm_provider
) VALUES
  ('qgc-cs101', 'mock-cs101', 15, 10, 8, 0.6, 0.3, 'claude'),
  ('qgc-phys201', 'mock-phys201', 15, 10, 8, 0.6, 0.3, 'claude'),
  ('qgc-bio150', 'mock-bio150', 15, 10, 8, 0.6, 0.3, 'claude');

-- ============================================================================
-- Triggers for Updated At
-- ============================================================================

CREATE TRIGGER IF NOT EXISTS update_courses_timestamp
AFTER UPDATE ON courses
FOR EACH ROW
BEGIN
  UPDATE courses SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_course_materials_timestamp
AFTER UPDATE ON course_materials
FOR EACH ROW
BEGIN
  UPDATE course_materials SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_novelty_config_timestamp
AFTER UPDATE ON novelty_detection_config
FOR EACH ROW
BEGIN
  UPDATE novelty_detection_config SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_question_config_timestamp
AFTER UPDATE ON question_generation_config
FOR EACH ROW
BEGIN
  UPDATE question_generation_config SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- ============================================================================
-- Views for Admin Dashboard
-- ============================================================================

-- Course overview with material and submission counts
CREATE VIEW IF NOT EXISTS course_overview AS
SELECT
  c.id,
  c.code,
  c.name,
  c.description,
  c.semester,
  c.instructor,
  c.is_mock,
  c.active,
  COUNT(DISTINCT cm.id) as material_count,
  COUNT(DISTINCT s.id) as submission_count,
  COUNT(DISTINCT qb.id) as question_count,
  SUM(CASE WHEN cm.processing_status = 'ready' THEN 1 ELSE 0 END) as processed_materials,
  c.created_at
FROM courses c
LEFT JOIN course_materials cm ON c.id = cm.course_id
LEFT JOIN submissions s ON c.id = s.course_ref
LEFT JOIN question_bank qb ON c.id = qb.course_id
GROUP BY c.id;

-- Material processing status summary
CREATE VIEW IF NOT EXISTS material_processing_status AS
SELECT
  cm.course_id,
  c.code as course_code,
  cm.material_type,
  COUNT(*) as total,
  SUM(CASE WHEN cm.processing_status = 'ready' THEN 1 ELSE 0 END) as ready,
  SUM(CASE WHEN cm.processing_status = 'processing' THEN 1 ELSE 0 END) as processing,
  SUM(CASE WHEN cm.processing_status = 'pending' THEN 1 ELSE 0 END) as pending,
  SUM(CASE WHEN cm.processing_status = 'error' THEN 1 ELSE 0 END) as errors
FROM course_materials cm
JOIN courses c ON cm.course_id = c.id
GROUP BY cm.course_id, cm.material_type;

-- ============================================================================
-- Migration Complete
-- ============================================================================
