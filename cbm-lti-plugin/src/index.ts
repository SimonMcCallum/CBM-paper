/**
 * CBM LTI Plugin — Main Entry Point
 *
 * Two systems in one server:
 * - System 1: CBM Quiz Runner (import QTI quiz → present with confidence → grade)
 * - System 2: Submission Validator (PDF → FAISS match + generate MCQs → deferred quiz → grade)
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import { runMigrations, getDB } from './models/database';
import { setupLTI } from './lti/setup';
import quizRoutes from './routes/quiz';
import validatorRoutes from './routes/validator';

dotenv.config();

const PORT = parseInt(process.env.PORT || '3000');

async function main() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Static files
  app.use(express.static(path.join(__dirname, '../public')));

  // Run database migrations
  console.log('Running database migrations...');
  runMigrations();

  // Health check (before LTI middleware)
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      service: 'CBM LTI Plugin',
      version: '1.0.0',
      systems: ['quiz_runner', 'submission_validator'],
    });
  });

  // API routes (before LTI to avoid auth on these)
  app.use('/api/quiz', quizRoutes);
  app.use('/api/validator', validatorRoutes);

  // Scoring info endpoint (public)
  app.get('/api/scoring-table', (req, res) => {
    const { getScoringTable } = require('./services/scoring');
    const model = (req.query.model as string) || 'hlcc';
    const levels = parseInt(req.query.levels as string) || 3;
    res.json({ scoring_table: getScoringTable(model, levels) });
  });

  // Launch router — checks assignment config and routes student to correct UI
  app.get('/launch', (req, res) => {
    const configId = req.query.config_id as string;
    const db = getDB();

    if (configId) {
      const config = db.prepare('SELECT tool_mode FROM assignment_config WHERE id = ?').get(configId) as any;
      if (config?.tool_mode === 'submission_validator') {
        return res.sendFile(path.join(__dirname, '../public/validator.html'));
      }
    }
    // Default to quiz runner
    res.sendFile(path.join(__dirname, '../public/quiz.html'));
  });

  // Admin pages
  app.get('/admin/setup', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/admin-setup.html'));
  });
  app.get('/admin/deeplink', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/admin-deeplink.html'));
  });

  // Setup LTI 1.3 (must be after routes that don't need LTI auth)
  try {
    await setupLTI(app);
    console.log('LTI 1.3 initialized');
  } catch (err) {
    console.warn('LTI setup skipped (MongoDB may not be available):', (err as Error).message);
    console.warn('Running in standalone mode — LTI features disabled');
  }

  // Start server
  app.listen(PORT, () => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`  CBM LTI Plugin running on http://localhost:${PORT}`);
    console.log(`${'='.repeat(60)}`);
    console.log(`  System 1 — Quiz Runner:       /api/quiz/*`);
    console.log(`  System 2 — Submission Validator: /api/validator/*`);
    console.log(`  Health:                        /health`);
    console.log(`  Scoring Info:                  /api/scoring-table`);
    console.log(`  LTI Launch:                    /launch`);
    console.log(`${'='.repeat(60)}\n`);
  });
}

main().catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});
