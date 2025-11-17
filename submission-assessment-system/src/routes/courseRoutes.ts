/**
 * API routes for course management
 */

import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import config from '../config';
import * as courseService from '../services/courseService';
import { APIResponse } from '../types';
import { ValidationError } from '../utils/errors';
import logger from '../utils/logger';

const router = express.Router();
const routeLogger = logger.child({ module: 'courseRoutes' });

// Ensure upload directory exists
const uploadDir = path.join(config.upload.dir, 'course-materials');
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
    const allowedTypes = ['application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new ValidationError('Invalid file type. Only PDF, TXT, and DOCX are allowed.'));
    }
  },
});

// ============================================================================
// Course Routes
// ============================================================================

/**
 * GET /api/courses
 * Get all courses
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const courses = await courseService.getAllCourseOverviews(includeInactive);

    const response: APIResponse = {
      success: true,
      data: courses,
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
 * GET /api/courses/:id
 * Get course by ID
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const course = await courseService.getCourseById(req.params.id);

    const response: APIResponse = {
      success: true,
      data: course,
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
 * GET /api/courses/:id/overview
 * Get course overview with statistics
 */
router.get('/:id/overview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const overview = await courseService.getCourseOverview(req.params.id);

    const response: APIResponse = {
      success: true,
      data: overview,
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
 * POST /api/courses
 * Create a new course
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const course = await courseService.createCourse(req.body);

    const response: APIResponse = {
      success: true,
      data: course,
      meta: {
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      },
    };

    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/courses/:id
 * Update a course
 */
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const course = await courseService.updateCourse(req.params.id, req.body);

    const response: APIResponse = {
      success: true,
      data: course,
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
 * DELETE /api/courses/:id
 * Delete a course
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await courseService.deleteCourse(req.params.id);

    const response: APIResponse = {
      success: true,
      data: { message: 'Course deleted successfully' },
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

// ============================================================================
// Course Material Routes
// ============================================================================

/**
 * GET /api/courses/:id/materials
 * Get all materials for a course
 */
router.get('/:id/materials', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const materials = await courseService.getCourseMaterials(req.params.id);

    const response: APIResponse = {
      success: true,
      data: materials,
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
 * POST /api/courses/:id/materials
 * Upload a new course material
 */
router.post(
  '/:id/materials',
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw new ValidationError('No file uploaded');
      }

      const fileInfo = {
        originalName: req.file.originalname,
        storedName: req.file.filename,
        type: req.file.mimetype,
        size: req.file.size,
      };

      const materialData = {
        title: req.body.title || req.file.originalname,
        description: req.body.description,
        material_type: req.body.material_type || 'other',
        display_order: req.body.display_order ? parseInt(req.body.display_order) : undefined,
        visible: req.body.visible !== 'false',
      };

      const material = await courseService.createCourseMaterial(
        req.params.id,
        materialData,
        fileInfo
      );

      // TODO: Trigger async processing of the material
      // - Extract text
      // - Generate embeddings
      // - Update processing status

      const response: APIResponse = {
        success: true,
        data: material,
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
 * DELETE /api/courses/:courseId/materials/:materialId
 * Delete a course material
 */
router.delete(
  '/:courseId/materials/:materialId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get material to find stored file
      const material = await courseService.getMaterialById(req.params.materialId);

      // Delete from database
      await courseService.deleteCourseMaterial(req.params.materialId);

      // Delete file
      const filePath = path.join(uploadDir, material.stored_filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      const response: APIResponse = {
        success: true,
        data: { message: 'Material deleted successfully' },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/courses/:id/materials/status
 * Get processing status summary for course materials
 */
router.get('/:id/materials/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = await courseService.getMaterialProcessingStatus(req.params.id);

    const response: APIResponse = {
      success: true,
      data: status,
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

// ============================================================================
// Configuration Routes
// ============================================================================

/**
 * GET /api/courses/:id/config/novelty
 * Get novelty detection config
 */
router.get('/:id/config/novelty', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const config = await courseService.getNoveltyConfig(req.params.id);

    const response: APIResponse = {
      success: true,
      data: config,
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
 * PUT /api/courses/:id/config/novelty
 * Update novelty detection config
 */
router.put('/:id/config/novelty', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const config = await courseService.updateNoveltyConfig(req.params.id, req.body);

    const response: APIResponse = {
      success: true,
      data: config,
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
 * GET /api/courses/:id/config/questions
 * Get question generation config
 */
router.get('/:id/config/questions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const config = await courseService.getQuestionConfig(req.params.id);

    const response: APIResponse = {
      success: true,
      data: config,
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
 * PUT /api/courses/:id/config/questions
 * Update question generation config
 */
router.put('/:id/config/questions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const config = await courseService.updateQuestionConfig(req.params.id, req.body);

    const response: APIResponse = {
      success: true,
      data: config,
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
