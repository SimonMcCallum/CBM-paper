/**
 * Course service - handles course management operations
 */

import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../models/database';
import {
  Course,
  CourseOverview,
  CourseMaterial,
  NoveltyDetectionConfig,
  QuestionGenerationConfig,
  MaterialProcessingStatus,
  CreateCourseRequest,
  UpdateCourseRequest,
  UploadCourseMaterialRequest,
  UpdateNoveltyConfigRequest,
  UpdateQuestionConfigRequest,
} from '../types/course';
import { NotFoundError, ValidationError } from '../utils/errors';
import logger from '../utils/logger';

const serviceLogger = logger.child({ module: 'courseService' });

// ============================================================================
// Course Operations
// ============================================================================

/**
 * Get all courses
 */
export async function getAllCourses(includeInactive: boolean = false): Promise<Course[]> {
  const db = getDatabase();

  const sql = includeInactive
    ? 'SELECT * FROM courses ORDER BY code'
    : 'SELECT * FROM courses WHERE active = 1 ORDER BY code';

  const rows = await db.query<any>(sql);

  return rows.map(row => ({
    ...row,
    is_mock: Boolean(row.is_mock),
    active: Boolean(row.active),
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  }));
}

/**
 * Get course by ID
 */
export async function getCourseById(courseId: string): Promise<Course> {
  const db = getDatabase();

  const row = await db.get<any>('SELECT * FROM courses WHERE id = ?', [courseId]);

  if (!row) {
    throw new NotFoundError('Course', courseId);
  }

  return {
    ...row,
    is_mock: Boolean(row.is_mock),
    active: Boolean(row.active),
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  };
}

/**
 * Get course overview (with counts)
 */
export async function getCourseOverview(courseId: string): Promise<CourseOverview> {
  const db = getDatabase();

  const row = await db.get<any>('SELECT * FROM course_overview WHERE id = ?', [courseId]);

  if (!row) {
    throw new NotFoundError('Course', courseId);
  }

  return {
    ...row,
    is_mock: Boolean(row.is_mock),
    active: Boolean(row.active),
    created_at: new Date(row.created_at),
  };
}

/**
 * Get all course overviews
 */
export async function getAllCourseOverviews(includeInactive: boolean = false): Promise<CourseOverview[]> {
  const db = getDatabase();

  const sql = includeInactive
    ? 'SELECT * FROM course_overview ORDER BY code'
    : 'SELECT * FROM course_overview WHERE active = 1 ORDER BY code';

  const rows = await db.query<any>(sql);

  return rows.map(row => ({
    ...row,
    is_mock: Boolean(row.is_mock),
    active: Boolean(row.active),
    created_at: new Date(row.created_at),
  }));
}

/**
 * Create a new course
 */
export async function createCourse(data: CreateCourseRequest): Promise<Course> {
  const db = getDatabase();

  // Validate
  if (!data.code || !data.name) {
    throw new ValidationError('Course code and name are required');
  }

  // Check for duplicate code
  const existing = await db.get<any>('SELECT id FROM courses WHERE code = ?', [data.code]);
  if (existing) {
    throw new ValidationError(`Course with code ${data.code} already exists`);
  }

  const courseId = uuidv4();

  await db.run(
    `INSERT INTO courses (id, code, name, description, semester, instructor, is_mock, active)
     VALUES (?, ?, ?, ?, ?, ?, 1, 1)`,
    [courseId, data.code, data.name, data.description || null, data.semester || null, data.instructor || null]
  );

  // Create default novelty config
  await createDefaultNoveltyConfig(courseId);

  // Create default question generation config
  await createDefaultQuestionConfig(courseId);

  serviceLogger.info(`Created course: ${data.code}`, { courseId });

  return getCourseById(courseId);
}

/**
 * Update a course
 */
