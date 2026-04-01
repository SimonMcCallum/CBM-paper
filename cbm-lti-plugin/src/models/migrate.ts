/**
 * Standalone migration runner.
 * Usage: npx tsx src/models/migrate.ts
 */

import { runMigrations, closeDB } from './database';

console.log('Running migrations...');
runMigrations();
console.log('Done.');
closeDB();
