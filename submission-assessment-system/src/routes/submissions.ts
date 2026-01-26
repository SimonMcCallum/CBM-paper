/**
 * Submissions routes
 */

import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import { getDatabase } from '../models/database';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { upload } from '../middleware/upload';
import config from '../config';
import logger from '../utils/logger';

const router = Router();
const submissionLogger = logger.child({ module: 'submissions' });

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * GET /api/submissions
 * Get all submissions for the authenticated user
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const db = getDatabase();

    const submissions = await db.query(
      `SELECT
        id, student_id, course_id, assignment_id,
        original_filename, file_type, file_size,
        status, error_message,
        created_at, analyzed_at, completed_at
      FROM submissions
      WHERE student_id = ?
      ORDER BY created_at DESC`,
      [userId]
    );

    return res.json({
      success: true,
      data: submissions,
      meta: { timestamp: new Date().toISOString(), version: '1.0.0' },
    });
  } catch (error) {
    submissionLogger.error('Failed to fetch submissions', { error });
    return res.status(500).json({
      success: false,
      error: { code: 'FETCH_ERROR', message: 'Failed to fetch submissions' },
    });
  }
});

/**
 * GET /api/submissions/:id
 * Get a specific submission
 */
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const db = getDatabase();

    const submission = await db.get(
      `SELECT * FROM submissions WHERE id = ? AND student_id = ?`,
      [id, userId]
    );

    if (!submission) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Submission not found' },
      });
    }

    return res.json({
      success: true,
      data: submission,
      meta: { timestamp: new Date().toISOString(), version: '1.0.0' },
    });
  } catch (error) {
    submissionLogger.error('Failed to fetch submission', { error });
    return res.status(500).json({
      success: false,
      error: { code: 'FETCH_ERROR', message: 'Failed to fetch submission' },
    });
  }
});

/**
 * POST /api/submissions
 * Upload a new submission
 */
router.post('/', upload.single('file'), async (req: AuthRequest, res: Response) => {
  let submissionId: string | null = null;

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_FILE', message: 'No file uploaded' },
      });
    }

    const userId = req.user!.userId;
    const { courseId = 'default-course', assignmentId = 'default-assignment' } = req.body;

    submissionId = uuidv4();
    const db = getDatabase();

    submissionLogger.info('Creating submission', {
      submissionId,
      userId,
      filename: req.file.originalname,
    });

    // Create submission record
    await db.run(
      `INSERT INTO submissions (
        id, student_id, course_id, assignment_id,
        original_filename, stored_filename, file_type, file_size,
        status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        submissionId,
        userId,
        courseId,
        assignmentId,
        req.file.originalname,
        req.file.filename,
        req.file.mimetype,
        req.file.size,
        'uploaded',
      ]
    );

    // Start novelty analysis in background (don't await)
    analyzeSubmission(submissionId, req.file.path, req.file.filename).catch((error) => {
      submissionLogger.error('Novelty analysis failed', { submissionId, error });
    });

    return res.status(201).json({
      success: true,
      data: {
        id: submissionId,
        originalFilename: req.file.originalname,
        fileSize: req.file.size,
        status: 'uploaded',
        message: 'File uploaded successfully. Analysis in progress.',
      },
      meta: { timestamp: new Date().toISOString(), version: '1.0.0' },
    });
  } catch (error) {
    submissionLogger.error('Submission upload failed', { error, submissionId });

    // Clean up file if submission failed
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    return res.status(500).json({
      success: false,
      error: { code: 'UPLOAD_ERROR', message: 'Failed to process submission' },
    });
  }
});

/**
 * Analyze submission for novelty (background task)
 */
async function analyzeSubmission(submissionId: string, filePath: string, filename: string) {
  const db = getDatabase();

  try {
    submissionLogger.info('Starting novelty analysis', { submissionId });

    // Update status to analyzing
    await db.run(
      'UPDATE submissions SET status = ? WHERE id = ?',
      ['analyzing', submissionId]
    );

    // Call novelty detector service
    const formData = new FormData();
    formData.append('file', fs.createReadStream(filePath), filename);

    const response = await axios.post(
      `${config.noveltyDetector.url}/upload`,
      formData,
      {
        headers: formData.getHeaders(),
        timeout: 300000, // 5 minutes
      }
    );

    submissionLogger.info('Novelty analysis complete', {
      submissionId,
      status: response.status,
    });

    // Update submission with analysis results
    await db.run(
      `UPDATE submissions SET
        status = ?,
        novelty_scores = ?,
        analyzed_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [
        'ready',
        JSON.stringify(response.data.novelty_scores || []),
        submissionId,
      ]
    );

    submissionLogger.info('Submission ready for assessment', { submissionId });
  } catch (error: any) {
    submissionLogger.error('Novelty analysis error', {
      submissionId,
      error: error.message,
      response: error.response?.data,
    });

    // Update submission status to error
    await db.run(
      `UPDATE submissions SET
        status = ?,
        error_message = ?
      WHERE id = ?`,
      ['error', error.message || 'Analysis failed', submissionId]
    );
  }
}

/**
 * DELETE /api/submissions/:id
 * Delete a submission
 */
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const db = getDatabase();

    // Get submission to find file
    const submission = await db.get<any>(
      'SELECT stored_filename FROM submissions WHERE id = ? AND student_id = ?',
      [id, userId]
    );

    if (!submission) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Submission not found' },
      });
    }

    // Delete file
    const filePath = path.join(config.upload.dir, submission.stored_filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete from database
    await db.run('DELETE FROM submissions WHERE id = ?', [id]);

    submissionLogger.info('Submission deleted', { id, userId });

    return res.json({
      success: true,
      data: { message: 'Submission deleted successfully' },
      meta: { timestamp: new Date().toISOString(), version: '1.0.0' },
    });
  } catch (error) {
    submissionLogger.error('Failed to delete submission', { error });
    return res.status(500).json({
      success: false,
      error: { code: 'DELETE_ERROR', message: 'Failed to delete submission' },
    });
  }
});

export default router;
