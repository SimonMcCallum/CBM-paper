# CBM Submission Assessment System - Design & Implementation Plan

## System Overview

**Core Principle**: Submitted work is a claim of knowledge; the system generates questions to test that claim through:
- MCQs from question bank (for standard content)
- LLM-generated questions (for novel content)
- Oral assessment questions (to verify authorship/understanding)
- All assessed using Confidence-Based Marking (CBM)

**Integration**: LTI-compliant tool for Canvas LMS integration
**Current Scope**: PDF submissions
**Future Scope**: Text submissions, code repositories

---

## Architecture Design

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                        Canvas LMS                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  LTI Consumer (Assignment Submission)                │   │
│  └────────────────┬─────────────────────────────────────┘   │
└─────────────────────┼───────────────────────────────────────┘
                      │ LTI Launch
                      ▼
┌─────────────────────────────────────────────────────────────┐
│           CBM Submission Assessment System                   │
│                   (LTI Tool Provider)                        │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  1. LTI Integration Layer                            │   │
│  │     - LTI 1.3 OAuth & Launch handling                │   │
│  │     - Deep Linking for assignment creation           │   │
│  │     - Assignment & Grade Services (AGS)              │   │
│  │     - Names & Role Provisioning (NRPS)               │   │
│  └──────────────────────────────────────────────────────┘   │
│                      ▼                                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  2. PDF Submission & Analysis Pipeline               │   │
│  │     - PDF upload and validation                      │   │
│  │     - Text extraction (pdf-parse)                    │   │
│  │     - Novelty detection (existing system)            │   │
│  │     - Content chunking & embedding                   │   │
│  └──────────────────────────────────────────────────────┘   │
│                      ▼                                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  3. Question Bank System                             │   │
│  │     - QTI import/export                              │   │
│  │     - Web-based MCQ creation interface               │   │
│  │     - Question metadata & embeddings                 │   │
│  │     - RAG-based question retrieval                   │   │
│  └──────────────────────────────────────────────────────┘   │
│                      ▼                                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  4. Question Generation Engine                       │   │
│  │     - RAG retrieval for standard content             │   │
│  │     - LLM generation for novel content               │   │
│  │     - Oral assessment question generation            │   │
│  │     - Configurable LLM providers (Claude, Gemini,    │   │
│  │       GPT, local LLM server)                         │   │
│  └──────────────────────────────────────────────────────┘   │
│                      ▼                                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  5. Assessment Delivery & CBM Scoring                │   │
│  │     - Student quiz interface                         │   │
│  │     - Confidence level collection (1-5 scale)        │   │
│  │     - CBM score calculation                          │   │
│  │     - Progress tracking                              │   │
│  └──────────────────────────────────────────────────────┘   │
│                      ▼                                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  6. Results & Reporting System                       │   │
│  │     - Grade passback to Canvas (AGS)                 │   │
│  │     - Staff spreadsheet exports (CSV/Excel)          │   │
│  │     - Analytics dashboard                            │   │
│  │     - Novelty detection reports                      │   │
│  │     - Oral assessment question sheets                │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  7. Database Layer (SQLite/PostgreSQL)               │   │
│  │     - LTI registrations & launches                   │   │
│  │     - Question bank                                  │   │
│  │     - Submissions & assessments                      │   │
│  │     - Student responses                              │   │
│  │     - Embeddings & indices                           │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

```
Student Submits PDF in Canvas
  ↓
LTI Launch → CBM System receives submission
  ↓
┌─────────────────────────────────────────┐
│ PHASE 1: Analysis                       │
│  1. Extract text from PDF               │
│  2. Run novelty detection               │
│  3. Generate embeddings for all chunks  │
│  4. Identify novel vs standard sections │
└─────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────┐
│ PHASE 2: Question Selection             │
│  For STANDARD content:                  │
│    - RAG retrieval from question bank   │
│    - Match based on embedding similarity│
│    - Select diverse difficulty levels   │
│  For NOVEL content:                     │
│    - LLM generates targeted MCQs        │
│    - Focus on comprehension & analysis  │
│  For ORAL assessment:                   │
│    - LLM generates open-ended questions │
│    - Test deep understanding            │
└─────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────┐
│ PHASE 3: Student Assessment             │
│  1. Student answers MCQs                │
│  2. Provides confidence level (1-5)     │
│  3. CBM scoring applied                 │
│  4. Results saved to database           │
└─────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────┐
│ PHASE 4: Reporting                      │
│  1. Grade posted to Canvas (AGS)        │
│  2. Staff export: novelty analysis      │
│  3. Staff export: oral questions        │
│  4. Staff export: detailed scores       │
└─────────────────────────────────────────┘
```

