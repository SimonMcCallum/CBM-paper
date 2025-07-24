const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('../models/database');
const { preprocessContent } = require('./pdfService');
const { generateQuestions } = require('./llmService');

async function createAssessment(data) {
  const assessmentId = uuidv4();
  const db = getDatabase();
  
  try {
    const processedContent = await preprocessContent(data.content);
    
    const assessment = {
      id: assessmentId,
      originalName: data.originalName,
      filename: data.filename,
      content: data.content,
      analysis: data.analysis,
      processedContent,
      questions: []
    };

    await saveAssessmentToDatabase(assessment);
    
    const bankQuestions = await findMatchingQuestions(processedContent, data.difficulty);
    
    const generatedQuestions = await generateQuestions(
      data.content,
      data.analysis,
      {
        provider: data.llmProvider,
        difficulty: data.difficulty,
        questionCount: Math.max(0, data.questionCount - bankQuestions.length),
        assessmentId
      }
    );
    
    assessment.questions = [
      ...bankQuestions.map(q => ({ ...q, source: 'bank' })),
      ...generatedQuestions.map(q => ({ ...q, source: 'generated' }))
    ];
    
    await saveQuestionsToDatabase(assessmentId, assessment.questions);
    
    await updateAssessmentStatus(assessmentId, 'completed');
    
    return assessment;
    
  } catch (error) {
    await updateAssessmentStatus(assessmentId, 'failed');
    throw error;
  }
}

async function saveAssessmentToDatabase(assessment) {
  const db = getDatabase();
  
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      INSERT INTO assessments (id, original_filename, stored_filename, content_summary, topics, complexity_analysis, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run([
      assessment.id,
      assessment.originalName,
      assessment.filename,
      assessment.analysis?.summary || '',
      JSON.stringify(assessment.analysis?.topics || []),
      JSON.stringify(assessment.processedContent || {}),
      'processing'
    ], function(err) {
      if (err) {
        reject(err);
      } else {
        resolve(this.lastID);
      }
    });
    
    stmt.finalize();
  });
}

async function findMatchingQuestions(content, targetDifficulty) {
  const db = getDatabase();
  
  return new Promise((resolve, reject) => {
    const difficultyRange = 2;
    const minDifficulty = Math.max(1, targetDifficulty - difficultyRange);
    const maxDifficulty = Math.min(10, targetDifficulty + difficultyRange);
    
    db.all(`
      SELECT * FROM question_bank 
      WHERE complexity_level BETWEEN ? AND ? 
      AND is_active = 1
      ORDER BY ABS(complexity_level - ?) ASC
      LIMIT 5
    `, [minDifficulty, maxDifficulty, targetDifficulty], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        const matchedQuestions = rows.filter(question => {
          return checkTopicMatch(content, question) || checkKeywordMatch(content, question);
        });
        
        resolve(matchedQuestions.slice(0, 3));
      }
    });
  });
}

function checkTopicMatch(content, question) {
  if (!question.topic || !content.topics) return false;
  
  const questionTopic = question.topic.toLowerCase();
  const contentTopics = content.topics.map(t => t.topic.toLowerCase());
  
  return contentTopics.some(topic => 
    topic.includes(questionTopic) || questionTopic.includes(topic)
  );
}

function checkKeywordMatch(content, question) {
  if (!question.keywords || !content.keywords) return false;
  
  try {
    const questionKeywords = JSON.parse(question.keywords).map(k => k.toLowerCase());
    const contentKeywords = content.keywords.map(k => k.toLowerCase());
    
    const matches = questionKeywords.filter(qk => 
      contentKeywords.some(ck => ck.includes(qk) || qk.includes(ck))
    );
    
    return matches.length >= 2;
  } catch (error) {
    return false;
  }
}

async function saveQuestionsToDatabase(assessmentId, questions) {
  const db = getDatabase();
  
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      INSERT INTO assessment_questions 
      (assessment_id, question_id, generated_question, question_type, correct_answer, options, complexity_level, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    let processed = 0;
    
    questions.forEach(question => {
      const questionData = [
        assessmentId,
        question.id || null,
        question.question_text || question.generated_question,
        question.question_type,
        question.correct_answer,
        JSON.stringify(question.options || []),
        question.complexity_level || 5,
        question.source
      ];
      
      stmt.run(questionData, function(err) {
        if (err) {
          reject(err);
          return;
        }
        
        processed++;
        if (processed === questions.length) {
          stmt.finalize();
          resolve();
        }
      });
    });
    
    if (questions.length === 0) {
      stmt.finalize();
      resolve();
    }
  });
}

