/**
 * System 2: Submission Validator Routes
 *
 * Flow:
 * 1. Student uploads PDF → /api/validator/submit
 * 2. Server calls Python sidecar to:
 *    a. Extract text and generate embeddings
 *    b. FAISS search against question bank → select matching MCQs
 *    c. Generate NEW MCQs from novel (unmatched) content via LLM
 *    d. Generate oral questions for tutors
 * 3. Based on timing_mode, student either answers immediately or later
 * 4. Student answers MCQs with confidence → /api/validator/answer
 * 5. CBM score calculated (max 1.5x), grade sent to Canvas
 */

import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import multer from 'multer';
import path from 'path';
import axios from 'axios';
import { getDB } from '../models/database';
import { scoreAssessment, canvasGrade, getScoringTable, AnswerInput } from '../services/scoring';
import { submitGrade } from '../lti/setup';

const router = Router();
const upload = multer({
  dest: path.join(__dirname, '../../uploads/submissions'),
  limits: { fileSize: 50 * 1024 * 1024 },
});

const SIDECAR_URL = process.env.SIDECAR_URL || 'http://localhost:5000';

// ── Submit PDF (student) ──

router.post('/submit', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    const { config_id, student_id, student_name, course_id, token_data } = req.body;

    const db = getDB();
    const config = db.prepare('SELECT * FROM assignment_config WHERE id = ?').get(config_id) as any;
    if (!config) return res.status(404).json({ error: 'Assignment not found' });

    // Create submission record
    const submissionId = uuid();
    db.prepare(`
      INSERT INTO submissions (id, assignment_config_id, student_id, student_name,
        course_id, original_filename, stored_path, file_size, lti_token_data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      submissionId, config_id, student_id, student_name || 'Student',
      course_id || config.course_id, file.originalname, file.path,
      file.size, token_data ? JSON.stringify(token_data) : null
    );

    // Start async analysis pipeline
    analyzePipeline(submissionId, config).catch(err => {
      console.error(`Pipeline error for submission ${submissionId}:`, err);
      db.prepare("UPDATE submissions SET status = 'error', error_message = ? WHERE id = ?")
        .run(err.message, submissionId);
    });

    res.json({
      success: true,
      submission_id: submissionId,
      status: 'uploaded',
      message: 'PDF uploaded. Analysis in progress...',
    });
  } catch (err: any) {
    console.error('Submit error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Analysis Pipeline (runs in background) ──

async function analyzePipeline(submissionId: string, config: any) {
  const db = getDB();

  db.prepare("UPDATE submissions SET status = 'analyzing' WHERE id = ?").run(submissionId);

  const submission = db.prepare('SELECT * FROM submissions WHERE id = ?').get(submissionId) as any;

  // Step 1: Call Python sidecar to extract text, chunk, and embed
  const extractResp = await axios.post(`${SIDECAR_URL}/api/validator/extract`, {
    pdf_path: submission.stored_path,
    course_id: config.course_id,
  }, { timeout: 120000 });

  const { chunks, word_count } = extractResp.data;

  db.prepare('UPDATE submissions SET word_count = ?, chunk_count = ? WHERE id = ?')
    .run(word_count, chunks.length, submissionId);

  // Step 2: FAISS match chunks against question bank embeddings
  const matchResp = await axios.post(`${SIDECAR_URL}/api/validator/match`, {
    chunks,
    course_id: config.course_id,
    max_questions: Math.floor(config.mcq_count * 0.6), // 60% from bank
  }, { timeout: 60000 });

  const { matched_questions, unmatched_chunks } = matchResp.data;

  // Step 3: Generate new MCQs from unmatched (novel) content
  const generateCount = config.mcq_count - matched_questions.length;
  let generatedQuestions: any[] = [];

  if (generateCount > 0 && unmatched_chunks.length > 0) {
    const genResp = await axios.post(`${SIDECAR_URL}/api/validator/generate-mcq`, {
      chunks: unmatched_chunks,
      count: generateCount,
      course_id: config.course_id,
    }, { timeout: 180000 });
    generatedQuestions = genResp.data.questions || [];
  }

  // Step 4: Generate oral questions for tutors
  let oralQuestions: any[] = [];
  if (config.oral_count > 0) {
    const oralResp = await axios.post(`${SIDECAR_URL}/api/validator/generate-oral`, {
      chunks,
      count: config.oral_count,
      course_id: config.course_id,
    }, { timeout: 120000 });
    oralQuestions = oralResp.data.questions || [];
  }

  // Step 5: Store all assessment questions
  const insertAQ = db.prepare(`
    INSERT INTO assessment_questions (id, submission_id, question_order,
      question_text, question_type, options, correct_answer, explanation,
      source, category, topic, question_bank_id, is_oral)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let order = 1;

  // Bank-matched questions (standard category)
  for (const q of matched_questions) {
    insertAQ.run(
      uuid(), submissionId, order++,
      q.question_text, q.question_type || 'multiple_choice',
      JSON.stringify(q.options), q.correct_answer, q.explanation || null,
      'bank', 'standard', q.topic || null, q.question_bank_id || null, 0
    );
  }

  // LLM-generated questions (novel category)
  for (const q of generatedQuestions) {
    insertAQ.run(
      uuid(), submissionId, order++,
      q.question_text, 'multiple_choice',
      JSON.stringify(q.options), q.correct_answer, q.explanation || null,
      'generated', 'novel', q.topic || null, null, 0
    );
  }

  // Oral questions (tutor-only, not student-facing)
  for (const q of oralQuestions) {
    insertAQ.run(
      uuid(), submissionId, order++,
      q.question_text, 'oral',
      JSON.stringify(q.expected_answer_points || []), '', null,
      'generated', 'oral', q.topic || null, null, 1
    );
  }

  // Update submission
  db.prepare(`
    UPDATE submissions SET status = 'ready', processed_at = CURRENT_TIMESTAMP,
      matched_question_count = ?, generated_question_count = ?
    WHERE id = ?
  `).run(matched_questions.length, generatedQuestions.length, submissionId);

  // Create deferred assessment based on timing
  const deferredId = uuid();
  const now = new Date().toISOString();
  let availableAt: string | null = now;
  let deadlineAt: string | null = null;
  let status = 'available';

  if (config.timing_mode === 'deadline') {
    deadlineAt = new Date(Date.now() + (config.deadline_hours || 24) * 3600 * 1000).toISOString();
  } else if (config.timing_mode === 'tutorial') {
    status = 'pending'; // Waits for instructor activation
    availableAt = null;
  }

  db.prepare(`
    INSERT INTO deferred_assessments (id, submission_id, student_id, course_id,
      timing_mode, available_at, deadline_at, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    deferredId, submissionId, submission.student_id, submission.course_id,
    config.timing_mode, availableAt, deadlineAt, status
  );
}

// ── Check Submission Status (student polls this) ──

router.get('/status/:submission_id', async (req: Request, res: Response) => {
  const db = getDB();
  const sub = db.prepare('SELECT * FROM submissions WHERE id = ?').get(req.params.submission_id) as any;
  if (!sub) return res.status(404).json({ error: 'Not found' });

  const deferred = db.prepare(
    'SELECT * FROM deferred_assessments WHERE submission_id = ?'
  ).get(sub.id) as any;

  res.json({
    submission_id: sub.id,
    status: sub.status,
    word_count: sub.word_count,
    chunk_count: sub.chunk_count,
    matched_questions: sub.matched_question_count,
    generated_questions: sub.generated_question_count,
    assessment: deferred ? {
      timing_mode: deferred.timing_mode,
      status: deferred.status,
      available_at: deferred.available_at,
      deadline_at: deferred.deadline_at,
    } : null,
  });
});

// ── Get Assessment Questions (when student is ready to answer) ──

router.get('/questions/:submission_id', async (req: Request, res: Response) => {
  const db = getDB();

  // Check deferred assessment status
  const deferred = db.prepare(
    'SELECT * FROM deferred_assessments WHERE submission_id = ?'
  ).get(req.params.submission_id) as any;

  if (!deferred) return res.status(404).json({ error: 'Assessment not found' });

  if (deferred.status === 'pending') {
    return res.status(403).json({ error: 'Assessment not yet available. Wait for instructor activation.' });
  }
  if (deferred.status === 'expired') {
    return res.status(403).json({ error: 'Assessment has expired.' });
  }
  if (deferred.status === 'submitted') {
    return res.status(400).json({ error: 'Assessment already submitted.' });
  }

  // Check deadline
  if (deferred.deadline_at && new Date(deferred.deadline_at) < new Date()) {
    db.prepare("UPDATE deferred_assessments SET status = 'expired' WHERE id = ?").run(deferred.id);
    return res.status(403).json({ error: 'Assessment deadline has passed.' });
  }

  // Mark as in_progress
  if (deferred.status === 'available') {
    db.prepare("UPDATE deferred_assessments SET status = 'in_progress', started_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(deferred.id);
  }

  // Get non-oral questions
  const questions = db.prepare(`
    SELECT id, question_order, question_text, question_type, options, category
    FROM assessment_questions
    WHERE submission_id = ? AND is_oral = 0
    ORDER BY question_order
  `).all(req.params.submission_id) as any[];

  const config = db.prepare(`
    SELECT ac.* FROM assignment_config ac
    JOIN submissions s ON s.assignment_config_id = ac.id
    WHERE s.id = ?
  `).get(req.params.submission_id) as any;

  res.json({
    questions: questions.map(q => ({
      id: q.id,
      question_order: q.question_order,
      question_text: q.question_text,
      question_type: q.question_type,
      options: JSON.parse(q.options),
      category: q.category,
      // Never send correct_answer
    })),
    scoring_model: config?.scoring_model || 'hlcc',
    confidence_levels: config?.confidence_levels || 3,
    scoring_table: getScoringTable(config?.scoring_model || 'hlcc', config?.confidence_levels || 3),
    max_grade_multiplier: config?.max_grade_multiplier || 1.5,
    deadline_at: deferred.deadline_at,
  });
});

// ── Submit Answers (student) ──

router.post('/answer', async (req: Request, res: Response) => {
  try {
    const { submission_id, answers } = req.body;
    // answers: Array<{ question_id, selected_answer, confidence_level, time_spent_seconds? }>

    if (!submission_id || !answers?.length) {
      return res.status(400).json({ error: 'submission_id and answers[] required' });
    }

    const db = getDB();

    const deferred = db.prepare(
      'SELECT * FROM deferred_assessments WHERE submission_id = ?'
    ).get(submission_id) as any;
    if (!deferred) return res.status(404).json({ error: 'Assessment not found' });
    if (deferred.status === 'submitted') return res.status(400).json({ error: 'Already submitted' });
    if (deferred.status === 'expired') return res.status(403).json({ error: 'Assessment expired' });

    const submission = db.prepare('SELECT * FROM submissions WHERE id = ?').get(submission_id) as any;
    const config = db.prepare('SELECT * FROM assignment_config WHERE id = ?').get(submission.assignment_config_id) as any;

    // Get questions with correct answers
    const questions = db.prepare(`
      SELECT * FROM assessment_questions WHERE submission_id = ? AND is_oral = 0
    `).all(submission_id) as any[];

    // Grade each answer
    const scoringInputs: AnswerInput[] = [];
    const insertResponse = db.prepare(`
      INSERT INTO student_responses (id, assessment_question_id, student_id,
        selected_answer, is_correct, confidence_level, cbm_score, time_spent_seconds)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const answer of answers) {
      const q = questions.find((q: any) => q.id === answer.question_id);
      if (!q) continue;

      const isCorrect = q.correct_answer === answer.selected_answer;
      scoringInputs.push({
        question_id: q.id,
        is_correct: isCorrect,
        confidence_level: answer.confidence_level,
      });
    }

    const result = scoreAssessment(
      scoringInputs,
      config.scoring_model,
      config.confidence_levels,
      config.max_grade_multiplier
    );

    // Save responses
    for (const score of result.scores) {
      const answer = answers.find((a: any) => a.question_id === score.question_id);
      insertResponse.run(
        uuid(), score.question_id, deferred.student_id,
        answer?.selected_answer, score.is_correct ? 1 : 0,
        score.confidence_level, score.cbm_score,
        answer?.time_spent_seconds || null
      );
    }

    // Update deferred assessment
    db.prepare(`
      UPDATE deferred_assessments SET status = 'submitted', submitted_at = CURRENT_TIMESTAMP,
        raw_score = ?, max_possible = ?, normalized_score = ?
      WHERE id = ?
    `).run(result.raw_total, result.max_possible, result.normalized, deferred.id);

    db.prepare("UPDATE submissions SET status = 'completed' WHERE id = ?").run(submission_id);

    // Grade passback
    let gradeSubmitted = false;
    if (submission.lti_token_data) {
      const tokenData = JSON.parse(submission.lti_token_data);
      const grade = canvasGrade(result, result.num_questions, config.max_grade_multiplier);
      gradeSubmitted = await submitGrade(
        tokenData, grade.scoreGiven, grade.scoreMaximum, grade.comment
      );
      if (gradeSubmitted) {
        db.prepare('UPDATE deferred_assessments SET grade_submitted = 1 WHERE id = ?').run(deferred.id);
      }
    }

    res.json({
      success: true,
      result: {
        raw_total: result.raw_total,
        max_possible: result.max_possible,
        normalized: result.normalized,
        num_correct: result.num_correct,
        num_questions: result.num_questions,
        avg_confidence: result.avg_confidence,
      },
      details: result.scores.map(s => {
        const q = questions.find((q: any) => q.id === s.question_id);
        return {
          question_text: q?.question_text,
          category: q?.category,
          is_correct: s.is_correct,
          confidence_level: s.confidence_level,
          cbm_score: s.cbm_score,
        };
      }),
      grade_submitted: gradeSubmitted,
    });
  } catch (err: any) {
    console.error('Answer submission error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Admin: Get Oral Questions (tutor-only) ──

router.get('/oral/:submission_id', async (req: Request, res: Response) => {
  const db = getDB();
  const questions = db.prepare(`
    SELECT id, question_text, options AS expected_points, topic
    FROM assessment_questions
    WHERE submission_id = ? AND is_oral = 1
    ORDER BY question_order
  `).all(req.params.submission_id) as any[];

  res.json({
    questions: questions.map(q => ({
      ...q,
      expected_points: JSON.parse(q.expected_points || '[]'),
    })),
  });
});

// ── Admin: Activate Tutorial Assessment ──

router.post('/activate', async (req: Request, res: Response) => {
  const { submission_id, activated_by } = req.body;
  const db = getDB();

  const result = db.prepare(`
    UPDATE deferred_assessments
    SET status = 'available', available_at = CURRENT_TIMESTAMP,
      activated_by = ?, activated_at = CURRENT_TIMESTAMP
    WHERE submission_id = ? AND timing_mode = 'tutorial' AND status = 'pending'
  `).run(activated_by || 'admin', submission_id);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'No pending tutorial assessment found' });
  }
  res.json({ success: true, message: 'Assessment activated for student' });
});

export default router;
