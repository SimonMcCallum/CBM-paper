/**
 * Mock submission routes - for testing without LTI
 */

import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import config from '../config';
import { APIResponse } from '../types';
import { ValidationError } from '../utils/errors';
import logger from '../utils/logger';
import { getDatabase } from '../models/database';

const router = express.Router();
const routeLogger = logger.child({ module: 'mockSubmissionRoutes' });

// Ensure upload directory exists
const uploadDir = path.join(config.upload.dir, 'submissions');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `${uuidv4()}${ext}`;
    cb(null, filename);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: config.upload.maxFileSizeMB * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new ValidationError('Only PDF files are allowed for submissions'));
    }
  },
});

// ============================================================================
// Mock Submission Routes
// ============================================================================

/**
 * POST /api/mock/submit
 * Submit a PDF for assessment (mock version without LTI)
 */
router.post(
  '/submit',
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw new ValidationError('No file uploaded');
      }

      const { courseId, studentId, studentName } = req.body;

      if (!courseId) {
        throw new ValidationError('Course ID is required');
      }

      if (!studentId) {
        throw new ValidationError('Student ID is required');
      }

      // Create mock LTI launch record
      const db = getDatabase();
      const launchId = uuidv4();
      const submissionId = uuidv4();

      await db.run(
        `INSERT INTO lti_launches (id, platform_id, user_id, context_id, roles, launch_data)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          launchId,
          'mock-platform',
          studentId,
          courseId,
          JSON.stringify(['Student']),
          JSON.stringify({ mock: true, studentName: studentName || 'Test Student' }),
        ]
      );

      // Create submission record
      await db.run(
        `INSERT INTO submissions (
          id, lti_launch_id, student_id, course_id, assignment_id,
          original_filename, stored_filename, file_type, file_size,
          status, course_ref
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          submissionId,
          launchId,
          studentId,
          courseId,
          'mock-assignment',
          req.file.originalname,
          req.file.filename,
          'pdf',
          req.file.size,
          'uploaded',
          courseId, // For mock courses, course_ref = course_id
        ]
      );

      routeLogger.info('Mock submission created', {
        submissionId,
        courseId,
        studentId,
        filename: req.file.originalname,
      });

      // TODO: Trigger async processing
      // - Extract text from PDF
      // - Run novelty detection against course materials
      // - Generate questions
      // - Create assessment

      const response: APIResponse = {
        success: true,
        data: {
          submissionId,
          message: 'Submission uploaded successfully. Processing will begin shortly.',
          status: 'uploaded',
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      };

      res.status(201).json(response);
    } catch (error) {
      // Clean up uploaded file on error
      if (req.file) {
        fs.unlink(req.file.path, (err) => {
          if (err) routeLogger.error('Failed to delete uploaded file', { error: err });
        });
      }
      next(error);
    }
  }
);

/**
 * GET /api/mock/submissions/:id/status
 * Check submission processing status
 */
router.get('/submissions/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDatabase();

    const submission = await db.get<any>(
      'SELECT id, status, error_message, created_at, analyzed_at, completed_at FROM submissions WHERE id = ?',
      [req.params.id]
    );

    if (!submission) {
      const response: APIResponse = {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Submission not found',
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      };
      return res.status(404).json(response);
    }

    const response: APIResponse = {
      success: true,
      data: {
        id: submission.id,
        status: submission.status,
        error_message: submission.error_message,
        created_at: submission.created_at,
        analyzed_at: submission.analyzed_at,
        completed_at: submission.completed_at,
      },
      meta: {
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      },
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/mock/submissions/:id
 * Get full submission details
 */
router.get('/submissions/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDatabase();

    const submission = await db.get<any>(
      `SELECT s.*, c.code as course_code, c.name as course_name
       FROM submissions s
       LEFT JOIN courses c ON s.course_ref = c.id
       WHERE s.id = ?`,
      [req.params.id]
    );

    if (!submission) {
      const response: APIResponse = {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Submission not found',
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      };
      return res.status(404).json(response);
    }

    // Parse JSON fields
    const data = {
      ...submission,
      novelty_scores: submission.novelty_scores ? JSON.parse(submission.novelty_scores) : null,
      novel_sections: submission.novel_sections ? JSON.parse(submission.novel_sections) : null,
      standard_sections: submission.standard_sections ? JSON.parse(submission.standard_sections) : null,
      topics: submission.topics ? JSON.parse(submission.topics) : null,
      complexity_analysis: submission.complexity_analysis ? JSON.parse(submission.complexity_analysis) : null,
      embedding_ids: submission.embedding_ids ? JSON.parse(submission.embedding_ids) : null,
    };

    const response: APIResponse = {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      },
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/mock/courses/:courseId/submissions
 * Get all submissions for a course
 */
router.get('/courses/:courseId/submissions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDatabase();

    const submissions = await db.query<any>(
      `SELECT id, student_id, original_filename, status, created_at, completed_at
       FROM submissions
       WHERE course_ref = ?
       ORDER BY created_at DESC`,
      [req.params.courseId]
    );

    const response: APIResponse = {
      success: true,
      data: submissions,
      meta: {
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      },
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

export default router;