---

## Implementation Roadmap

### Phase 1: Foundation & LTI Integration (Weeks 1-2)

#### 1.1 Project Setup
- [ ] Create new directory structure: `submission-assessment-system/`
- [ ] Initialize Node.js project with TypeScript
- [ ] Set up database (PostgreSQL for production, SQLite for dev)
- [ ] Configure environment variables and secrets
- [ ] Set up logging and error handling
- [ ] Create development/production configurations

#### 1.2 LTI 1.3 Integration
- [ ] Install LTI libraries (ltijs or custom implementation)
- [ ] Implement LTI 1.3 OAuth flow
  - [ ] Platform registration endpoint
  - [ ] OIDC login initiation
  - [ ] Authentication response handling
  - [ ] JWT validation
- [ ] Implement LTI Deep Linking
  - [ ] Assignment creation interface
  - [ ] Configuration options (question count, difficulty, etc.)
  - [ ] Content item return
- [ ] Implement Assignment & Grade Services (AGS)
  - [ ] Line item creation
  - [ ] Score publishing
  - [ ] Grade passback
- [ ] Implement Names & Role Provisioning Service (NRPS)
  - [ ] Student roster retrieval
  - [ ] Role mapping
- [ ] Create LTI configuration/registration UI for Canvas admins
- [ ] Test with Canvas Developer Account

