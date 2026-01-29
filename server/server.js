const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3030;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Quiz questions data
const quizQuestions = {
  mechanical_engineering: [
    {
      id: 1,
      question: "What is the primary function of a heat exchanger in a mechanical system?",
      options: [
        "To generate mechanical work from thermal energy",
        "To transfer heat between two or more fluids without mixing them",
        "To compress gases to higher pressures",
        "To convert electrical energy into mechanical motion"
      ],
      correct_answer: 1,
      explanation: "A heat exchanger's primary function is to transfer thermal energy between two or more fluids at different temperatures without allowing them to mix directly."
    },
    {
      id: 2,
      question: "In a four-stroke internal combustion engine, what happens during the compression stroke?",
      options: [
        "The fuel-air mixture is ignited",
        "Exhaust gases are expelled from the cylinder",
        "The fuel-air mixture is compressed before ignition",
        "Fresh fuel-air mixture enters the cylinder"
      ],
      correct_answer: 2,
      explanation: "During the compression stroke, the piston moves upward, compressing the fuel-air mixture to increase its temperature and pressure before ignition."
    },
    {
      id: 3,
      question: "What is the relationship between stress and strain in the elastic region of a material?",
      options: [
        "Stress is inversely proportional to strain",
        "Stress is directly proportional to strain (Hooke's Law)",
        "Stress and strain are independent of each other",
        "Stress is proportional to the square of strain"
      ],
      correct_answer: 1,
      explanation: "Hooke's Law states that in the elastic region, stress is directly proportional to strain: σ = Eε, where E is the modulus of elasticity."
    },
    {
      id: 4,
      question: "What is the purpose of a flywheel in mechanical systems?",
      options: [
        "To increase the speed of rotation",
        "To store rotational kinetic energy and smooth out fluctuations",
        "To reduce friction in rotating parts",
        "To generate electrical power"
      ],
      correct_answer: 1,
      explanation: "A flywheel stores rotational kinetic energy and helps smooth out fluctuations in torque and rotational speed, providing more consistent motion."
    },
    {
      id: 5,
      question: "In thermodynamics, what does the First Law state?",
      options: [
        "Energy cannot be created or destroyed, only converted from one form to another",
        "Heat always flows from hot to cold objects",
        "The entropy of an isolated system always increases",
        "Perfect heat engines are impossible to construct"
      ],
      correct_answer: 0,
      explanation: "The First Law of Thermodynamics is the law of conservation of energy, stating that energy cannot be created or destroyed, only converted between different forms."
    }
  ],
  chemistry: [
    {
      id: 6,
      question: "What is Avogadro's number approximately equal to?",
      options: [
        "6.02 × 10²¹",
        "6.02 × 10²³",
        "6.02 × 10²⁵",
        "6.02 × 10¹⁹"
      ],
      correct_answer: 1,
      explanation: "Avogadro's number is approximately 6.02 × 10²³, representing the number of particles (atoms, molecules, ions) in one mole of a substance."
    },
    {
      id: 7,
      question: "Which type of chemical bond involves the sharing of electron pairs between atoms?",
      options: [
        "Ionic bond",
        "Metallic bond",
        "Covalent bond",
        "Hydrogen bond"
      ],
      correct_answer: 2,
      explanation: "Covalent bonds form when atoms share one or more pairs of electrons, typically between non-metal atoms."
    },
    {
      id: 8,
      question: "What is the pH of a neutral solution at 25°C?",
      options: [
        "0",
        "1",
        "7",
        "14"
      ],
      correct_answer: 2,
      explanation: "At 25°C, a neutral solution has a pH of 7, where the concentration of H⁺ ions equals the concentration of OH⁻ ions."
    },
    {
      id: 9,
      question: "In the periodic table, what trend is observed for atomic radius as you move from left to right across a period?",
      options: [
        "Atomic radius increases",
        "Atomic radius decreases",
        "Atomic radius remains constant",
        "Atomic radius first increases then decreases"
      ],
      correct_answer: 1,
      explanation: "As you move from left to right across a period, atomic radius decreases due to increasing nuclear charge pulling electrons closer to the nucleus."
    },
    {
      id: 10,
      question: "What is the molecular geometry of methane (CH₄)?",
      options: [
        "Linear",
        "Trigonal planar",
        "Tetrahedral",
        "Octahedral"
      ],
      correct_answer: 2,
      explanation: "Methane (CH₄) has a tetrahedral molecular geometry with bond angles of approximately 109.5°, due to its four bonding pairs and no lone pairs on the central carbon atom."
    }
  ]
};

