/**
 * Authentication middleware
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config';
import logger from '../utils/logger';

const authLogger = logger.child({ module: 'auth-middleware' });

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: 'student' | 'admin' | 'staff';
  };
}

/**
 * Middleware to verify JWT token and attach user to request
 */
export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    res.status(401).json({
      success: false,
      error: { code: 'NO_TOKEN', message: 'Authentication token required' },
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, config.security.jwtSecret) as {
      userId: string;
      email: string;
      role: 'student' | 'admin' | 'staff';
    };

    req.user = decoded;
    next();
  } catch (error) {
    authLogger.warn('Invalid token', { error });
    res.status(403).json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' },
    });
    return;
  }
};

/**
 * Middleware to check if user has required role
 */
export const requireRole = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient permissions' },
      });
      return;
    }

    next();
  };
};

export default authenticateToken;
