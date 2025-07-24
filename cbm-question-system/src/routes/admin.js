const express = require('express');
const Joi = require('joi');
const { getDatabase } = require('../models/database');

const router = express.Router();

const bulkQuestionSchema = Joi.object({
  questions: Joi.array().items(
    Joi.object({
      question_text: Joi.string().required().min(10),
      question_type: Joi.string().valid('multiple_choice', 'true_false', 'short_answer', 'essay', 'fill_blank').required(),
      correct_answer: Joi.string().required(),
      options: Joi.array().items(Joi.string()).optional(),
      complexity_level: Joi.number().integer().min(1).max(10).required(),
      topic: Joi.string().optional(),
      subtopic: Joi.string().optional(),
      keywords: Joi.array().items(Joi.string()).optional()
    })
  ).min(1).required(),
  created_by: Joi.string().required()
});

router.post('/questions/bulk', async (req, res, next) => {
  try {
    const { error, value } = bulkQuestionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: 'Validation Error', details: error.details });
    }

    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO question_bank 
      (question_text, question_type, correct_answer, options, complexity_level, topic, subtopic, keywords, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const results = [];
    let processed = 0;

    for (const question of value.questions) {
      try {
        const questionId = await new Promise((resolve, reject) => {
          stmt.run([
            question.question_text,
            question.question_type,
            question.correct_answer,
            JSON.stringify(question.options || []),
            question.complexity_level,
            question.topic || null,
            question.subtopic || null,
            JSON.stringify(question.keywords || []),
            value.created_by
          ], function(err) {
            if (err) {
              reject(err);
            } else {
              resolve(this.lastID);
            }
          });
        });

        results.push({ success: true, questionId, questionText: question.question_text });
        processed++;
      } catch (err) {
        results.push({ success: false, error: err.message, questionText: question.question_text });
      }
    }

    stmt.finalize();

    res.json({
      success: true,
      processed,
      total: value.questions.length,
      results
    });

  } catch (error) {
    next(error);
  }
});

router.get('/statistics', async (req, res, next) => {
  try {
    const db = getDatabase();

    const questionStats = await new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          question_type,
          complexity_level,
          COUNT(*) as count,
          topic
        FROM question_bank 
        WHERE is_active = 1
        GROUP BY question_type, complexity_level, topic
        ORDER BY complexity_level, question_type
      `, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });

    const assessmentStats = await new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          status,
          COUNT(*) as count,
          DATE(created_at) as date
        FROM assessments
        GROUP BY status, DATE(created_at)
        ORDER BY date DESC
        LIMIT 30
      `, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });

    const llmUsage = await new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          provider,
          request_type,
          COUNT(*) as request_count,
          AVG(processing_time) as avg_processing_time,
          SUM(tokens_used) as total_tokens
        FROM llm_requests
        WHERE created_at >= datetime('now', '-7 days')
        GROUP BY provider, request_type
        ORDER BY request_count DESC
      `, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });

    const totalCounts = await new Promise((resolve, reject) => {
      db.get(`
        SELECT 
          (SELECT COUNT(*) FROM question_bank WHERE is_active = 1) as total_questions,
          (SELECT COUNT(*) FROM assessments) as total_assessments,
          (SELECT COUNT(DISTINCT student_id) FROM student_responses) as total_students,
          (SELECT COUNT(*) FROM student_responses) as total_responses
      `, [], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });

    res.json({
      overview: totalCounts,
      questionBank: questionStats,
      assessmentActivity: assessmentStats,
      llmUsage: llmUsage.map(usage => ({
        ...usage,
        avg_processing_time: parseFloat((usage.avg_processing_time || 0).toFixed(2))
      }))
    });

  } catch (error) {
    next(error);
  }
});

router.get('/question-bank/export', async (req, res, next) => {
  try {
    const { format = 'json', complexity, topic } = req.query;
    const db = getDatabase();

    let query = "SELECT * FROM question_bank WHERE is_active = 1";
    const params = [];

    if (complexity) {
      query += " AND complexity_level = ?";
      params.push(parseInt(complexity));
    }

    if (topic) {
      query += " AND (topic LIKE ? OR subtopic LIKE ?)";
      params.push(`%${topic}%`, `%${topic}%`);
    }

    query += " ORDER BY complexity_level, topic, created_at";

    const questions = await new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          const formattedQuestions = rows.map(row => ({
            ...row,
            options: row.options ? JSON.parse(row.options) : [],
            keywords: row.keywords ? JSON.parse(row.keywords) : []
          }));
          resolve(formattedQuestions);
        }
      });
    });

    if (format === 'csv') {
      const csv = convertToCSV(questions);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="question_bank.csv"');
      res.send(csv);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="question_bank.json"');
      res.json(questions);
    }

  } catch (error) {
    next(error);
  }
});

router.put('/cbm-rules/:confidenceLevel', async (req, res, next) => {
  try {
    const { confidenceLevel } = req.params;
    const { correctScore, incorrectScore, description } = req.body;

    if (!correctScore || !incorrectScore) {
      return res.status(400).json({ error: 'correctScore and incorrectScore are required' });
    }

    const db = getDatabase();
    const result = await new Promise((resolve, reject) => {
      db.run(`
        UPDATE cbm_scoring_rules 
        SET correct_score = ?, incorrect_score = ?, description = ?
        WHERE confidence_level = ?
      `, [correctScore, incorrectScore, description, confidenceLevel], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });

    if (result === 0) {
      return res.status(404).json({ error: 'CBM rule not found for this confidence level' });
    }

    res.json({ success: true, message: 'CBM scoring rule updated successfully' });

  } catch (error) {
    next(error);
  }
});

router.get('/cbm-rules', async (req, res, next) => {
  try {
    const db = getDatabase();
    
    const rules = await new Promise((resolve, reject) => {
      db.all("SELECT * FROM cbm_scoring_rules ORDER BY confidence_level", [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });

    res.json(rules);

  } catch (error) {
    next(error);
  }
});

function convertToCSV(questions) {
  const headers = [
    'id', 'question_text', 'question_type', 'correct_answer', 'options',
    'complexity_level', 'topic', 'subtopic', 'keywords', 'created_by', 'created_at'
  ];

  const csvRows = [headers.join(',')];

  questions.forEach(q => {
    const row = [
      q.id,
      `"${q.question_text.replace(/"/g, '""')}"`,
      q.question_type,
      `"${q.correct_answer.replace(/"/g, '""')}"`,
      `"${Array.isArray(q.options) ? q.options.join(';') : ''}"`,
      q.complexity_level,
      q.topic || '',
      q.subtopic || '',
      `"${Array.isArray(q.keywords) ? q.keywords.join(';') : ''}"`,
      q.created_by || '',
      q.created_at || ''
    ];
    csvRows.push(row.join(','));
  });

  return csvRows.join('\n');
}

module.exports = router;