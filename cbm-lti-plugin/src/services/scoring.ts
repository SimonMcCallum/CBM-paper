/**
 * CBM Scoring Service
 *
 * Implements two scoring models:
 * 1. HLCC (Continuous): correct = 1 + c, incorrect = -2c²
 * 2. Discrete CBM (3-level): lookup table
 *
 * The 1.5x max grade design:
 * - Canvas scoreMaximum = multiplier * N (default 1.5 * N)
 * - Raw HLCC range per question: [-2, +2]
 * - A student scoring 1.5N raw gets 100%
 * - A student scoring 2N raw gets capped at 100% (or extra credit)
 * - This gives a 0.5x buffer per question for recovery from bad questions
 */

import { ScoringModel, ScoreResult, AssessmentResult, ScoringRule } from '../types';

// ── HLCC Scoring ──

/** Map discrete confidence level (1-3 or 1-5) to continuous c value [0, 1]. */
function confidenceToC(level: number, maxLevels: number): number {
  if (maxLevels <= 1) return 0;
  return (level - 1) / (maxLevels - 1);
}

/** HLCC score for a single question. */
function hlccScore(isCorrect: boolean, confidenceLevel: number, maxLevels: number = 3): number {
  const c = confidenceToC(confidenceLevel, maxLevels);
  if (isCorrect) {
    return 1 + c;             // Range: [1.0, 2.0]
  } else {
    return -2 * c * c;        // Range: [0.0, -2.0]
  }
}

// ── Discrete CBM Scoring ──

const DEFAULT_RULES: ScoringRule[] = [
  { confidence_level: 1, correct_score: 1.0, incorrect_score: 0.0, label: 'Low' },
  { confidence_level: 2, correct_score: 1.5, incorrect_score: -0.5, label: 'Medium' },
  { confidence_level: 3, correct_score: 2.0, incorrect_score: -2.0, label: 'High' },
];

function discreteScore(isCorrect: boolean, confidenceLevel: number, rules?: ScoringRule[]): number {
  const table = rules || DEFAULT_RULES;
  const rule = table.find(r => r.confidence_level === confidenceLevel);
  if (!rule) {
    // Fall back to level 1 (safest)
    return isCorrect ? 1.0 : 0.0;
  }
  return isCorrect ? rule.correct_score : rule.incorrect_score;
}

// ── Public API ──

export interface AnswerInput {
  question_id: string;
  is_correct: boolean;
  confidence_level: number;
}

/**
 * Score a complete assessment.
 *
 * @param answers - Array of {question_id, is_correct, confidence_level}
 * @param model - 'hlcc' or 'discrete_cbm'
 * @param confidenceLevels - Number of confidence levels (3 or 5)
 * @param maxGradeMultiplier - Canvas max = multiplier * numQuestions (default 1.5)
 * @param rules - Custom scoring rules (discrete mode only)
 */
export function scoreAssessment(
  answers: AnswerInput[],
  model: ScoringModel = 'hlcc',
  confidenceLevels: number = 3,
  maxGradeMultiplier: number = 1.5,
  rules?: ScoringRule[]
): AssessmentResult {
  const scores: ScoreResult[] = answers.map(a => {
    const score = model === 'hlcc'
      ? hlccScore(a.is_correct, a.confidence_level, confidenceLevels)
      : discreteScore(a.is_correct, a.confidence_level, rules);

    return {
      question_id: a.question_id,
      is_correct: a.is_correct,
      confidence_level: a.confidence_level,
      cbm_score: score,
    };
  });

  const rawTotal = scores.reduce((sum, s) => sum + s.cbm_score, 0);
  const numQuestions = scores.length;
  const numCorrect = scores.filter(s => s.is_correct).length;
  const avgConfidence = scores.reduce((sum, s) => sum + s.confidence_level, 0) / numQuestions;

  // Max possible raw score (all correct at max confidence)
  const maxPossible = numQuestions * (model === 'hlcc' ? 2.0 : 2.0);

  // Canvas normalization using the multiplier
  // scoreMaximum in Canvas = multiplier * numQuestions
  // We map raw score to [0, scoreMaximum]
  // A raw score of (multiplier * numQuestions) maps to 100%
  const canvasMax = maxGradeMultiplier * numQuestions;
  const normalized = Math.max(0, Math.min(100, (rawTotal / canvasMax) * 100));

  return {
    scores,
    raw_total: rawTotal,
    max_possible: maxPossible,
    normalized,
    num_correct: numCorrect,
    num_questions: numQuestions,
    avg_confidence: avgConfidence,
  };
}

/**
 * Calculate the Canvas grade values for AGS passback.
 */
export function canvasGrade(result: AssessmentResult, numQuestions: number, multiplier: number = 1.5) {
  const scoreMaximum = multiplier * numQuestions;
  // Raw score clamped to [0, scoreMaximum]
  const scoreGiven = Math.max(0, Math.min(result.raw_total, scoreMaximum));

  return {
    scoreGiven,
    scoreMaximum,
    activityProgress: 'Completed' as const,
    gradingProgress: 'FullyGraded' as const,
    comment: `CBM Score: ${result.raw_total.toFixed(1)} | ${result.num_correct}/${result.num_questions} correct | Avg confidence: ${result.avg_confidence.toFixed(1)}`,
  };
}

/**
 * Get the scoring rules table for display to students.
 */
export function getScoringTable(model: ScoringModel, levels: number = 3): ScoringRule[] {
  if (model === 'discrete_cbm') {
    return DEFAULT_RULES.slice(0, levels);
  }
  // Generate HLCC rules for display
  return Array.from({ length: levels }, (_, i) => {
    const level = i + 1;
    const c = confidenceToC(level, levels);
    return {
      confidence_level: level,
      correct_score: parseFloat((1 + c).toFixed(2)),
      incorrect_score: parseFloat((-2 * c * c).toFixed(2)),
      label: level === 1 ? 'Low' : level === levels ? 'High' : 'Medium',
    };
  });
}
