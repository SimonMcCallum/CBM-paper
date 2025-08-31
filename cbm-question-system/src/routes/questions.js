const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const Joi = require('joi');
const { getDatabase } = require('../models/database');
const QTIParser = require('../services/qtiParser');

const router = express.Router();

// Configure multer for QTI file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'qti-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: function (req, file, cb) {
    // Accept QTI files (.xml, .qti) and zip files
    const allowedTypes = ['.xml', '.qti', '.zip'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only XML, QTI, and ZIP files are allowed.'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

const questionSchema = Joi.object({
  question_text: Joi.string().required().min(10),
  question_type: Joi.string().valid('multiple_choice', 'true_false', 'short_answer', 'essay', 'fill_blank').required(),
  correct_answer: Joi.string().required(),
  options: Joi.array().items(Joi.string()).when('question_type', {
    is: 'multiple_choice',
    then: Joi.required().min(2),
    otherwise: Joi.optional()
  }),
  complexity_level: Joi.number().integer().min(1).max(10).required(),
  topic: Joi.string().optional(),
  subtopic: Joi.string().optional(),
  keywords: Joi.array().items(Joi.string()).optional(),
  created_by: Joi.string().optional()
});

router.post('/', async (req, res, next) => {
  try {
    const { error, value } = questionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: 'Validation Error', details: error.details });
    }

    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO question_bank 
      (question_text, question_type, correct_answer, options, complexity_level, topic, subtopic, keywords, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const questionId = await new Promise((resolve, reject) => {
      stmt.run([
        value.question_text,
        value.question_type,
        value.correct_answer,
        JSON.stringify(value.options || []),
        value.complexity_level,
        value.topic || null,
        value.subtopic || null,
        JSON.stringify(value.keywords || []),
        value.created_by || 'system'
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
    });

    stmt.finalize();

    res.status(201).json({
      success: true,
      questionId,
      message: 'Question added to bank successfully'
    });

  } catch (error) {
    next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const { complexity, topic, type, limit = 50, offset = 0 } = req.query;
    
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

    if (type) {
      query += " AND question_type = ?";
      params.push(type);
    }

    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    params.push(parseInt(limit), parseInt(offset));

    const db = getDatabase();
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

    res.json({
      questions,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: questions.length
      }
    });

  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    const question = await new Promise((resolve, reject) => {
      db.get("SELECT * FROM question_bank WHERE id = ? AND is_active = 1", [id], (err, row) => {
        if (err) {
          reject(err);
        } else {
          if (row) {
            row.options = row.options ? JSON.parse(row.options) : [];
            row.keywords = row.keywords ? JSON.parse(row.keywords) : [];
          }
          resolve(row);
        }
      });
    });

    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    res.json(question);

  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { error, value } = questionSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({ error: 'Validation Error', details: error.details });
    }

    const db = getDatabase();
    const result = await new Promise((resolve, reject) => {
      db.run(`
        UPDATE question_bank 
        SET question_text = ?, question_type = ?, correct_answer = ?, options = ?, 
            complexity_level = ?, topic = ?, subtopic = ?, keywords = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND is_active = 1
      `, [
        value.question_text,
        value.question_type,
        value.correct_answer,
        JSON.stringify(value.options || []),
        value.complexity_level,
        value.topic || null,
        value.subtopic || null,
        JSON.stringify(value.keywords || []),
        id
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });

    if (result === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }

    res.json({ success: true, message: 'Question updated successfully' });

  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    const result = await new Promise((resolve, reject) => {
      db.run(
        "UPDATE question_bank SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [id],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.changes);
          }
        }
      );
    });

    if (result === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }

    res.json({ success: true, message: 'Question deactivated successfully' });

  } catch (error) {
    next(error);
  }
});