#### 1.3 Database Schema
```sql
-- LTI Platforms (Canvas instances)
CREATE TABLE lti_platforms (
  id UUID PRIMARY KEY,
  platform_url VARCHAR(255) NOT NULL,
  client_id VARCHAR(255) NOT NULL,
  deployment_id VARCHAR(255),
  public_key TEXT NOT NULL,
  auth_endpoint VARCHAR(255) NOT NULL,
  token_endpoint VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- LTI Launches (session tracking)
CREATE TABLE lti_launches (
  id UUID PRIMARY KEY,
  platform_id UUID REFERENCES lti_platforms(id),
  user_id VARCHAR(255) NOT NULL,
  context_id VARCHAR(255),
  resource_link_id VARCHAR(255),
  roles TEXT[],
  launch_data JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Submissions
CREATE TABLE submissions (
  id UUID PRIMARY KEY,
  lti_launch_id UUID REFERENCES lti_launches(id),
  student_id VARCHAR(255) NOT NULL,
  course_id VARCHAR(255) NOT NULL,
  assignment_id VARCHAR(255) NOT NULL,

  -- File data
  original_filename VARCHAR(255) NOT NULL,
  stored_filename VARCHAR(255) NOT NULL,
  file_type VARCHAR(50) DEFAULT 'pdf',
  file_size INTEGER,

  -- Processing status
  status VARCHAR(50) DEFAULT 'uploaded', -- uploaded, analyzing, ready, completed
  error_message TEXT,

  -- Novelty analysis results
  novelty_scores JSONB, -- Array of chunk novelty scores
  novel_sections JSONB, -- Chunks with high novelty (score > 0.7)
  standard_sections JSONB, -- Chunks with low novelty (score < 0.4)

  -- Content analysis
  extracted_text TEXT,
  content_summary TEXT,
  topics JSONB,
  complexity_analysis JSONB,

  -- Embeddings stored separately for RAG
  embedding_ids JSONB, -- References to vector store

  created_at TIMESTAMP DEFAULT NOW(),
  analyzed_at TIMESTAMP,
  completed_at TIMESTAMP
);

-- Question Bank
CREATE TABLE question_bank (
  id UUID PRIMARY KEY,

  -- Question content
  question_text TEXT NOT NULL,
  question_type VARCHAR(50) NOT NULL, -- multiple_choice, true_false, short_answer
  correct_answer TEXT NOT NULL,
  options JSONB, -- For MCQs: ["A", "B", "C", "D"]
  explanation TEXT,

  -- Metadata
  topic VARCHAR(255),
  subtopic VARCHAR(255),
  keywords JSONB,
  bloom_level VARCHAR(50), -- remember, understand, apply, analyze, evaluate, create
  complexity_level INTEGER CHECK (complexity_level BETWEEN 1 AND 10),

  -- Source tracking
  source VARCHAR(50), -- qti_import, manual, llm_generated
  source_reference VARCHAR(255),
  created_by VARCHAR(255),

  -- Embeddings for RAG
  embedding_vector VECTOR(1536), -- or use separate vector store

  -- Usage statistics
  times_used INTEGER DEFAULT 0,
  avg_correct_rate FLOAT,
  avg_confidence FLOAT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Assessment Questions (generated per submission)
CREATE TABLE assessment_questions (
  id UUID PRIMARY KEY,
  submission_id UUID REFERENCES submissions(id),

  -- Question source
  question_source VARCHAR(50), -- question_bank, llm_generated_novel, llm_generated_oral
  question_bank_id UUID REFERENCES question_bank(id), -- NULL if LLM-generated

  -- Question content (may be modified from bank)
  question_text TEXT NOT NULL,
  question_type VARCHAR(50) NOT NULL,
  correct_answer TEXT NOT NULL,
  options JSONB,

  -- Context
  related_content TEXT, -- The chunk/section this question tests
  novelty_score FLOAT, -- Novelty score of related content
  question_category VARCHAR(50), -- standard, novel, oral

  -- Assessment parameters
  requires_confidence BOOLEAN DEFAULT TRUE,
  points_possible FLOAT DEFAULT 2.0,
  bloom_level VARCHAR(50),
  complexity_level INTEGER,

  -- Ordering
  display_order INTEGER,

  created_at TIMESTAMP DEFAULT NOW()
);

-- Student Responses
CREATE TABLE student_responses (
  id UUID PRIMARY KEY,
  submission_id UUID REFERENCES submissions(id),
  question_id UUID REFERENCES assessment_questions(id),
  student_id VARCHAR(255) NOT NULL,

  -- Response data
  answer TEXT NOT NULL,
  confidence_level INTEGER CHECK (confidence_level BETWEEN 1 AND 5),
  confidence_reasoning TEXT,

  -- Scoring
  is_correct BOOLEAN,
  cbm_score FLOAT,
  points_earned FLOAT,

  -- Timing
  time_spent_seconds INTEGER,
  submitted_at TIMESTAMP DEFAULT NOW()
);

-- CBM Scoring Rules (configurable)
CREATE TABLE cbm_scoring_rules (
  id UUID PRIMARY KEY,
  rule_name VARCHAR(100) DEFAULT 'default',
  confidence_level INTEGER CHECK (confidence_level BETWEEN 1 AND 5),
  correct_score FLOAT NOT NULL,
  incorrect_score FLOAT NOT NULL,
  active BOOLEAN DEFAULT TRUE
);

-- Default CBM Scoring Rules
INSERT INTO cbm_scoring_rules (rule_name, confidence_level, correct_score, incorrect_score) VALUES
  ('default', 5, 2.0, -2.0),   -- Very confident
  ('default', 4, 1.5, -1.5),   -- Confident
  ('default', 3, 1.0, -1.0),   -- Moderately confident
  ('default', 2, 0.5, -0.5),   -- Somewhat uncertain
  ('default', 1, 0.0, 0.0);    -- Very uncertain / guess

-- Oral Assessment Questions
CREATE TABLE oral_assessment_questions (
  id UUID PRIMARY KEY,
  submission_id UUID REFERENCES submissions(id),

  question_text TEXT NOT NULL,
  question_purpose TEXT, -- e.g., "Test understanding of methodology"
  related_section TEXT,
  expected_key_points JSONB, -- LLM-generated key points for grading rubric
  bloom_level VARCHAR(50),

  display_order INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- LLM Request Tracking
CREATE TABLE llm_requests (
  id UUID PRIMARY KEY,
  submission_id UUID REFERENCES submissions(id),

  provider VARCHAR(50), -- claude, gemini, gpt, local
  model VARCHAR(100),
  request_type VARCHAR(50), -- novelty_analysis, question_generation, oral_questions

  prompt TEXT,
  response TEXT,

  tokens_used INTEGER,
  estimated_cost FLOAT,
  processing_time_ms INTEGER,

  created_at TIMESTAMP DEFAULT NOW()
);

-- Staff Export Log
CREATE TABLE export_log (
  id UUID PRIMARY KEY,
  exported_by VARCHAR(255) NOT NULL,
  export_type VARCHAR(50), -- novelty_report, oral_questions, detailed_scores, summary
  submission_ids JSONB,
  course_id VARCHAR(255),

  file_format VARCHAR(20), -- csv, xlsx, pdf
  file_path VARCHAR(255),

  created_at TIMESTAMP DEFAULT NOW()
);
```

### Phase 2: PDF Processing & Novelty Detection (Week 3)

