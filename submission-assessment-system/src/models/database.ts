/**
 * Database connection and initialization
 */

import sqlite3 from 'better-sqlite3';
import { Pool } from 'pg';
import path from 'path';
import fs from 'fs';
import config from '../config';
import logger from '../utils/logger';
import { DatabaseError } from '../utils/errors';

const dbLogger = logger.child({ module: 'database' });

/**
 * Database connection interface
 */
export interface Database {
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  get<T = any>(sql: string, params?: any[]): Promise<T | undefined>;
  run(sql: string, params?: any[]): Promise<{ lastID?: number; changes?: number }>;
  close(): Promise<void>;
}

/**
 * SQLite database implementation
 */
class SQLiteDatabase implements Database {
  private db: sqlite3.Database;

  constructor(dbPath: string) {
    // Ensure directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    dbLogger.info(`Connecting to SQLite database at ${dbPath}`);
    this.db = sqlite3(dbPath);

    // Enable foreign keys
    this.db.pragma('foreign_keys = ON');

    dbLogger.info('SQLite database connected');
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    try {
      const stmt = this.db.prepare(sql);
      const results = stmt.all(...params) as T[];
      return results;
    } catch (error) {
      dbLogger.error('Query error', { sql, error });
      throw new DatabaseError(`Query failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  async get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
    try {
      const stmt = this.db.prepare(sql);
      const result = stmt.get(...params) as T | undefined;
      return result;
    } catch (error) {
      dbLogger.error('Get error', { sql, error });
      throw new DatabaseError(`Get failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  async run(sql: string, params: any[] = []): Promise<{ lastID?: number; changes?: number }> {
    try {
      const stmt = this.db.prepare(sql);
      const info = stmt.run(...params);
      return {
        lastID: info.lastInsertRowid as number,
        changes: info.changes,
      };
    } catch (error) {
      dbLogger.error('Run error', { sql, error });
      throw new DatabaseError(`Run failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  async close(): Promise<void> {
    dbLogger.info('Closing SQLite database');
    this.db.close();
  }
}

/**
 * PostgreSQL database implementation
 */
class PostgreSQLDatabase implements Database {
  private pool: Pool;

  constructor() {
    dbLogger.info('Connecting to PostgreSQL database');

    this.pool = new Pool({
      host: config.database.host,
      port: config.database.port,
      database: config.database.name,
      user: config.database.user,
      password: config.database.password,
      max: config.database.poolSize,
    });

    this.pool.on('error', (err) => {
      dbLogger.error('PostgreSQL pool error', { error: err.message });
    });

    dbLogger.info('PostgreSQL database connected');
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(sql, params);
      return result.rows as T[];
    } catch (error) {
      dbLogger.error('Query error', { sql, error });
      throw new DatabaseError(`Query failed: ${error instanceof Error ? error.message : error}`);
    } finally {
      client.release();
    }
  }

  async get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
    const results = await this.query<T>(sql, params);
    return results[0];
  }

  async run(sql: string, params: any[] = []): Promise<{ lastID?: number; changes?: number }> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(sql, params);
      return {
        changes: result.rowCount || 0,
      };
    } catch (error) {
      dbLogger.error('Run error', { sql, error });
      throw new DatabaseError(`Run failed: ${error instanceof Error ? error.message : error}`);
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    dbLogger.info('Closing PostgreSQL database');
    await this.pool.end();
  }
}

/**
 * Create database connection based on configuration
 */
export function createDatabase(): Database {
  if (config.database.type === 'sqlite') {
    return new SQLiteDatabase(config.database.path!);
  } else {
    return new PostgreSQLDatabase();
  }
}

// Export singleton database instance
let dbInstance: Database | null = null;

export function getDatabase(): Database {
  if (!dbInstance) {
    dbInstance = createDatabase();
  }
  return dbInstance;
}

export async function closeDatabase(): Promise<void> {
  if (dbInstance) {
    await dbInstance.close();
    dbInstance = null;
  }
}

export default getDatabase;