// Upload QTI file and parse questions
router.post('/upload-qti', upload.single('qtiFile'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const filePath = req.file.path;
    const fileContent = await fs.readFile(filePath, 'utf8');
    
    const parser = new QTIParser();
    const parsedQuestions = await parser.parseQTI(fileContent);
    
    const savedQuestions = [];
    const errors = [];
    const db = getDatabase();
    
    for (const questionData of parsedQuestions) {
      // Validate question
      const validationErrors = parser.validateQuestion(questionData);
      if (validationErrors.length > 0) {
        errors.push({
          question: questionData.question_text ? questionData.question_text.substring(0, 50) + '...' : 'Unknown',
          errors: validationErrors
        });
        continue;
      }
      
      // Convert to database format
      const dbQuestion = parser.convertToDBFormat(questionData);
      
      // Save question to database
      try {
        const stmt = db.prepare(`
          INSERT INTO question_bank 
          (question_text, question_type, correct_answer, options, complexity_level, topic, subtopic, keywords, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const questionId = await new Promise((resolve, reject) => {
          stmt.run([
            dbQuestion.question_text,
            dbQuestion.question_type,
            dbQuestion.correct_answer,
            JSON.stringify(dbQuestion.options || []),
            dbQuestion.complexity_level,
            dbQuestion.topic || null,
            dbQuestion.subtopic || null,
            JSON.stringify(dbQuestion.keywords || []),
            dbQuestion.created_by
          ], function(err) {
            if (err) {
              reject(err);
            } else {
              resolve(this.lastID);
            }
          });
        });

        stmt.finalize();
        
        savedQuestions.push({
          id: questionId,
          question_text: dbQuestion.question_text.substring(0, 100) + '...',
          question_type: dbQuestion.question_type,
          complexity_level: dbQuestion.complexity_level
        });
      } catch (dbError) {
        errors.push({
          question: questionData.question_text ? questionData.question_text.substring(0, 50) + '...' : 'Unknown',
          errors: [dbError.message]
        });
      }
    }
    
    // Clean up uploaded file
    try {
      await fs.unlink(filePath);
    } catch (unlinkError) {
      console.error('Failed to delete uploaded file:', unlinkError);
    }

    res.json({
      success: true,
      message: `Successfully imported ${savedQuestions.length} questions from QTI file`,
      imported: savedQuestions.length,
      total_parsed: parsedQuestions.length,
      errors: errors,
      questions: savedQuestions.slice(0, 10) // Return first 10 for preview
    });
    
  } catch (error) {
    // Clean up uploaded file on error
    if (req.file && req.file.path) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.error('Failed to delete uploaded file:', unlinkError);
      }
    }
    
    next(error);
  }
});

// Add rating to question
router.post('/:id/ratings', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rating, feedback, reviewer_name } = req.body;
    
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }
    
    const db = getDatabase();
    
    // Check if question exists
    const question = await new Promise((resolve, reject) => {
      db.get("SELECT id FROM question_bank WHERE id = ? AND is_active = 1", [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }
    
    // Create ratings table if it doesn't exist
    db.run(`
      CREATE TABLE IF NOT EXISTS question_ratings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        question_id INTEGER NOT NULL,
        rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
        feedback TEXT,
        reviewer_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (question_id) REFERENCES question_bank(id)
      )
    `);
    
    // Insert rating
    const stmt = db.prepare(`
      INSERT INTO question_ratings (question_id, rating, feedback, reviewer_name)
      VALUES (?, ?, ?, ?)
    `);

    const ratingId = await new Promise((resolve, reject) => {
      stmt.run([id, rating, feedback || null, reviewer_name || 'Anonymous'], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
    });

    stmt.finalize();
    
    // Get updated average rating
    const avgRating = await new Promise((resolve, reject) => {
      db.get(`
        SELECT AVG(rating) as average_rating, COUNT(*) as total_ratings 
        FROM question_ratings WHERE question_id = ?
      `, [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    res.json({
      success: true,
      message: 'Rating added successfully',
      rating_id: ratingId,
      average_rating: avgRating.average_rating ? parseFloat(avgRating.average_rating).toFixed(2) : 0,
      total_ratings: avgRating.total_ratings
    });

  } catch (error) {
    next(error);
  }
});

// Get question ratings
router.get('/:id/ratings', async (req, res, next) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    
    const ratings = await new Promise((resolve, reject) => {
      db.all(`
        SELECT rating, feedback, reviewer_name, created_at,
               AVG(rating) OVER() as average_rating,
               COUNT(*) OVER() as total_ratings
        FROM question_ratings 
        WHERE question_id = ? 
        ORDER BY created_at DESC
      `, [id], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    const response = {
      question_id: parseInt(id),
      average_rating: ratings.length > 0 ? parseFloat(ratings[0].average_rating).toFixed(2) : 0,
      total_ratings: ratings.length > 0 ? ratings[0].total_ratings : 0,
      ratings: ratings.map(r => ({
        rating: r.rating,
        feedback: r.feedback,
        reviewer_name: r.reviewer_name,
        created_at: r.created_at
      }))
    };

    res.json(response);

  } catch (error) {
    next(error);
  }
});

module.exports = router;