#### 2.1 PDF Upload Service
- [ ] Create file upload endpoint with validation
  - [ ] File type checking (PDF only for now)
  - [ ] File size limits
  - [ ] Virus scanning (optional)
  - [ ] Storage management
- [ ] Integrate with existing novelty_detector
  - [ ] Call novelty detector API
  - [ ] Store novelty scores in database
  - [ ] Classify sections as novel/standard
- [ ] Generate embeddings for all text chunks
  - [ ] Use same embedding model as novelty detector
  - [ ] Store embeddings in vector database (FAISS or pgvector)
  - [ ] Create indices for fast retrieval

#### 2.2 Content Analysis Service
- [ ] Extract topics from submission using LLM
- [ ] Assess overall complexity/Bloom level
- [ ] Generate content summary
- [ ] Store analysis results in database

### Phase 3: Question Bank System (Week 4)

#### 3.1 QTI Import
- [ ] Adapt existing Canvas_update/insertCBM.py for import
- [ ] Parse QTI XML to extract questions
- [ ] Generate embeddings for each question
- [ ] Store in question_bank table
- [ ] Create import UI for staff

#### 3.2 Web-based Question Creation
- [ ] Create question editor interface
  - [ ] MCQ builder with option management
  - [ ] True/False question builder
  - [ ] Rich text editor for question text
  - [ ] Answer key specification
  - [ ] Metadata annotation (topic, Bloom level, complexity)
- [ ] Question preview/testing
- [ ] Bulk import via CSV/JSON
- [ ] Question versioning

#### 3.3 Question Bank Management
- [ ] Search and filter questions
- [ ] Tag management
- [ ] Quality metrics display
- [ ] Question retirement/archival
- [ ] Export to QTI format

### Phase 4: RAG-based Question Retrieval (Week 5)

#### 4.1 Vector Store Setup
- [ ] Implement FAISS index for question embeddings
- [ ] Create similarity search functions
- [ ] Implement hybrid search (semantic + keyword)

#### 4.2 Question Matching Algorithm
```python
def select_questions_for_submission(submission_id, config):
    """
    Select questions from bank based on submission content

    Strategy:
    1. For each standard (low novelty) section:
       - Find top-k most similar questions from bank
       - Diversify by topic and difficulty
       - Ensure coverage across submission

    2. Filter for quality:
       - Prefer questions with good historical performance
       - Balance Bloom levels
       - Avoid duplicate concepts

    3. Return ordered list with metadata
    """
    # Get submission chunks marked as standard
    standard_chunks = get_standard_content_chunks(submission_id)

    selected_questions = []
    for chunk in standard_chunks:
        # RAG retrieval
        similar_questions = vector_search(
            embedding=chunk.embedding,
            top_k=config.candidates_per_chunk,
            min_similarity=config.min_similarity_threshold
        )

        # Diversification
        diverse_questions = diversify_selection(
            similar_questions,
            by=['bloom_level', 'complexity', 'topic']
        )

        selected_questions.extend(diverse_questions[:config.questions_per_chunk])

    # Final selection and ordering
    final_questions = deduplicate_and_order(
        selected_questions,
        target_count=config.total_standard_questions
    )

    return final_questions
```

- [ ] Implement question selection algorithm
- [ ] Add diversity scoring to prevent redundant questions
- [ ] Configure selection parameters (count, difficulty distribution)
- [ ] Test on sample submissions

### Phase 5: LLM Question Generation (Week 6)

#### 5.1 LLM Service Configuration
- [ ] Create abstraction layer for multiple LLM providers
  - [ ] Claude (Anthropic)
  - [ ] Gemini (Google)
  - [ ] GPT (OpenAI)
  - [ ] Local LLM server (Ollama/vLLM)
- [ ] Implement provider selection logic
- [ ] Add fallback mechanisms
- [ ] Track costs and usage