// Create uploads and temp directories
const uploadsDir = path.join(__dirname, 'uploads');
const tempDir = path.join(__dirname, 'temp');
const outputDir = path.join(__dirname, 'output');

fs.ensureDirSync(uploadsDir);
fs.ensureDirSync(tempDir);
fs.ensureDirSync(outputDir);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/zip' || file.originalname.endsWith('.zip')) {
      cb(null, true);
    } else {
      cb(new Error('Only ZIP files are allowed'));
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Quiz API Routes
app.get('/api/quiz/subjects', (req, res) => {
  const subjects = Object.keys(quizQuestions);
  res.json(subjects);
});

app.get('/api/quiz/:subject', (req, res) => {
  const subject = req.params.subject;
  if (quizQuestions[subject]) {
    res.json(quizQuestions[subject]);
  } else {
    res.status(404).json({ error: 'Subject not found' });
  }
});

app.post('/api/quiz/submit', (req, res) => {
  const { answers, confidences } = req.body;

  // Calculate scores using HLCC (Hybrid Linear-Convex Confidence) scoring model
  // Reference: "Confidence-Based Marking Scheme Analysis.pdf"
  //
  // Confidence levels map to c values:
  //   Level 1 (Low)    -> c = 0
  //   Level 2 (Medium) -> c = 0.5
  //   Level 3 (High)   -> c = 1
  //
  // Scoring formulas:
  //   Correct: S = 1 + c  (linear reward)
  //   Incorrect: S = -2c² (quadratic penalty - "being wrong is cheap, being wrong and loud is expensive")
  //
  // Score table:
  //   Level 1: Correct = 1.0,  Incorrect = 0.0
  //   Level 2: Correct = 1.5,  Incorrect = -0.5
  //   Level 3: Correct = 2.0,  Incorrect = -2.0

  const results = [];
  let totalScore = 0;
  let totalQuestions = 0;

  // Map confidence level (1, 2, 3) to c value (0, 0.5, 1)
  const confidenceToC = (level) => {
    switch(level) {
      case 1: return 0;
      case 2: return 0.5;
      case 3: return 1;
      default: return 0; // Default to low confidence
    }
  };

  // HLCC scoring function
  const calculateHLCCScore = (isCorrect, c) => {
    if (isCorrect) {
      return 1 + c;  // Linear reward: 1.0, 1.5, or 2.0
    } else {
      return -2 * c * c;  // Quadratic penalty: 0, -0.5, or -2.0
    }
  };

  // Get all questions for scoring
  const allQuestions = [...quizQuestions.mechanical_engineering, ...quizQuestions.chemistry];

  for (const [questionId, answer] of Object.entries(answers)) {
    const question = allQuestions.find(q => q.id === parseInt(questionId));
    if (question) {
      const isCorrect = parseInt(answer) === question.correct_answer;
      const confidenceLevel = confidences[questionId] || 1; // Default to level 1 (low confidence)
      const c = confidenceToC(confidenceLevel);

      const questionScore = calculateHLCCScore(isCorrect, c);

      results.push({
        questionId: parseInt(questionId),
        question: question.question,
        userAnswer: parseInt(answer),
        correctAnswer: question.correct_answer,
        isCorrect,
        confidence: confidenceLevel,
        confidenceC: c,
        score: questionScore,
        explanation: question.explanation
      });

      totalScore += questionScore;
      totalQuestions++;
    }
  }

  // Max score is 2.0 per question (level 3 correct)
  // Min score is -2.0 per question (level 3 incorrect)
  const maxPossibleScore = totalQuestions * 2;

  res.json({
    results,
    totalScore: Math.round(totalScore * 100) / 100, // Round to 2 decimal places
    totalQuestions,
    maxPossibleScore,
    percentage: totalQuestions > 0 ? Math.round((totalScore / maxPossibleScore) * 10000) / 100 : 0,
    scoringModel: 'HLCC' // Hybrid Linear-Convex Confidence
  });
});

// Upload and process endpoint
app.post('/process-quiz', upload.single('quizFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { questionType = 'mixed' } = req.body;
    const inputPath = req.file.path;
    const outputFilename = `processed-${req.file.filename}`;
    const outputPath = path.join(outputDir, outputFilename);

    console.log(`Processing quiz: ${req.file.originalname}`);
    console.log(`Question type: ${questionType}`);

    // Call Python script to process the quiz
    const pythonScript = path.join(__dirname, '../Canvas_update/insertCBM.py');
    const result = await runPythonScript(pythonScript, inputPath, outputPath, questionType);

    if (result.success) {
      // Send the processed file
      res.download(outputPath, `cbm-${req.file.originalname}`, (err) => {
        if (err) {
          console.error('Download error:', err);
          res.status(500).json({ error: 'Failed to download processed file' });
        }
        
        // Clean up files
        setTimeout(() => {
          fs.remove(inputPath).catch(console.error);
          fs.remove(outputPath).catch(console.error);
        }, 5000);
      });
    } else {
      res.status(500).json({ 
        error: 'Processing failed', 
        details: result.error,
        stdout: result.stdout,
        stderr: result.stderr
      });
      
      // Clean up input file
      fs.remove(inputPath).catch(console.error);
    }

  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: error.message });
    
    // Clean up uploaded file if it exists
    if (req.file) {
      fs.remove(req.file.path).catch(console.error);
    }
  }
});

