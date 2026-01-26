export interface User {
  id: string;
  email: string;
  name: string;
  role: 'student' | 'admin' | 'staff';
  avatar?: string;
}

export interface AuthResponse {
  success: boolean;
  data: {
    user: User;
    token: string;
  };
}

export interface Submission {
  id: string;
  studentId: string;
  courseId: string;
  assignmentId: string;
  originalFilename: string;
  fileType: string;
  fileSize: number;
  status: 'uploaded' | 'analyzing' | 'ready' | 'completed' | 'error';
  errorMessage?: string;
  createdAt: string;
  analyzedAt?: string;
  completedAt?: string;
  noveltyScores?: number[];
  totalQuestions?: number;
  standardQuestions?: number;
  novelQuestions?: number;
  oralQuestions?: number;
}

export interface Question {
  id: string;
  questionText: string;
  questionType: 'multiple_choice' | 'true_false';
  correctAnswer: string;
  options?: string[];
  questionCategory: 'standard' | 'novel' | 'oral';
  bloomLevel: string;
  complexityLevel: number;
  noveltyScore?: number;
}

export interface StudentResponse {
  questionId: string;
  answer: string;
  confidenceLevel: number;
  confidenceReasoning?: string;
}

export interface AssessmentResult {
  submissionId: string;
  totalQuestions: number;
  correctAnswers: number;
  totalPoints: number;
  maxPossiblePoints: number;
  avgConfidence: number;
  avgConfidenceCorrect: number;
  avgConfidenceIncorrect: number;
  percentageScore: number;
}

export interface QuestionBankItem {
  id: string;
  questionText: string;
  questionType: string;
  correctAnswer: string;
  options?: string[];
  topic: string;
  subtopic?: string;
  bloomLevel: string;
  complexityLevel: number;
  source: 'qti_import' | 'manual' | 'llm_generated';
  timesUsed: number;
  avgCorrectRate?: number;
  createdAt: string;
  updatedAt: string;
}