#### 5.2 Novel Content Question Generation
```python
def generate_questions_for_novel_content(submission_id, novel_chunks, config):
    """
    Generate MCQs for novel content using LLM

    Prompt strategy:
    - Provide the novel text chunk
    - Ask LLM to identify key concepts
    - Generate questions testing comprehension/analysis
    - Ensure questions are answerable from the text
    - Create plausible distractors
    """

    prompt_template = """
    You are generating assessment questions for student-submitted work.

    The following text is NOVEL content (not covered in standard materials):

    {chunk_text}

    Generate {num_questions} multiple-choice questions that:
    1. Test understanding of the key concepts in this text
    2. Are at Bloom level: {bloom_level}
    3. Have 4 plausible options (one correct, three plausible distractors)
    4. Are answerable based solely on the text provided
    5. Test the student's claim of understanding this material

    Return JSON format:
    {{
      "questions": [
        {{
          "question_text": "...",
          "options": ["A", "B", "C", "D"],
          "correct_answer": "A",
          "explanation": "...",
          "bloom_level": "understand",
          "key_concept": "..."
        }}
      ]
    }}
    """

    questions = []
    for chunk in novel_chunks:
        response = llm_client.generate(
            prompt=prompt_template.format(
                chunk_text=chunk.text,
                num_questions=config.questions_per_novel_chunk,
                bloom_level=config.target_bloom_level
            ),
            temperature=0.7
        )
        questions.extend(parse_llm_response(response))

    return questions
```

- [ ] Implement novel question generation prompts
- [ ] Add quality validation for generated questions
- [ ] Test question quality with sample submissions
- [ ] Implement human review workflow for generated questions

#### 5.3 Oral Assessment Question Generation
```python
def generate_oral_assessment_questions(submission_id, config):
    """
    Generate open-ended questions for oral assessment

    Purpose: Verify the student understands what they submitted
    Focus areas:
    - Methodology and approach
    - Decision-making and rationale
    - Limitations and alternatives
    - Synthesis and connections
    """

    prompt_template = """
    You are preparing oral assessment questions to verify a student's
    understanding of their submitted work.

    Submission summary: {summary}
    Key topics: {topics}
    Novel content areas: {novel_sections}

    Generate {num_questions} open-ended questions that:
    1. Test DEEP understanding (not just recall)
    2. Focus on "why" and "how" rather than "what"
    3. Probe methodology, decisions, and trade-offs
    4. Verify authorship and comprehension
    5. Cover both novel and standard content

    For each question, provide:
    - The question text
    - Purpose (what you're testing)
    - Key points expected in a good answer
    - Follow-up probes if answer is superficial

    Return JSON format:
    {{
      "questions": [
        {{
          "question_text": "...",
          "purpose": "...",
          "expected_key_points": ["...", "..."],
          "follow_up_probes": ["...", "..."],
          "bloom_level": "evaluate"
        }}
      ]
    }}
    """

    submission = get_submission_with_analysis(submission_id)

    response = llm_client.generate(
        prompt=prompt_template.format(
            summary=submission.content_summary,
            topics=", ".join(submission.topics),
            novel_sections=format_novel_sections(submission.novel_sections),
            num_questions=config.oral_questions_count
        ),
        temperature=0.8
    )

    return parse_oral_questions(response)
```

- [ ] Implement oral question generation prompts
- [ ] Test questions with staff reviewers
- [ ] Create printable oral assessment sheets
- [ ] Add rubric generation for oral questions

### Phase 6: Assessment Delivery & CBM Scoring (Week 7)

#### 6.1 Student Assessment Interface
- [ ] Create quiz UI for students
  - [ ] Question display with rich text/images
  - [ ] Answer selection (MCQ radio buttons)
  - [ ] Confidence level slider (1-5 with labels)
  - [ ] Confidence reasoning text box (optional)
  - [ ] Progress indicator
  - [ ] Timer (optional)
- [ ] Implement quiz state management
  - [ ] Save progress automatically
  - [ ] Allow review before submission
  - [ ] Prevent changes after submission
- [ ] Accessibility features (WCAG 2.1 AA)

#### 6.2 CBM Scoring Engine
- [ ] Implement scoring calculation
  ```javascript
  function calculateCBMScore(response, scoringRules) {
    const rule = scoringRules.find(r =>
      r.confidence_level === response.confidence_level
    );

    const score = response.is_correct
      ? rule.correct_score
      : rule.incorrect_score;

    return {
      points_earned: score,
      max_possible: rule.correct_score,
      cbm_score: score
    };
  }
  ```
- [ ] Create scoring rules management interface
- [ ] Support multiple scoring schemes
- [ ] Calculate aggregate scores

#### 6.3 Grade Passback
- [ ] Implement LTI AGS score posting
- [ ] Map CBM scores to Canvas grade scale
- [ ] Handle grade update errors gracefully
- [ ] Add manual grade override for staff

### Phase 7: Staff Reporting & Exports (Week 8)

#### 7.1 Novelty Analysis Reports
- [ ] Generate PDF novelty report per submission
  - [ ] Annotated PDF with highlights
  - [ ] Novelty score summary
  - [ ] Novel vs standard content breakdown
  - [ ] Section-by-section analysis
