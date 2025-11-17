/**
 * Custom error classes for the application
 */

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code: string = 'INTERNAL_ERROR',
    public details?: any
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    const message = id ? `${resource} not found: ${id}` : `${resource} not found`;
    super(message, 404, 'NOT_FOUND');
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

export class LTIError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, 'LTI_ERROR', details);
  }
}

export class FileUploadError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, 'FILE_UPLOAD_ERROR', details);
  }
}

export class NoveltyDetectorError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 500, 'NOVELTY_DETECTOR_ERROR', details);
  }
}

export class LLMError extends AppError {
  constructor(message: string, provider: string, details?: any) {
    super(message, 500, 'LLM_ERROR', { provider, ...details });
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 500, 'DATABASE_ERROR', details);
  }
}
