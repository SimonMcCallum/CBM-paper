const express = require('express');
const Joi = require('joi');
const { getAssessment, submitResponse } = require('../services/assessmentService');

const router = express.Router();

const responseSchema = Joi.object({
  questionId: Joi.number().integer().required(),
  answer: Joi.string().required(),
  confidenceLevel: Joi.number().integer().min(1).max(5).required(),
  studentId: Joi.string().required(),
  timeSpent: Joi.number().integer().min(0).optional()
});

router.get('/:assessmentId', async (req, res, next) => {
  try {
    const { assessmentId } = req.params;
    const assessment = await getAssessment(assessmentId);

    if (!assessment) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    const publicAssessment = {
      id: assessment.id,
      originalFilename: assessment.original_filename,
      status: assessment.status,
      createdAt: assessment.created_at,
      questions: assessment.questions.map(q => ({
        id: q.id,
        questionText: q.generated_question || q.question_text,
        questionType: q.question_type,
        options: q.options || [],
        complexityLevel: q.complexity_level,
        source: q.source
      }))
    };

    res.json(publicAssessment);

  } catch (error) {
    next(error);
  }
});

router.post('/:assessmentId/responses', async (req, res, next) => {
  try {
    const { assessmentId } = req.params;
    const { error, value } = responseSchema.validate(req.body);

    if (error) {
      return res.status(400).json({ error: 'Validation Error', details: error.details });
    }

    const assessment = await getAssessment(assessmentId);
    if (!assessment) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    const response = await submitResponse(
      assessmentId,
      value.questionId,
      value.answer,
      value.confidenceLevel,
      value.studentId
    );

    res.json({
      success: true,
      responseId: response.id,
      isCorrect: response.isCorrect,
      cbmScore: response.cbmScore,
      confidenceLevel: response.confidenceLevel
    });

  } catch (error) {
    next(error);
  }
});

router.get('/:assessmentId/results/:studentId', async (req, res, next) => {
  try {
    const { assessmentId, studentId } = req.params;
    const { getDatabase } = require('../models/database');
    const db = getDatabase();

    const responses = await new Promise((resolve, reject) => {
      db.all(`
        SELECT sr.*, aq.generated_question, aq.correct_answer, aq.question_type
        FROM student_responses sr
        JOIN assessment_questions aq ON sr.question_id = aq.id
        WHERE sr.assessment_id = ? AND sr.student_id = ?
        ORDER BY sr.id
      `, [assessmentId, studentId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });

    if (responses.length === 0) {
      return res.status(404).json({ error: 'No responses found for this student' });
    }

    const totalScore = responses.reduce((sum, r) => sum + r.cbm_score, 0);
    const maxPossibleScore = responses.length * 1.0;
    const percentage = (totalScore / maxPossibleScore) * 100;

    const confidenceAnalysis = responses.reduce((acc, r) => {
      acc[r.confidence_level] = (acc[r.confidence_level] || 0) + 1;
      return acc;
    }, {});

    const correctAnswers = responses.filter(r => r.is_correct).length;

    res.json({
      assessmentId,
      studentId,
      totalQuestions: responses.length,
      correctAnswers,
      totalScore: parseFloat(totalScore.toFixed(2)),
      maxPossibleScore,
      percentage: parseFloat(percentage.toFixed(2)),
      confidenceAnalysis,
      responses: responses.map(r => ({
        questionId: r.question_id,
        questionText: r.generated_question,
        studentAnswer: r.answer,
        correctAnswer: r.correct_answer,
        isCorrect: r.is_correct,
        confidenceLevel: r.confidence_level,
        cbmScore: r.cbm_score,
        timeSpent: r.time_spent
      }))
    });

  } catch (error) {
    next(error);
  }
});

router.get('/:assessmentId/statistics', async (req, res, next) => {
  try {
    const { assessmentId } = req.params;
    const { getDatabase } = require('../models/database');
    const db = getDatabase();

    const stats = await new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          COUNT(DISTINCT student_id) as total_students,
          AVG(cbm_score) as avg_score,
          AVG(CASE WHEN is_correct = 1 THEN 1.0 ELSE 0.0 END) as accuracy_rate,
          AVG(confidence_level) as avg_confidence,
          COUNT(*) as total_responses
        FROM student_responses 
        WHERE assessment_id = ?
      `, [assessmentId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows[0]);
        }
      });
    });

    const confidenceBreakdown = await new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          confidence_level,
          COUNT(*) as count,
          AVG(CASE WHEN is_correct = 1 THEN 1.0 ELSE 0.0 END) as accuracy,
          AVG(cbm_score) as avg_cbm_score
        FROM student_responses 
        WHERE assessment_id = ?
        GROUP BY confidence_level
        ORDER BY confidence_level
      `, [assessmentId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });

    res.json({
      assessmentId,
      overview: {
        totalStudents: stats.total_students || 0,
        totalResponses: stats.total_responses || 0,
        averageScore: parseFloat((stats.avg_score || 0).toFixed(2)),
        accuracyRate: parseFloat(((stats.accuracy_rate || 0) * 100).toFixed(2)),
        averageConfidence: parseFloat((stats.avg_confidence || 0).toFixed(2))
      },
      confidenceBreakdown: confidenceBreakdown.map(cb => ({
        confidenceLevel: cb.confidence_level,
        responseCount: cb.count,
        accuracy: parseFloat((cb.accuracy * 100).toFixed(2)),
        averageCBMScore: parseFloat(cb.avg_cbm_score.toFixed(2))
      }))
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router;