- [ ] Export novelty data to CSV
  ```csv
  student_id,assignment,total_chunks,novel_chunks,avg_novelty,max_novelty,novel_topics
  student123,Essay1,45,12,0.62,0.89,"quantum computing, edge cases"
  ```
- [ ] Batch export for entire course

#### 7.2 Oral Assessment Question Sheets
- [ ] Generate printable PDF per student
  - [ ] Student name and submission title
  - [ ] Ordered list of oral questions
  - [ ] Expected key points (for assessor)
  - [ ] Grading rubric
  - [ ] Space for notes
- [ ] Export all oral questions to spreadsheet
  ```csv
  student_id,question_number,question_text,purpose,key_points,bloom_level
  student123,1,"Explain your methodology choice","Test understanding",["Point 1","Point 2"],"analyze"
  ```

#### 7.3 Detailed Score Reports
- [ ] Per-student detailed report
  - [ ] Question-by-question breakdown
  - [ ] Confidence vs correctness analysis
  - [ ] CBM score calculation details
  - [ ] Comparison to cohort average
- [ ] Course-level analytics
  - [ ] Score distributions
  - [ ] Confidence calibration analysis
  - [ ] Question difficulty metrics
  - [ ] Novelty vs performance correlation
- [ ] Export to Excel with multiple sheets
  ```
  Sheet 1: Summary (student, total_score, questions_correct, avg_confidence)
  Sheet 2: Questions (student, question_id, answer, correct, confidence, cbm_score)
  Sheet 3: Novelty (student, novelty_score, novel_sections_count)
  Sheet 4: Oral Questions (student, oral_question_1, oral_question_2, ...)
  ```

#### 7.4 Staff Dashboard
- [ ] Real-time submission tracking
- [ ] Processing status monitoring
- [ ] Quick access to exports
- [ ] System health metrics
- [ ] LLM usage and costs

### Phase 8: Testing & Quality Assurance (Week 9)

#### 8.1 Unit Tests
- [ ] LTI integration tests
- [ ] PDF processing tests
- [ ] Question selection algorithm tests
- [ ] LLM generation tests (mocked)
- [ ] CBM scoring tests
- [ ] Export generation tests

#### 8.2 Integration Tests
- [ ] End-to-end submission flow
- [ ] Canvas LTI integration test
- [ ] Database transaction tests
- [ ] File upload/download tests

#### 8.3 Performance Tests
- [ ] Load testing (multiple concurrent submissions)
- [ ] Large PDF handling (100+ pages)
- [ ] Question bank scaling (10k+ questions)
- [ ] Vector search performance

#### 8.4 Security Audit
- [ ] LTI security review (JWT validation, etc.)
- [ ] File upload security
- [ ] SQL injection prevention
- [ ] XSS prevention
- [ ] Authentication/authorization checks
- [ ] API rate limiting

### Phase 9: Deployment & Documentation (Week 10)

#### 9.1 Deployment Setup
- [ ] Docker containerization
  - [ ] Application container
  - [ ] Database container
  - [ ] Nginx reverse proxy
- [ ] Environment configuration management
- [ ] Database migration scripts
- [ ] Backup and restore procedures
- [ ] Monitoring and alerting (e.g., Prometheus + Grafana)
- [ ] Log aggregation

#### 9.2 Canvas Integration Guide
- [ ] LTI registration instructions for Canvas admins
- [ ] Configuration screenshots
- [ ] Troubleshooting guide
- [ ] Student user guide
- [ ] Staff user guide

#### 9.3 API Documentation
- [ ] OpenAPI/Swagger specification
- [ ] Endpoint documentation
- [ ] Authentication guide
- [ ] Example requests/responses

#### 9.4 Administrator Documentation
- [ ] System architecture overview
- [ ] Deployment guide
- [ ] Configuration reference
- [ ] Database schema documentation
- [ ] Backup/restore procedures
- [ ] Troubleshooting guide

---

## Future Extensions (Post-MVP)

### Text Submission Support
- [ ] Plain text upload and analysis
- [ ] Markdown rendering
- [ ] Code syntax highlighting in submissions
- [ ] Text diff for revision tracking

### Code Repository Support
- [ ] Git repository integration
- [ ] Code structure analysis
- [ ] Code quality metrics (complexity, coverage)
- [ ] Generate questions about code design decisions
- [ ] Plagiarism detection via code similarity