// Get processing status (for future use with async processing)
app.get('/status/:jobId', (req, res) => {
  res.json({ 
    jobId: req.params.jobId, 
    status: 'completed',
    message: 'Synchronous processing - check /process-quiz endpoint'
  });
});

function runPythonScript(scriptPath, inputPath, outputPath, questionType) {
  return new Promise((resolve) => {
    const args = [scriptPath, inputPath, outputPath];
    
    // Add question type flag if specified
    if (questionType === 'tf') {
      args.push('--tf-only');
    } else if (questionType === 'mc') {
      args.push('--mc-only');
    }

    console.log(`Running: python ${args.join(' ')}`);
    
    const pythonProcess = spawn('python', args, {
      cwd: path.dirname(scriptPath)
    });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
      console.log(`Python stdout: ${data}`);
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
      console.error(`Python stderr: ${data}`);
    });

    pythonProcess.on('close', (code) => {
      console.log(`Python process exited with code ${code}`);
      
      if (code === 0) {
        resolve({ success: true, stdout, stderr });
      } else {
        resolve({ 
          success: false, 
          error: `Python script exited with code ${code}`,
          stdout, 
          stderr 
        });
      }
    });

    pythonProcess.on('error', (error) => {
      console.error('Failed to start Python process:', error);
      resolve({ 
        success: false, 
        error: `Failed to start Python process: ${error.message}`,
        stdout, 
        stderr 
      });
    });
  });
}

app.listen(PORT, () => {
  console.log(`🎯 Confidence-Based Quiz & QTI Server running on port ${PORT}`);
  console.log(`📚 Quiz Interface: http://localhost:${PORT}/quiz.html`);
  console.log(`📁 QTI Processor: http://localhost:${PORT}/`);
  console.log(`🔧 Health check: http://localhost:${PORT}/health`);
  console.log(`📊 Quiz API: http://localhost:${PORT}/api/quiz/subjects`);
});