async function updateAssessmentStatus(assessmentId, status) {
  const db = getDatabase();
  
  return new Promise((resolve, reject) => {
    db.run(
      "UPDATE assessments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [status, assessmentId],
      function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      }
    );
  });
}

async function getAssessment(assessmentId) {
  const db = getDatabase();
  
  return new Promise((resolve, reject) => {
    db.get(
      "SELECT * FROM assessments WHERE id = ?",
      [assessmentId],
      async (err, assessment) => {
        if (err) {
          reject(err);
          return;
        }
        
        if (!assessment) {
          resolve(null);
          return;
        }
        
        try {
          const questions = await getAssessmentQuestions(assessmentId);
          assessment.questions = questions;
          
          if (assessment.topics) {
            assessment.topics = JSON.parse(assessment.topics);
          }
          if (assessment.complexity_analysis) {
            assessment.complexity_analysis = JSON.parse(assessment.complexity_analysis);
          }
          
          resolve(assessment);
        } catch (questionError) {
          reject(questionError);
        }
      }
    );
  });
}

async function getAssessmentQuestions(assessmentId) {
  const db = getDatabase();
  
  return new Promise((resolve, reject) => {
    db.all(
      "SELECT * FROM assessment_questions WHERE assessment_id = ? ORDER BY id",
      [assessmentId],
      (err, rows) => {
        if (err) {
          reject(err);
        } else {
          const questions = rows.map(row => ({
            ...row,
            options: row.options ? JSON.parse(row.options) : []
          }));
          resolve(questions);
        }
      }
    );
  });
}

async function calculateCBMScore(isCorrect, confidenceLevel) {
  const db = getDatabase();
  
  return new Promise((resolve, reject) => {
    db.get(
      "SELECT * FROM cbm_scoring_rules WHERE confidence_level = ?",
      [confidenceLevel],
      (err, rule) => {
        if (err) {
          reject(err);
        } else if (!rule) {
          resolve(0);
        } else {
          const score = isCorrect ? rule.correct_score : rule.incorrect_score;
          resolve(score);
        }
      }
    );
  });
}

async function submitResponse(assessmentId, questionId, answer, confidenceLevel, studentId) {
  const db = getDatabase();
  
  const question = await getQuestionById(questionId);
  if (!question) {
    throw new Error('Question not found');
  }
  
  const isCorrect = checkAnswer(question, answer);
  const cbmScore = await calculateCBMScore(isCorrect, confidenceLevel);
  
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      INSERT INTO student_responses 
      (assessment_id, question_id, student_id, answer, confidence_level, is_correct, cbm_score)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run([
      assessmentId,
      questionId,
      studentId,
      answer,
      confidenceLevel,
      isCorrect,
      cbmScore
    ], function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({
          id: this.lastID,
          isCorrect,
          cbmScore,
          confidenceLevel
        });
      }
    });
    
    stmt.finalize();
  });
}

async function getQuestionById(questionId) {
  const db = getDatabase();
  
  return new Promise((resolve, reject) => {
    db.get(
      "SELECT * FROM assessment_questions WHERE id = ?",
      [questionId],
      (err, row) => {
        if (err) {
          reject(err);
        } else {
          if (row && row.options) {
            row.options = JSON.parse(row.options);
          }
          resolve(row);
        }
      }
    );
  });
}

function checkAnswer(question, answer) {
  if (!question.correct_answer) return false;
  
  const correctAnswer = question.correct_answer.toLowerCase().trim();
  const userAnswer = answer.toLowerCase().trim();
  
  switch (question.question_type) {
    case 'multiple_choice':
    case 'true_false':
      return correctAnswer === userAnswer;
    case 'short_answer':
      return correctAnswer === userAnswer || 
             correctAnswer.includes(userAnswer) || 
             userAnswer.includes(correctAnswer);
    case 'essay':
      return false;
    default:
      return false;
  }
}

module.exports = {
  createAssessment,
  getAssessment,
  getAssessmentQuestions,
  submitResponse,
  calculateCBMScore
};