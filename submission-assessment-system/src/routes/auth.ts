import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../models/database';
import config from '../config';
import logger from '../utils/logger';

const router = Router();
const authLogger = logger.child({ module: 'auth' });

interface User {
  id: string;
  email: string;
  name: string;
  role: 'student' | 'admin' | 'staff';
  avatar?: string;
}

// Register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name, role = 'student' } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Email, password, and name are required' },
      });
    }

    const db = getDatabase();

    // Check if user exists
    const existing = await db.get('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
      return res.status(400).json({
        success: false,
        error: { code: 'USER_EXISTS', message: 'User already exists' },
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, config.security.bcryptRounds);
    const userId = uuidv4();

    // Create user
    await db.run(
      'INSERT INTO users (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)',
      [userId, email, passwordHash, name, role]
    );

    // Generate token
    const token = jwt.sign(
      { userId, email, role },
      config.security.jwtSecret,
      { expiresIn: '7d' }
    );

    const user: User = { id: userId, email, name, role };

    authLogger.info('User registered', { userId, email, role });

    return res.json({
      success: true,
      data: { user, token },
      meta: { timestamp: new Date().toISOString(), version: '1.0.0' },
    });
  } catch (error) {
    authLogger.error('Registration error', { error });
    return res.status(500).json({
      success: false,
      error: { code: 'REGISTRATION_ERROR', message: 'Registration failed' },
    });
  }
});

// Login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Email and password are required' },
      });
    }

    const db = getDatabase();
    const userRow = await db.get<any>(
      'SELECT id, email, password_hash, name, role, avatar FROM users WHERE email = ?',
      [email]
    );

    if (!userRow || !userRow.password_hash) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' },
      });
    }

    // Verify password
    const valid = await bcrypt.compare(password, userRow.password_hash);
    if (!valid) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' },
      });
    }

    // Update last login
    await db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [userRow.id]);

    // Generate token
    const token = jwt.sign(
      { userId: userRow.id, email: userRow.email, role: userRow.role },
      config.security.jwtSecret,
      { expiresIn: '7d' }
    );

    const user: User = {
      id: userRow.id,
      email: userRow.email,
      name: userRow.name,
      role: userRow.role,
      avatar: userRow.avatar,
    };

    authLogger.info('User logged in', { userId: user.id, email: user.email });

    return res.json({
      success: true,
      data: { user, token },
      meta: { timestamp: new Date().toISOString(), version: '1.0.0' },
    });
  } catch (error) {
    authLogger.error('Login error', { error });
    return res.status(500).json({
      success: false,
      error: { code: 'LOGIN_ERROR', message: 'Login failed' },
    });
  }
});

// Google OAuth (placeholder - requires Google OAuth library setup)
router.post('/google', async (_req: Request, res: Response) => {
  try {
    // TODO: Implement Google OAuth verification
    // For now, return error
    return res.status(501).json({
      success: false,
      error: { code: 'NOT_IMPLEMENTED', message: 'Google OAuth not yet implemented' },
    });
  } catch (error) {
    authLogger.error('Google auth error', { error });
    return res.status(500).json({
      success: false,
      error: { code: 'AUTH_ERROR', message: 'Google authentication failed' },
    });
  }
});

export default router;