export async function updateCourse(courseId: string, data: UpdateCourseRequest): Promise<Course> {
  const db = getDatabase();

  // Check course exists
  await getCourseById(courseId);

  // Build update query dynamically
  const updates: string[] = [];
  const params: any[] = [];

  if (data.code !== undefined) {
    updates.push('code = ?');
    params.push(data.code);
  }
  if (data.name !== undefined) {
    updates.push('name = ?');
    params.push(data.name);
  }
  if (data.description !== undefined) {
    updates.push('description = ?');
    params.push(data.description);
  }
  if (data.semester !== undefined) {
    updates.push('semester = ?');
    params.push(data.semester);
  }
  if (data.instructor !== undefined) {
    updates.push('instructor = ?');
    params.push(data.instructor);
  }
  if (data.active !== undefined) {
    updates.push('active = ?');
    params.push(data.active ? 1 : 0);
  }

  if (updates.length === 0) {
    return getCourseById(courseId);
  }

  params.push(courseId);

  await db.run(`UPDATE courses SET ${updates.join(', ')} WHERE id = ?`, params);

  serviceLogger.info(`Updated course`, { courseId });

  return getCourseById(courseId);
}

/**
 * Delete a course
 */
export async function deleteCourse(courseId: string): Promise<void> {
  const db = getDatabase();

  await db.run('DELETE FROM courses WHERE id = ?', [courseId]);

  serviceLogger.info(`Deleted course`, { courseId });
}

// ============================================================================
// Course Material Operations
// ============================================================================

/**
 * Get all materials for a course
 */
export async function getCourseMaterials(courseId: string): Promise<CourseMaterial[]> {
  const db = getDatabase();

  const rows = await db.query<any>(
    'SELECT * FROM course_materials WHERE course_id = ? ORDER BY display_order, created_at',
    [courseId]
  );

  return rows.map(row => ({
    ...row,
    visible: Boolean(row.visible),
    embedding_chunks: row.embedding_chunks ? JSON.parse(row.embedding_chunks) : undefined,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  }));
}

/**
 * Get material by ID
 */
export async function getMaterialById(materialId: string): Promise<CourseMaterial> {
  const db = getDatabase();

  const row = await db.get<any>('SELECT * FROM course_materials WHERE id = ?', [materialId]);

  if (!row) {
    throw new NotFoundError('Course material', materialId);
  }

  return {
    ...row,
    visible: Boolean(row.visible),
    embedding_chunks: row.embedding_chunks ? JSON.parse(row.embedding_chunks) : undefined,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  };
}

/**
 * Create course material record (file upload handled separately)
 */
