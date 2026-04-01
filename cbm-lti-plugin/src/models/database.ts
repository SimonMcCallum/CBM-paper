/**
 * SQLite database wrapper with migration support.
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

let db: Database.Database | null = null;

export function getDB(): Database.Database {
  if (!db) {
    const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../data/cbm-lti.db');
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

export function runMigrations(): void {
  const database = getDB();
  const migrationsDir = path.join(__dirname, '../../migrations');

  // Track applied migrations
  database.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const applied = new Set(
    database.prepare('SELECT name FROM _migrations').all()
      .map((r: any) => r.name)
  );

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (applied.has(file)) continue;

    console.log(`Applying migration: ${file}`);
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    database.exec(sql);
    database.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file);
  }
}

export function closeDB(): void {
  if (db) {
    db.close();
    db = null;
  }
}
