/**
 * Express application setup
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import config from './config';
import logger, { createModuleLogger } from './utils/logger';
import { AppError } from './utils/errors';
import { APIResponse } from './types';

const appLogger = createModuleLogger('app');

/**
 * Create and configure Express application
 */
export function createApp(): Express {
  const app = express();

  // =========================================================================
  // Security Middleware
  // =========================================================================
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
  }));

  // =========================================================================
  // CORS Configuration
  // =========================================================================
  app.use(cors({
    origin: config.server.nodeEnv === 'production'
      ? process.env.ALLOWED_ORIGINS?.split(',') || []
      : '*',
    credentials: true,
  }));

  // =========================================================================
  // Request Parsing
  // =========================================================================
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // =========================================================================
  // Logging Middleware
  // =========================================================================
  app.use(morgan('combined', {
    stream: {
      write: (message: string) => appLogger.http(message.trim()),
    },
  }));

  // =========================================================================
  // Static Files
  // =========================================================================
  app.use('/static', express.static(path.join(__dirname, '../public')));

  // =========================================================================
  // Health Check
  // =========================================================================
  app.get('/health', (req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.server.nodeEnv,
    });
  });

  // =========================================================================
  // API Routes
  // =========================================================================

  // Import routes
  import courseRoutes from './routes/courseRoutes';
  import mockSubmissionRoutes from './routes/mockSubmissionRoutes';

  // Mount routes
  app.use('/api/courses', courseRoutes);
  app.use('/api/mock', mockSubmissionRoutes);

  // TODO: Additional routes when implemented
  // app.use('/lti', ltiRoutes);
  // app.use('/api/questions', questionRoutes);
  // app.use('/api/assessments', assessmentRoutes);
  // app.use('/api/exports', exportRoutes);

  // API info endpoint
  app.get('/api', (req: Request, res: Response) => {
    const response: APIResponse = {
      success: true,
      data: {
        message: 'CBM Submission Assessment System API',
        version: '1.0.0',
        documentation: '/api/docs',
        endpoints: {
          courses: '/api/courses',
          mockSubmissions: '/api/mock',
        },
      },
      meta: {
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      },
    };
    res.json(response);
  });

  // =========================================================================
  // Error Handling
  // =========================================================================

  // 404 Handler
  app.use((req: Request, res: Response) => {
    const response: APIResponse = {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Route not found: ${req.method} ${req.path}`,
      },
      meta: {
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      },
    };
    res.status(404).json(response);
  });

  // Global Error Handler
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    // Log error
    appLogger.error('Error handling request', {
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
    });

    // Determine status code and error response
    let statusCode = 500;
    let errorCode = 'INTERNAL_ERROR';
    let errorMessage = 'An internal server error occurred';
    let errorDetails: any = undefined;

    if (err instanceof AppError) {
      statusCode = err.statusCode;
      errorCode = err.code;
      errorMessage = err.message;
      errorDetails = err.details;
    } else if (err.name === 'ValidationError') {
      statusCode = 400;
      errorCode = 'VALIDATION_ERROR';
      errorMessage = err.message;
    } else if (err.name === 'UnauthorizedError') {
      statusCode = 401;
      errorCode = 'UNAUTHORIZED';
      errorMessage = 'Invalid or missing authentication token';
    }

    // Send error response
    const response: APIResponse = {
      success: false,
      error: {
        code: errorCode,
        message: errorMessage,
        details: config.server.nodeEnv === 'development' ? errorDetails : undefined,
      },
      meta: {
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      },
    };

    // Include stack trace in development
    if (config.server.nodeEnv === 'development' && err.stack) {
      response.error!.details = {
        ...response.error!.details,
        stack: err.stack.split('\n'),
      };
    }

    res.status(statusCode).json(response);
  });

  return app;
}

export default createApp;