### Advanced Features
- [ ] Peer review integration
- [ ] Adaptive questioning (adjust difficulty based on performance)
- [ ] Longitudinal tracking (student progress over multiple submissions)
- [ ] Question bank sharing across institutions
- [ ] Mobile app for student assessments
- [ ] AI-assisted grading of oral assessments (transcription + analysis)
- [ ] Multi-language support

### Analytics Enhancements
- [ ] Machine learning for question quality prediction
- [ ] Automatic difficulty calibration
- [ ] Student misconception identification
- [ ] Predictive analytics for student success

---

## Configuration Schema

```yaml
# config.yaml - System configuration

lti:
  issuer: "https://canvas.instructure.com"
  tool_url: "https://your-domain.com/lti"
  deep_linking_url: "https://your-domain.com/lti/deep-link"
  public_key_path: "/secrets/lti_public_key.pem"
  private_key_path: "/secrets/lti_private_key.pem"

submission:
  allowed_file_types: ["pdf"]
  max_file_size_mb: 50
  storage_path: "/data/submissions"

novelty_detection:
  endpoint: "http://novelty-detector:5000"
  chunk_size: 150
  overlap: 50
  novelty_threshold_high: 0.7  # Consider novel
  novelty_threshold_low: 0.4   # Consider standard

embeddings:
  model: "sentence-transformers/all-MiniLM-L6-v2"
  dimension: 384
  vector_store: "faiss"  # or "pgvector"

question_selection:
  standard_content:
    questions_per_submission: 15
    min_similarity: 0.6
    diversity_weight: 0.3
    bloom_distribution:
      remember: 0.2
      understand: 0.3
      apply: 0.3
      analyze: 0.2

  novel_content:
    questions_per_submission: 10
    questions_per_chunk: 2
    target_bloom_levels: ["understand", "analyze", "evaluate"]

  oral_assessment:
    questions_per_submission: 8
    target_bloom_levels: ["analyze", "evaluate", "create"]

llm:
  provider: "claude"  # claude, gemini, gpt, local

  claude:
    api_key_env: "ANTHROPIC_API_KEY"
    model: "claude-sonnet-4-5-20250929"
    max_tokens: 4096
    temperature: 0.7

  gemini:
    api_key_env: "GOOGLE_API_KEY"
    model: "gemini-2.0-flash-exp"
    temperature: 0.7

  gpt:
    api_key_env: "OPENAI_API_KEY"
    model: "gpt-4"
    temperature: 0.7

  local:
    endpoint: "http://localhost:11434"  # Ollama
    model: "llama3"
    temperature: 0.7

cbm_scoring:
  default_rules:
    - confidence_level: 5
      correct_score: 2.0
      incorrect_score: -2.0
    - confidence_level: 4
      correct_score: 1.5
      incorrect_score: -1.5
    - confidence_level: 3
      correct_score: 1.0
      incorrect_score: -1.0
    - confidence_level: 2
      correct_score: 0.5
      incorrect_score: -0.5
    - confidence_level: 1
      correct_score: 0.0
      incorrect_score: 0.0

exports:
  formats: ["csv", "xlsx", "pdf"]
  include_pii: false  # FERPA compliance
  encryption: true
  retention_days: 365

database:
  type: "postgresql"  # or "sqlite" for dev
  host: "localhost"
  port: 5432
  database: "cbm_assessment"
  pool_size: 20

monitoring:
  log_level: "info"
  sentry_dsn: "${SENTRY_DSN}"
  metrics_port: 9090
```

---

## Technology Stack

### Backend
- **Runtime**: Node.js 20+ with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL (production) / SQLite (dev)
- **Vector Store**: FAISS or pgvector extension
- **LTI**: ltijs or custom LTI 1.3 implementation
- **PDF Processing**: pdf-parse, pdf-lib
- **Authentication**: JWT, OAuth 2.0
- **Testing**: Jest, Supertest
- **Documentation**: OpenAPI/Swagger

### AI/ML Components
- **Novelty Detection**: Existing Python service (novelty_detector/)
- **Embeddings**: sentence-transformers (Python) or @xenova/transformers (JS)
- **LLM Integration**:
  - Anthropic SDK (Claude)
  - Google Generative AI (Gemini)
  - OpenAI SDK (GPT)
  - Axios (local LLM servers)
- **Vector Search**: FAISS (Python bindings) or pgvector

### Frontend
- **Framework**: React 18+ with TypeScript
- **UI Library**: Material-UI or Ant Design
- **State Management**: React Query + Context
- **Forms**: React Hook Form
- **Charts**: Recharts or Chart.js
- **Rich Text**: TipTap or Slate

