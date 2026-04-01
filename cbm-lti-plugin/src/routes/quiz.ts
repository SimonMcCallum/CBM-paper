/**
 * System 1: CBM Quiz Runner Routes
 *
 * Flow:
 * 1. Instructor imports QTI quiz via /api/quiz/import
 * 2. Student launches via LTI → /api/quiz/start
 * 3. Student submits answers + confidence → /api/quiz/submit
 * 4. Score calculated, grade sent to Canvas
 */

import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import multer from 'multer';
import path from 'path';
import { getDB } from '../models/database';
import { parseQTIZip } from '../services/qtiParser';
import { scoreAssessment, canvasGrade, getScoringTable, AnswerInput } from '../services/scoring';
import { submitGrade } from '../lti/setup';

const router = Router();
const upload = multer({
  dest: path.join(__dirname, '../../uploads/qti'),
  limits: { fileSize: 50 * 1024 * 1024 },
});

// ── Import QTI Quiz (instructor) ──

router.post('/import', upload.single('qti_file'), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    const { course_id, assignment_id, title, scoring_model, confidence_levels, max_grade_multiplier } = req.body;

    // Parse QTI
    const questions = await parseQTIZip(file.path);
    if (questions.length === 0) {
      return res.status(400).json({ error: 'No questions found in QTI file' });
    }

    const db = getDB();
    const configId = uuid();

    // Store assignment config
    db.prepare(`
      INSERT INTO assignment_config (id, course_id, assignment_id, tool_mode, title,
        qti_json, question_count, scoring_model, confidence_levels, max_grade_multiplier)
      VALUES (?, ?, ?, 'quiz_runner', ?, ?, ?, ?, ?, ?)
    `).run(
      configId,
      course_id || 'default',
      assignment_id || configId,
      title || 'CBM Quiz',
      JSON.stringify(questions),
      questions.length,
      scoring_model || 'hlcc',
      confidence_levels || 3,
      max_grade_multiplier || 1.5
    );

    // Also store questions in the question bank for System 2 reuse
    const insertQ = db.prepare(`
      INSERT INTO question_bank (id, course_id, question_text, question_type, options,
        correct_answer, topic, source, qti_identifier)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'imported', ?)
    `);

    for (const q of questions) {
      insertQ.run(
        uuid(), course_id || null, q.question_text, q.question_type,
        JSON.stringify(q.options), q.correct_answer, q.topic || null, q.qti_identifier
      );
    }

    res.json({
      success: true,
      config_id: configId,
      questions_imported: questions.length,
      questions: questions.map(q => ({
        text: q.question_text.substring(0, 100),
        type: q.question_type,
        options: q.options.length,
      })),
    });
  } catch (err: any) {
    console.error('QTI import error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Start Quiz Session (student) ──

router.post('/start', async (req: Request, res: Response) => {
  try {
    const { config_id, student_id, student_name, course_id, token_data } = req.body;

    const db = getDB();
    const config = db.prepare('SELECT * FROM assignment_config WHERE id = ?').get(config_id) as any;
    if (!config) return res.status(404).json({ error: 'Quiz not found' });

    // Check for existing active session
    const existing = db.prepare(`
      SELECT id FROM quiz_sessions
      WHERE assignment_config_id = ? AND student_id = ? AND status = 'active'
    `).get(config_id, student_id) as any;

    if (existing) {
      // Resume existing session
      const session = db.prepare('SELECT * FROM quiz_sessions WHERE id = ?').get(existing.id) as any;
      const questions = JSON.parse(session.questions_json);
      const scoringTable = getScoringTable(config.scoring_model, config.confidence_levels);

      return res.json({
        success: true,
        session_id: existing.id,
        resumed: true,
        questions: questions.map((q: any) => ({
          id: q.qti_identifier || q.id,
          question_text: q.question_text,
          question_type: q.question_type,
          options: q.options,
          // Never send correct_answer to client
        })),
        scoring_model: config.scoring_model,
        confidence_levels: config.confidence_levels,
        scoring_table: scoringTable,
        max_grade_multiplier: config.max_grade_multiplier,
      });
    }

    // Create new session
    const sessionId = uuid();
    const questions = JSON.parse(config.qti_json);

    // Shuffle question order for each student
    const shuffled = [...questions].sort(() => Math.random() - 0.5);

    db.prepare(`
      INSERT INTO quiz_sessions (id, assignment_config_id, student_id, student_name,
        course_id, questions_json, lti_token_data)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      sessionId, config_id, student_id, student_name || 'Student',
      course_id || config.course_id, JSON.stringify(shuffled),
      token_data ? JSON.stringify(token_data) : null
    );

    // Create assessment_questions records
    const insertAQ = db.prepare(`
      INSERT INTO assessment_questions (id, quiz_session_id, question_order,
        question_text, question_type, options, correct_answer, source, category)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'imported', 'standard')
    `);

    for (let i = 0; i < shuffled.length; i++) {
      const q = shuffled[i];
      insertAQ.run(
        uuid(), sessionId, i + 1,
        q.question_text, q.question_type,
        JSON.stringify(q.options), q.correct_answer
      );
    }

    const scoringTable = getScoringTable(config.scoring_model, config.confidence_levels);

    res.json({
      success: true,
      session_id: sessionId,
      resumed: false,
      questions: shuffled.map((q: any) => ({
        id: q.qti_identifier || q.id,
        question_text: q.question_text,
        question_type: q.question_type,
        options: q.options,
      })),
      scoring_model: config.scoring_model,
      confidence_levels: config.confidence_levels,
      scoring_table: scoringTable,
      max_grade_multiplier: config.max_grade_multiplier,
    });
  } catch (err: any) {
    console.error('Start quiz error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Submit Quiz (student) ──

router.post('/submit', async (req: Request, res: Response) => {
  try {
    const { session_id, answers } = req.body;
    // answers: Array<{ question_id, selected_answer, confidence_level }>

    if (!session_id || !answers || !Array.isArray(answers)) {
      return res.status(400).json({ error: 'session_id and answers[] required' });
    }

    const db = getDB();

    const session = db.prepare('SELECT * FROM quiz_sessions WHERE id = ?').get(session_id) as any;
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.status !== 'active') return res.status(400).json({ error: 'Session already submitted' });

    const config = db.prepare('SELECT * FROM assignment_config WHERE id = ?').get(session.assignment_config_id) as any;

    // Get assessment questions with correct answers
    const assessmentQs = db.prepare(`
      SELECT * FROM assessment_questions WHERE quiz_session_id = ? ORDER BY question_order
    `).all(session_id) as any[];

    // Grade each answer
    const scoringInputs: AnswerInput[] = [];
    const insertResponse = db.prepare(`
      INSERT INTO student_responses (id, assessment_question_id, student_id,
        selected_answer, is_correct, confidence_level, cbm_score)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const answer of answers) {
      const aq = assessmentQs.find((q: any) =>
        q.id === answer.question_id ||
        q.question_order === answer.question_order
      );
      if (!aq) continue;

      const isCorrect = aq.correct_answer === answer.selected_answer;
      scoringInputs.push({
        question_id: aq.id,
        is_correct: isCorrect,
        confidence_level: answer.confidence_level,
      });
    }

    // Calculate scores
    const result = scoreAssessment(
      scoringInputs,
      config.scoring_model,
      config.confidence_levels,
      config.max_grade_multiplier
    );

    // Save individual responses
    for (const score of result.scores) {
      const answer = answers.find((a: any) => {
        const aq = assessmentQs.find((q: any) => q.id === score.question_id);
        return aq && (a.question_id === aq.id || a.question_order === aq.question_order);
      });
      if (!answer) continue;

      insertResponse.run(
        uuid(), score.question_id, session.student_id,
        answer.selected_answer, score.is_correct ? 1 : 0,
        score.confidence_level, score.cbm_score
      );
    }

    // Update session
    db.prepare(`
      UPDATE quiz_sessions SET status = 'submitted', submitted_at = CURRENT_TIMESTAMP,
        raw_score = ?, max_possible = ?, normalized_score = ?
      WHERE id = ?
    `).run(result.raw_total, result.max_possible, result.normalized, session_id);

    // Grade passback to Canvas
    let gradeSubmitted = false;
    if (session.lti_token_data) {
      const tokenData = JSON.parse(session.lti_token_data);
      const grade = canvasGrade(result, result.num_questions, config.max_grade_multiplier);
      gradeSubmitted = await submitGrade(
        tokenData, grade.scoreGiven, grade.scoreMaximum, grade.comment
      );
      if (gradeSubmitted) {
        db.prepare('UPDATE quiz_sessions SET grade_submitted = 1 WHERE id = ?').run(session_id);
      }
    }

    // Build detailed results for student
    const detailedResults = result.scores.map(s => {
      const aq = assessmentQs.find((q: any) => q.id === s.question_id);
      return {
        question_text: aq?.question_text,
        is_correct: s.is_correct,
        confidence_level: s.confidence_level,
        cbm_score: s.cbm_score,
        correct_answer: aq?.correct_answer,
        explanation: aq?.explanation,
      };
    });

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
      details: detailedResults,
      scoring_table: getScoringTable(config.scoring_model, config.confidence_levels),
      grade_submitted: gradeSubmitted,
    });
  } catch (err: any) {
    console.error('Submit quiz error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Get Quiz Config (for setup page) ──

router.get('/config/:config_id', async (req: Request, res: Response) => {
  const db = getDB();
  const config = db.prepare('SELECT * FROM assignment_config WHERE id = ?').get(req.params.config_id) as any;
  if (!config) return res.status(404).json({ error: 'Not found' });

  const questions = config.qti_json ? JSON.parse(config.qti_json) : [];
  res.json({
    ...config,
    questions: questions.map((q: any) => ({
      text: q.question_text?.substring(0, 100),
      type: q.question_type,
      options: q.options?.length,
    })),
  });
});

// ── List configs for a course ──

router.get('/configs/:course_id', async (req: Request, res: Response) => {
  const db = getDB();
  const configs = db.prepare(
    "SELECT id, title, tool_mode, question_count, scoring_model, created_at FROM assignment_config WHERE course_id = ? ORDER BY created_at DESC"
  ).all(req.params.course_id);
  res.json({ configs });
});

export default router;
