/**
 * Python Sidecar Client
 *
 * Communicates with the novelty_detector Python service for:
 * - PDF text extraction and chunking
 * - Embedding generation
 * - FAISS similarity search against question bank
 * - LLM-based MCQ generation from novel content
 * - Oral question generation
 */

import axios, { AxiosInstance } from 'axios';

const SIDECAR_URL = process.env.SIDECAR_URL || 'http://localhost:5000';

const client: AxiosInstance = axios.create({
  baseURL: SIDECAR_URL,
  timeout: 180000,
});

export interface TextChunk {
  chunk_index: number;
  text: string;
  word_count: number;
}

export interface MatchedQuestion {
  question_bank_id: string;
  question_text: string;
  question_type: string;
  options: Array<{ id: string; text: string }>;
  correct_answer: string;
  explanation?: string;
  topic?: string;
  similarity: number;
}

export interface GeneratedQuestion {
  question_text: string;
  options: Array<{ id: string; text: string }>;
  correct_answer: string;
  explanation: string;
  topic: string;
  source_chunk: string;
}

export interface OralQuestionResult {
  question_text: string;
  expected_answer_points: string[];
  topic: string;
  difficulty: string;
}

/**
 * Extract text from PDF and chunk it.
 */
export async function extractAndChunk(pdfPath: string): Promise<{
  chunks: TextChunk[];
  word_count: number;
  full_text: string;
}> {
  const resp = await client.post('/api/validator/extract', { pdf_path: pdfPath });
  return resp.data;
}

/**
 * Match submission chunks against question bank embeddings via FAISS.
 */
export async function matchQuestions(
  chunks: TextChunk[],
  courseId: string,
  maxQuestions: number
): Promise<{
  matched_questions: MatchedQuestion[];
  unmatched_chunks: TextChunk[];
}> {
  const resp = await client.post('/api/validator/match', {
    chunks,
    course_id: courseId,
    max_questions: maxQuestions,
  });
  return resp.data;
}

/**
 * Generate MCQs from novel content using LLM.
 */
export async function generateMCQs(
  chunks: TextChunk[],
  count: number,
  courseId: string
): Promise<GeneratedQuestion[]> {
  const resp = await client.post('/api/validator/generate-mcq', {
    chunks,
    count,
    course_id: courseId,
  });
  return resp.data.questions || [];
}

/**
 * Generate oral questions for tutors.
 */
export async function generateOralQuestions(
  chunks: TextChunk[],
  count: number,
  courseId: string
): Promise<OralQuestionResult[]> {
  const resp = await client.post('/api/validator/generate-oral', {
    chunks,
    count,
    course_id: courseId,
  });
  return resp.data.questions || [];
}

/**
 * Health check on the Python sidecar.
 */
export async function sidecarHealth(): Promise<boolean> {
  try {
    const resp = await client.get('/novelty/api/health', { timeout: 5000 });
    return resp.data?.status === 'healthy';
  } catch {
    return false;
  }
}