### DevOps
- **Containerization**: Docker + Docker Compose
- **Reverse Proxy**: Nginx
- **Monitoring**: Prometheus + Grafana
- **Logging**: Winston + Loki
- **CI/CD**: GitHub Actions
- **Secrets**: HashiCorp Vault or AWS Secrets Manager

---

## Success Metrics

### Technical Metrics
- LTI launch success rate > 99%
- PDF processing time < 30 seconds for 20-page document
- Question generation time < 2 minutes per submission
- Vector search latency < 100ms
- System uptime > 99.5%

### Educational Metrics
- Question relevance (staff rating) > 4.0/5.0
- Oral question quality (staff rating) > 4.0/5.0
- Student confidence calibration accuracy
- Novel content detection accuracy > 80%
- Time to complete assessment < 45 minutes

### Adoption Metrics
- Number of courses using system
- Number of submissions processed
- Staff satisfaction score
- Student feedback score
- LLM cost per submission

---

## Risk Mitigation

### Technical Risks
- **LLM API failures**: Implement retry logic, fallback providers, caching
- **Vector search performance**: Optimize indices, consider sharding
- **Large file processing**: Implement streaming, chunked processing, timeouts
- **Database scaling**: Connection pooling, read replicas, caching layer

### Educational Risks
- **Low-quality generated questions**: Human review workflow, quality metrics, feedback loop
- **Biased question selection**: Diversity algorithms, manual oversight
- **Student gaming CBM system**: Statistical analysis, pattern detection
- **False novelty detection**: Tunable thresholds, manual review option

### Privacy/Security Risks
- **Student data exposure**: Encryption at rest and in transit, access controls
- **LTI security vulnerabilities**: Regular security audits, library updates
- **Submission content leakage**: Isolated LLM calls, no training on submissions
- **FERPA compliance**: PII handling policies, data retention, export controls

---

## License & Compliance

- **Code License**: MIT or Apache 2.0
- **FERPA Compliance**: Student data handling procedures
- **GDPR Considerations**: Data retention, right to deletion
- **Accessibility**: WCAG 2.1 AA compliance
- **LTI Certification**: IMS Global LTI Advantage certification (optional)

---

## Success Criteria for MVP

The MVP is considered complete when:
1. ✅ LTI integration works with Canvas (registration, launch, grade passback)
2. ✅ PDF submissions are processed and novelty detected
3. ✅ Question bank can be populated via QTI import and web UI
4. ✅ RAG retrieval selects relevant questions from bank for standard content
5. ✅ LLM generates quality questions for novel content
6. ✅ LLM generates oral assessment questions
7. ✅ Students can complete assessments with confidence levels
8. ✅ CBM scoring is calculated correctly
9. ✅ Grades are posted back to Canvas
10. ✅ Staff can export novelty reports, oral question sheets, and score spreadsheets
11. ✅ System is deployed and stable
12. ✅ Documentation is complete

---

## Getting Started

1. **Development Environment Setup**
   ```bash
   # Clone repository
   git clone <repo-url>
   cd CBM-paper

   # Create new system directory
   mkdir -p submission-assessment-system
   cd submission-assessment-system

   # Initialize Node.js project
   npm init -y

   # Install dependencies
   npm install express typescript @types/node @types/express
   npm install ltijs pg faiss-node axios
   npm install --save-dev jest @types/jest ts-jest

   # Set up database
   createdb cbm_assessment
   npm run migrate

   # Configure environment
   cp .env.example .env
   # Edit .env with API keys and settings

   # Start development server
   npm run dev
   ```

2. **Canvas Developer Account**
   - Sign up at https://canvas.instructure.com/doc/api/
   - Create test course and assignment
   - Configure LTI developer key

3. **Connect Existing Services**
   - Start novelty detector: `cd novelty_detector && python server.py`
   - Configure endpoint in system config
   - Test integration with sample PDF

---

## Timeline Summary

- **Weeks 1-2**: Foundation & LTI Integration
- **Week 3**: PDF Processing & Novelty Detection
- **Week 4**: Question Bank System
- **Week 5**: RAG-based Question Retrieval
- **Week 6**: LLM Question Generation
- **Week 7**: Assessment Delivery & CBM Scoring
- **Week 8**: Staff Reporting & Exports
- **Week 9**: Testing & QA
- **Week 10**: Deployment & Documentation

**Total Estimated Duration**: 10 weeks for MVP

---

*Last Updated: 2025-11-17*
*Version: 1.0*
