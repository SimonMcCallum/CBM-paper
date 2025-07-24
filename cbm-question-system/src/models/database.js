const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = process.env.DATABASE_PATH || './database/cbm_system.db';

let db;

function initializeDatabase() {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        reject(err);
        return;
      }
      
      console.log('Connected to SQLite database');
      createTables()
        .then(resolve)
        .catch(reject);
    });
  });
}

function createTables() {
  return new Promise((resolve, reject) => {
    const tables = [
      `CREATE TABLE IF NOT EXISTS question_bank (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        question_text TEXT NOT NULL,
        question_type TEXT NOT NULL CHECK(question_type IN ('multiple_choice', 'true_false', 'short_answer', 'essay', 'fill_blank')),
        correct_answer TEXT,
        options TEXT, -- JSON array for multiple choice
        complexity_level INTEGER NOT NULL CHECK(complexity_level BETWEEN 1 AND 10),
        topic TEXT,
        subtopic TEXT,
        keywords TEXT, -- JSON array
        created_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT 1
      )`,
      
      `CREATE TABLE IF NOT EXISTS assessments (
        id TEXT PRIMARY KEY,
        original_filename TEXT NOT NULL,
        stored_filename TEXT NOT NULL,
        content_summary TEXT,
        topics TEXT, -- JSON array
        complexity_analysis TEXT, -- JSON object
        status TEXT DEFAULT 'processing' CHECK(status IN ('processing', 'completed', 'failed')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      `CREATE TABLE IF NOT EXISTS assessment_questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        assessment_id TEXT NOT NULL,
        question_id INTEGER,
        generated_question TEXT,
        question_type TEXT NOT NULL,
        correct_answer TEXT,
        options TEXT, -- JSON array
        complexity_level INTEGER,
        confidence_required BOOLEAN DEFAULT 1,
        source TEXT CHECK(source IN ('bank', 'generated')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (assessment_id) REFERENCES assessments(id),
        FOREIGN KEY (question_id) REFERENCES question_bank(id)
      )`,
      
      `CREATE TABLE IF NOT EXISTS student_responses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        assessment_id TEXT NOT NULL,
        question_id INTEGER NOT NULL,
        student_id TEXT,
        answer TEXT,
        confidence_level INTEGER CHECK(confidence_level BETWEEN 1 AND 5),
        time_spent INTEGER, -- seconds
        is_correct BOOLEAN,
        cbm_score REAL, -- Confidence-Based Marking score
        submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (assessment_id) REFERENCES assessments(id),
        FOREIGN KEY (question_id) REFERENCES assessment_questions(id)
      )`,
      
      `CREATE TABLE IF NOT EXISTS cbm_scoring_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        confidence_level INTEGER NOT NULL CHECK(confidence_level BETWEEN 1 AND 5),
        correct_score REAL NOT NULL,
        incorrect_score REAL NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      `CREATE TABLE IF NOT EXISTS llm_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        assessment_id TEXT,
        provider TEXT NOT NULL,
        request_type TEXT NOT NULL CHECK(request_type IN ('analysis', 'question_generation', 'content_matching')),
        prompt TEXT,
        response TEXT,
        tokens_used INTEGER,
        cost REAL,
        processing_time INTEGER, -- milliseconds
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (assessment_id) REFERENCES assessments(id)
      )`
    ];

    let completed = 0;
    
    tables.forEach((tableSQL, index) => {
      db.run(tableSQL, (err) => {
        if (err) {
          reject(err);
          return;
        }
        
        completed++;
        if (completed === tables.length) {
          insertDefaultCBMRules()
            .then(resolve)
            .catch(reject);
        }
      });
    });
  });
}

function insertDefaultCBMRules() {
  return new Promise((resolve, reject) => {
    const defaultRules = [
      { confidence_level: 1, correct_score: 0.2, incorrect_score: -0.1, description: "Very Low Confidence" },
      { confidence_level: 2, correct_score: 0.4, incorrect_score: -0.2, description: "Low Confidence" },
      { confidence_level: 3, correct_score: 0.6, incorrect_score: -0.4, description: "Medium Confidence" },
      { confidence_level: 4, correct_score: 0.8, incorrect_score: -0.6, description: "High Confidence" },
      { confidence_level: 5, correct_score: 1.0, incorrect_score: -1.0, description: "Very High Confidence" }
    ];

    db.get("SELECT COUNT(*) as count FROM cbm_scoring_rules", (err, row) => {
      if (err) {
        reject(err);
        return;
      }

      if (row.count === 0) {
        const stmt = db.prepare(`
          INSERT INTO cbm_scoring_rules (confidence_level, correct_score, incorrect_score, description)
          VALUES (?, ?, ?, ?)
        `);

        let inserted = 0;
        defaultRules.forEach(rule => {
          stmt.run([rule.confidence_level, rule.correct_score, rule.incorrect_score, rule.description], (err) => {
            if (err) {
              reject(err);
              return;
            }
            
            inserted++;
            if (inserted === defaultRules.length) {
              stmt.finalize();
              resolve();
            }
          });
        });
      } else {
        resolve();
      }
    });
  });
}

function getDatabase() {
  return db;
}

function closeDatabase() {
  return new Promise((resolve) => {
    if (db) {
      db.close((err) => {
        if (err) {
          console.error('Error closing database:', err);
        }
        resolve();
      });
    } else {
      resolve();
    }
  });
}

module.exports = {
  initializeDatabase,
  getDatabase,
  closeDatabase
};