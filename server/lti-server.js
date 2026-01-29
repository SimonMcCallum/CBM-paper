/**
 * LTI 1.3 Server for Confidence-Based Marking (CBM) Quiz System
 *
 * This server provides LTI 1.3 integration for the HLCC scoring quiz system.
 * It can be embedded in Canvas, Moodle, or any LTI 1.3 compliant LMS.
 *
 * HLCC Scoring Model:
 *   Correct: S = 1 + c  (linear reward)
 *   Incorrect: S = -2c² (quadratic penalty)
 *   Where c ∈ {0, 0.5, 1} for confidence levels 1, 2, 3
 *
 * Setup:
 *   1. Start MongoDB (or use docker-compose in E:/moodle-lti-test)
 *   2. Run: node lti-server.js
 *   3. Register with your LMS using the configuration endpoint
 */

const path = require('path');
const Lti = require('ltijs').Provider;

// LTI Configuration
const LTI_KEY = process.env.LTI_KEY || 'CBM-QUIZ-LTI-KEY';
const PORT = process.env.LTI_PORT || 3031;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://lti:lti_password@localhost:27017/lti?authSource=admin';

// Quiz questions (same as main server)
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
      options: ["6.02 × 10²¹", "6.02 × 10²³", "6.02 × 10²⁵", "6.02 × 10¹⁹"],
      correct_answer: 1,
      explanation: "Avogadro's number is approximately 6.02 × 10²³, representing the number of particles in one mole of a substance."
    },
    {
      id: 7,
      question: "Which type of chemical bond involves the sharing of electron pairs between atoms?",
      options: ["Ionic bond", "Metallic bond", "Covalent bond", "Hydrogen bond"],
      correct_answer: 2,
      explanation: "Covalent bonds form when atoms share one or more pairs of electrons, typically between non-metal atoms."
    },
    {
      id: 8,
      question: "What is the pH of a neutral solution at 25°C?",
      options: ["0", "1", "7", "14"],
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
      options: ["Linear", "Trigonal planar", "Tetrahedral", "Octahedral"],
      correct_answer: 2,
      explanation: "Methane (CH₄) has a tetrahedral molecular geometry with bond angles of approximately 109.5°, due to its four bonding pairs and no lone pairs on the central carbon atom."
    }
  ]
};

// HLCC Scoring Functions
const confidenceToC = (level) => {
  switch(level) {
    case 1: return 0;
    case 2: return 0.5;
    case 3: return 1;
    default: return 0;
  }
};

const calculateHLCCScore = (isCorrect, c) => {
  if (isCorrect) {
    return 1 + c;  // Linear reward: 1.0, 1.5, or 2.0
  } else {
    return -2 * c * c;  // Quadratic penalty: 0, -0.5, or -2.0
  }
};

// Initialize LTI Provider
const lti = new Lti(LTI_KEY, {
  url: MONGODB_URI,
  connection: {
    user: 'lti',
    pass: 'lti_password'
  }
}, {
  appRoute: '/',
  loginRoute: '/login',
  keysetRoute: '/keys',
  dynRegRoute: '/register',
  staticPath: path.join(__dirname, 'public'),
  cookies: {
    secure: false, // Set to true in production with HTTPS
    sameSite: 'None'
  },
  devMode: true // Set to false in production
});

// LTI Launch Handler
lti.onConnect(async (token, req, res) => {
  // Get user info from LTI token
  const userInfo = {
    id: token.user,
    name: token.userInfo?.name || 'Student',
    email: token.userInfo?.email || '',
    roles: token.platformContext?.roles || []
  };

  // Get context (course) info
  const contextInfo = {
    id: token.platformContext?.context?.id || '',
    title: token.platformContext?.context?.title || 'Unknown Course',
    label: token.platformContext?.context?.label || ''
  };

  console.log(`LTI Launch: User ${userInfo.name} (${userInfo.id}) in ${contextInfo.title}`);

  // Store token for grade passback
  res.locals.token = token;
  res.locals.userInfo = userInfo;
  res.locals.contextInfo = contextInfo;

  // Redirect to quiz interface
  return res.sendFile(path.join(__dirname, 'public', 'lti-quiz.html'));
});

