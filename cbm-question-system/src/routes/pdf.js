const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');

const { extractPDFContent } = require('../services/pdfService');
const { analyzePDFContent } = require('../services/llmService');
const { createAssessment } = require('../services/assessmentService');

const router = express.Router();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueId = uuidv4();
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueId}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760 // 10MB default
  }
});

router.post('/upload', upload.single('pdf'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    const { difficulty, questionCount, llmProvider } = req.body;
    
    const pdfPath = req.file.path;
    const filename = req.file.filename;
    
    const extractedContent = await extractPDFContent(pdfPath);
    
    const analysis = await analyzePDFContent(extractedContent, {
      provider: llmProvider || process.env.DEFAULT_LLM_PROVIDER,
      difficulty: parseInt(difficulty) || 5,
      questionCount: parseInt(questionCount) || 10
    });
    
    const assessment = await createAssessment({
      filename,
      originalName: req.file.originalname,
      content: extractedContent,
      analysis,
      difficulty: parseInt(difficulty) || 5,
      questionCount: parseInt(questionCount) || 10
    });

    res.json({
      success: true,
      assessmentId: assessment.id,
      filename: req.file.originalname,
      analysis: analysis.summary,
      questionsGenerated: assessment.questions.length
    });

  } catch (error) {
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.error('Error deleting uploaded file:', unlinkError);
      }
    }
    next(error);
  }
});

router.get('/status/:assessmentId', async (req, res, next) => {
  try {
    const { assessmentId } = req.params;
    
    res.json({
      assessmentId,
      status: 'Processing complete',
      message: 'Assessment ready for review'
    });
    
  } catch (error) {
    next(error);
  }
});

module.exports = router;