export async function createCourseMaterial(
  courseId: string,
  data: UploadCourseMaterialRequest,
  fileInfo: { originalName: string; storedName: string; type: string; size: number }
): Promise<CourseMaterial> {
  const db = getDatabase();

  // Validate course exists
  await getCourseById(courseId);

  const materialId = uuidv4();

  await db.run(
    `INSERT INTO course_materials (
      id, course_id, title, description, material_type,
      original_filename, stored_filename, file_type, file_size,
      display_order, visible, processing_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [
      materialId,
      courseId,
      data.title,
      data.description || null,
      data.material_type,
      fileInfo.originalName,
      fileInfo.storedName,
      fileInfo.type,
      fileInfo.size,
      data.display_order || 0,
      data.visible !== false ? 1 : 0,
    ]
  );

  serviceLogger.info(`Created course material`, { materialId, courseId });

  return getMaterialById(materialId);
}

/**
 * Update material processing status
 */
export async function updateMaterialProcessing(
  materialId: string,
  status: string,
  extractedText?: string,
  summary?: string,
  embeddingChunks?: any[],
  errorMessage?: string
): Promise<CourseMaterial> {
  const db = getDatabase();

  await db.run(
    `UPDATE course_materials
     SET processing_status = ?,
         extracted_text = ?,
         summary = ?,
         embedding_chunks = ?,
         error_message = ?
     WHERE id = ?`,
    [
      status,
      extractedText || null,
      summary || null,
      embeddingChunks ? JSON.stringify(embeddingChunks) : null,
      errorMessage || null,
      materialId,
    ]
  );

  return getMaterialById(materialId);
}

/**
 * Delete course material
 */
export async function deleteCourseMaterial(materialId: string): Promise<void> {
  const db = getDatabase();

  await db.run('DELETE FROM course_materials WHERE id = ?', [materialId]);

  serviceLogger.info(`Deleted course material`, { materialId });
}

/**
 * Get material processing status summary
 */
export async function getMaterialProcessingStatus(courseId: string): Promise<MaterialProcessingStatus[]> {
  const db = getDatabase();

  const rows = await db.query<any>(
    'SELECT * FROM material_processing_status WHERE course_id = ?',
    [courseId]
  );

  return rows;
}

// ============================================================================
// Novelty Detection Configuration
// ============================================================================

/**
 * Get novelty detection config for course
 */
export async function getNoveltyConfig(courseId: string): Promise<NoveltyDetectionConfig> {
  const db = getDatabase();

  const row = await db.get<any>(
    'SELECT * FROM novelty_detection_config WHERE course_id = ?',
    [courseId]
  );

  if (!row) {
    throw new NotFoundError('Novelty detection config', courseId);
  }

  return {
    ...row,
    compare_to_materials: Boolean(row.compare_to_materials),
    compare_to_past_submissions: Boolean(row.compare_to_past_submissions),
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  };
}

/**
 * Update novelty detection config
 */
export async function updateNoveltyConfig(
  courseId: string,
  data: UpdateNoveltyConfigRequest
): Promise<NoveltyDetectionConfig> {
  const db = getDatabase();

  // Ensure config exists
  try {
    await getNoveltyConfig(courseId);
  } catch {
    await createDefaultNoveltyConfig(courseId);
  }

  // Build update query
  const updates: string[] = [];
  const params: any[] = [];

  if (data.chunk_size !== undefined) {
    updates.push('chunk_size = ?');
    params.push(data.chunk_size);
  }
  if (data.chunk_overlap !== undefined) {
    updates.push('chunk_overlap = ?');
    params.push(data.chunk_overlap);
  }
  if (data.novelty_threshold_high !== undefined) {
    updates.push('novelty_threshold_high = ?');
    params.push(data.novelty_threshold_high);
  }
  if (data.novelty_threshold_low !== undefined) {
    updates.push('novelty_threshold_low = ?');
    params.push(data.novelty_threshold_low);
  }
  if (data.embedding_model !== undefined) {
    updates.push('embedding_model = ?');
    params.push(data.embedding_model);
  }
  if (data.llm_provider !== undefined) {
    updates.push('llm_provider = ?');
    params.push(data.llm_provider);
  }
  if (data.llm_model !== undefined) {
    updates.push('llm_model = ?');
    params.push(data.llm_model);
  }
  if (data.llm_temperature !== undefined) {
    updates.push('llm_temperature = ?');
    params.push(data.llm_temperature);
  }
  if (data.compare_to_materials !== undefined) {
    updates.push('compare_to_materials = ?');
    params.push(data.compare_to_materials ? 1 : 0);
  }
  if (data.compare_to_past_submissions !== undefined) {
    updates.push('compare_to_past_submissions = ?');
    params.push(data.compare_to_past_submissions ? 1 : 0);
  }
  if (data.k_neighbors !== undefined) {
    updates.push('k_neighbors = ?');
    params.push(data.k_neighbors);
  }

  if (updates.length > 0) {
    params.push(courseId);
    await db.run(
      `UPDATE novelty_detection_config SET ${updates.join(', ')} WHERE course_id = ?`,
      params
    );
  }

  return getNoveltyConfig(courseId);
}

/**
 * Create default novelty config
 */
async function createDefaultNoveltyConfig(courseId: string): Promise<void> {
  const db = getDatabase();

  await db.run(
    `INSERT INTO novelty_detection_config (id, course_id)
     VALUES (?, ?)`,
    [uuidv4(), courseId]
  );
}

// ============================================================================
// Question Generation Configuration
// ============================================================================

/**
 * Get question generation config for course
 */
export async function getQuestionConfig(courseId: string): Promise<QuestionGenerationConfig> {
  const db = getDatabase();

  const row = await db.get<any>(
    'SELECT * FROM question_generation_config WHERE course_id = ?',
    [courseId]
  );

  if (!row) {
    throw new NotFoundError('Question generation config', courseId);
  }

  return {
    ...row,
    bloom_distribution_standard: JSON.parse(row.bloom_distribution_standard),
    bloom_levels_novel: JSON.parse(row.bloom_levels_novel),
    bloom_levels_oral: JSON.parse(row.bloom_levels_oral),
    require_explanation: Boolean(row.require_explanation),
    generate_distractors: Boolean(row.generate_distractors),
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  };
}

/**
 * Update question generation config
 */
export async function updateQuestionConfig(
  courseId: string,
  data: UpdateQuestionConfigRequest
): Promise<QuestionGenerationConfig> {
  const db = getDatabase();

  // Ensure config exists
  try {
    await getQuestionConfig(courseId);
  } catch {
    await createDefaultQuestionConfig(courseId);
  }

  // Build update query
  const updates: string[] = [];
  const params: any[] = [];

  if (data.standard_questions_count !== undefined) {
    updates.push('standard_questions_count = ?');
    params.push(data.standard_questions_count);
  }
  if (data.novel_questions_count !== undefined) {
    updates.push('novel_questions_count = ?');
    params.push(data.novel_questions_count);
  }
  if (data.oral_questions_count !== undefined) {
    updates.push('oral_questions_count = ?');
    params.push(data.oral_questions_count);
  }
  if (data.min_similarity_threshold !== undefined) {
    updates.push('min_similarity_threshold = ?');
    params.push(data.min_similarity_threshold);
  }
  if (data.diversity_weight !== undefined) {
    updates.push('diversity_weight = ?');
    params.push(data.diversity_weight);
  }
  if (data.bloom_distribution_standard !== undefined) {
    updates.push('bloom_distribution_standard = ?');
    params.push(JSON.stringify(data.bloom_distribution_standard));
  }
  if (data.bloom_levels_novel !== undefined) {
    updates.push('bloom_levels_novel = ?');
    params.push(JSON.stringify(data.bloom_levels_novel));
  }
  if (data.bloom_levels_oral !== undefined) {
    updates.push('bloom_levels_oral = ?');
    params.push(JSON.stringify(data.bloom_levels_oral));
  }
  if (data.llm_provider !== undefined) {
    updates.push('llm_provider = ?');
    params.push(data.llm_provider);
  }
  if (data.llm_model !== undefined) {
    updates.push('llm_model = ?');
    params.push(data.llm_model);
  }
  if (data.llm_temperature !== undefined) {
    updates.push('llm_temperature = ?');
    params.push(data.llm_temperature);
  }
  if (data.require_explanation !== undefined) {
    updates.push('require_explanation = ?');
    params.push(data.require_explanation ? 1 : 0);
  }
  if (data.generate_distractors !== undefined) {
    updates.push('generate_distractors = ?');
    params.push(data.generate_distractors ? 1 : 0);
  }
  if (data.distractor_count !== undefined) {
    updates.push('distractor_count = ?');
    params.push(data.distractor_count);
  }

  if (updates.length > 0) {
    params.push(courseId);
    await db.run(
      `UPDATE question_generation_config SET ${updates.join(', ')} WHERE course_id = ?`,
      params
    );
  }

  return getQuestionConfig(courseId);
}

/**
 * Create default question generation config
 */
async function createDefaultQuestionConfig(courseId: string): Promise<void> {
  const db = getDatabase();

  await db.run(
    `INSERT INTO question_generation_config (id, course_id)
     VALUES (?, ?)`,
    [uuidv4(), courseId]
  );
}