// Setup routes after LTI initialization
const setup = async () => {
  await lti.deploy({ port: PORT });

  // Get available subjects
  lti.app.get('/api/lti/subjects', (req, res) => {
    res.json(Object.keys(quizQuestions));
  });

  // Get questions for a subject
  lti.app.get('/api/lti/quiz/:subject', (req, res) => {
    const subject = req.params.subject;
    if (quizQuestions[subject]) {
      // Return questions without correct answers for security
      const safeQuestions = quizQuestions[subject].map(q => ({
        id: q.id,
        question: q.question,
        options: q.options
      }));
      res.json(safeQuestions);
    } else {
      res.status(404).json({ error: 'Subject not found' });
    }
  });

  // Submit quiz and calculate HLCC score
  lti.app.post('/api/lti/submit', async (req, res) => {
    const { answers, confidences, subject } = req.body;
    const token = res.locals.token;

    const results = [];
    let totalScore = 0;
    let totalQuestions = 0;

    const questions = quizQuestions[subject] || [];

    for (const [questionId, answer] of Object.entries(answers)) {
      const question = questions.find(q => q.id === parseInt(questionId));
      if (question) {
        const isCorrect = parseInt(answer) === question.correct_answer;
        const confidenceLevel = confidences[questionId] || 1;
        const c = confidenceToC(confidenceLevel);
        const questionScore = calculateHLCCScore(isCorrect, c);

        results.push({
          questionId: parseInt(questionId),
          question: question.question,
          userAnswer: parseInt(answer),
          correctAnswer: question.correct_answer,
          isCorrect,
          confidence: confidenceLevel,
          score: questionScore,
          explanation: question.explanation
        });

        totalScore += questionScore;
        totalQuestions++;
      }
    }

    const maxPossibleScore = totalQuestions * 2;
    const percentage = totalQuestions > 0 ? (totalScore / maxPossibleScore) * 100 : 0;
    const normalizedScore = Math.max(0, Math.min(100, ((totalScore + (totalQuestions * 2)) / (totalQuestions * 4)) * 100));

    // Send grade back to LMS if grade passback is available
    if (token && token.platformContext?.endpoint?.lineitem) {
      try {
        const grade = {
          scoreGiven: normalizedScore,
          scoreMaximum: 100,
          activityProgress: 'Completed',
          gradingProgress: 'FullyGraded',
          comment: `HLCC Score: ${totalScore}/${maxPossibleScore} (${percentage.toFixed(1)}%)`
        };

        await lti.Grade.submitScore(token, grade);
        console.log(`Grade submitted for user ${token.user}: ${normalizedScore}%`);
      } catch (err) {
        console.error('Grade passback failed:', err.message);
      }
    }

    res.json({
      results,
      totalScore: Math.round(totalScore * 100) / 100,
      totalQuestions,
      maxPossibleScore,
      percentage: Math.round(percentage * 100) / 100,
      normalizedScore: Math.round(normalizedScore * 100) / 100,
      scoringModel: 'HLCC',
      gradeSubmitted: !!token?.platformContext?.endpoint?.lineitem
    });
  });

  // LTI Configuration info endpoint
  lti.app.get('/api/lti/config', (req, res) => {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    res.json({
      name: 'CBM Quiz - HLCC Scoring',
      description: 'Confidence-Based Marking quiz with Hybrid Linear-Convex Confidence scoring',
      target_link_uri: `${baseUrl}/`,
      oidc_initiation_url: `${baseUrl}/login`,
      public_jwk_url: `${baseUrl}/keys`,
      dynamic_registration_url: `${baseUrl}/register`,
      scopes: [
        'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem',
        'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly',
        'https://purl.imsglobal.org/spec/lti-ags/scope/score'
      ],
      messages: [
        { type: 'LtiResourceLinkRequest' },
        { type: 'LtiDeepLinkingRequest' }
      ],
      claims: ['name', 'email', 'given_name', 'family_name'],
      scoring: {
        model: 'HLCC',
        formula_correct: 'S = 1 + c',
        formula_incorrect: 'S = -2c²',
        levels: {
          1: { c: 0, correct: 1.0, incorrect: 0.0 },
          2: { c: 0.5, correct: 1.5, incorrect: -0.5 },
          3: { c: 1.0, correct: 2.0, incorrect: -2.0 }
        }
      }
    });
  });

  console.log('');
  console.log('========================================');
  console.log('CBM Quiz LTI 1.3 Server');
  console.log('========================================');
  console.log(`LTI Tool URL:     http://localhost:${PORT}/`);
  console.log(`Login URL:        http://localhost:${PORT}/login`);
  console.log(`Keyset URL:       http://localhost:${PORT}/keys`);
  console.log(`Registration:     http://localhost:${PORT}/register`);
  console.log(`Config Info:      http://localhost:${PORT}/api/lti/config`);
  console.log('');
  console.log('To register with Moodle:');
  console.log('1. Go to Site Admin > Plugins > External Tools > Manage Tools');
  console.log('2. Click "Configure a tool manually"');
  console.log('3. Use the URLs above for configuration');
  console.log('========================================');
};

setup().catch(err => {
  console.error('LTI Server startup failed:', err);
  process.exit(1);
});
