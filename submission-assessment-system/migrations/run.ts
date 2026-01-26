/**
 * Database migration runner
 */

import fs from 'fs';
import path from 'path';
import { getDatabase } from '../src/models/database';
import logger from '../src/utils/logger';

const migrationLogger = logger.child({ module: 'migration' });

interface Migration {
  id: number;
  filename: string;
  sql: string;
}

/**
 * Create migrations table if it doesn't exist
 */
async function ensureMigrationsTable() {
  const db = getDatabase();

  await db.run(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY,
      filename TEXT NOT NULL,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  migrationLogger.info('Migrations table ensured');
}

/**
 * Get list of applied migrations
 */
async function getAppliedMigrations(): Promise<number[]> {
  const db = getDatabase();

  const results = await db.query<{ id: number }>(
    'SELECT id FROM migrations ORDER BY id'
  );

  return results.map(r => r.id);
}

/**
 * Load migration files
 */
function loadMigrationFiles(): Migration[] {
  const migrationsDir = __dirname;
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  const migrations: Migration[] = [];

  for (const filename of files) {
    // Extract migration ID from filename (e.g., 001_initial_schema.sql)
    const match = filename.match(/^(\d+)_/);
    if (!match) {
      migrationLogger.warn(`Skipping invalid migration filename: ${filename}`);
      continue;
    }

    const id = parseInt(match[1], 10);
    const sql = fs.readFileSync(path.join(migrationsDir, filename), 'utf-8');

    migrations.push({ id, filename, sql });
  }

  return migrations;
}

/**
 * Apply a migration
 */
async function applyMigration(migration: Migration) {
  const db = getDatabase();

  migrationLogger.info(`Applying migration ${migration.id}: ${migration.filename}`);

  // Use exec() if available (SQLite), otherwise fall back to statement-by-statement
  if (db.exec) {
    try {
      await db.exec(migration.sql);
    } catch (error) {
      migrationLogger.error(`Failed to execute migration ${migration.id}`, {
        error,
      });
      throw error;
    }
  } else {
    // Split SQL into individual statements (simple approach)
    // Note: This won't handle complex cases with semicolons in strings
    const statements = migration.sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    // Execute each statement
    for (const statement of statements) {
      try {
        await db.run(statement);
      } catch (error) {
        migrationLogger.error(`Failed to execute statement in migration ${migration.id}`, {
          error,
          statement: statement.substring(0, 200),
        });
        throw error;
      }
    }
  }

  // Record migration as applied
  await db.run(
    'INSERT INTO migrations (id, filename) VALUES (?, ?)',
    [migration.id, migration.filename]
  );

  migrationLogger.info(`Migration ${migration.id} applied successfully`);
}

/**
 * Run all pending migrations
 */
async function runMigrations() {
  try {
    migrationLogger.info('Starting database migrations');

    // Ensure migrations table exists
    await ensureMigrationsTable();

    // Get applied migrations
    const appliedMigrations = await getAppliedMigrations();
    migrationLogger.info(`Applied migrations: ${appliedMigrations.join(', ') || 'none'}`);

    // Load migration files
    const allMigrations = loadMigrationFiles();
    migrationLogger.info(`Found ${allMigrations.length} migration files`);

    // Filter to pending migrations
    const pendingMigrations = allMigrations.filter(
      m => !appliedMigrations.includes(m.id)
    );

    if (pendingMigrations.length === 0) {
      migrationLogger.info('No pending migrations');
      return;
    }

    migrationLogger.info(`Applying ${pendingMigrations.length} pending migrations`);

    // Apply each pending migration
    for (const migration of pendingMigrations) {
      await applyMigration(migration);
    }

    migrationLogger.info('All migrations completed successfully');

  } catch (error) {
    migrationLogger.error('Migration failed', { error });
    throw error;
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  runMigrations()
    .then(() => {
      migrationLogger.info('Migration process completed');
      process.exit(0);
    })
    .catch((error) => {
      migrationLogger.error('Migration process failed', { error });
      process.exit(1);
    });
}

export { runMigrations };
