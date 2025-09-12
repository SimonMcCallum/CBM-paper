const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const XAIProvider = require('../services/xaiService');
const router = express.Router();

// Get AI testing results
router.get('/results', async (req, res) => {
  try {
    const resultsPath = path.join(__dirname, '../../../results/answers.json');
    const summaryPath = path.join(__dirname, '../../../results/test_summary.json');
    
    let results = null;
    let summary = null;
    
    try {
      const resultsData = await fs.readFile(resultsPath, 'utf8');
      results = JSON.parse(resultsData);
    } catch (error) {
      console.log('No results file found');
    }
    
    try {
      const summaryData = await fs.readFile(summaryPath, 'utf8');
      summary = JSON.parse(summaryData);
    } catch (error) {
      console.log('No summary file found');
    }
    
    res.json({
      results: results || [],
      summary: summary || {},
      hasData: !!(results && results.length > 0)
    });
  } catch (error) {
    console.error('Error reading AI testing results:', error);
    res.status(500).json({ error: 'Failed to load AI testing results' });
  }
});

// Get specific test result by ID
router.get('/results/:id', async (req, res) => {
  try {
    const resultsPath = path.join(__dirname, '../../../results/answers.json');
    const resultsData = await fs.readFile(resultsPath, 'utf8');
    const results = JSON.parse(resultsData);
    
    const result = results.find(r => r.question_id === req.params.id);
    
    if (!result) {
      return res.status(404).json({ error: 'Test result not found' });
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error reading specific test result:', error);
    res.status(500).json({ error: 'Failed to load test result' });
  }
});

// Get results filtered by vendor
router.get('/results/vendor/:vendor', async (req, res) => {
  try {
    const resultsPath = path.join(__dirname, '../../../results/answers.json');
    const resultsData = await fs.readFile(resultsPath, 'utf8');
    const results = JSON.parse(resultsData);
    
    const vendorResults = results.filter(r => r.vendor === req.params.vendor);
    
    res.json({
      vendor: req.params.vendor,
      results: vendorResults,
      count: vendorResults.length
    });
  } catch (error) {
    console.error('Error reading vendor results:', error);
    res.status(500).json({ error: 'Failed to load vendor results' });
  }
});

// Get results filtered by model
router.get('/results/model/:vendor/:model', async (req, res) => {
  try {
    const resultsPath = path.join(__dirname, '../../../results/answers.json');
    const resultsData = await fs.readFile(resultsPath, 'utf8');
    const results = JSON.parse(resultsData);
    
    const modelResults = results.filter(r => 
      r.vendor === req.params.vendor && r.model === req.params.model
    );
    
    res.json({
      vendor: req.params.vendor,
      model: req.params.model,
      results: modelResults,
      count: modelResults.length
    });
  } catch (error) {
    console.error('Error reading model results:', error);
    res.status(500).json({ error: 'Failed to load model results' });
  }
});

// Get confidence analysis
router.get('/analysis/confidence', async (req, res) => {
  try {
    const resultsPath = path.join(__dirname, '../../../results/answers.json');
    const resultsData = await fs.readFile(resultsPath, 'utf8');
    const results = JSON.parse(resultsData);
    
    // Analyze confidence vs accuracy correlation
    const analysis = {
      confidence_buckets: {},
      vendor_confidence: {},
      model_confidence: {},
      overall_stats: {}
    };
    
    // Group by confidence levels
    const confidenceBuckets = {
      'very_low': { min: 0.0, max: 0.2, results: [] },
      'low': { min: 0.2, max: 0.4, results: [] },
      'medium': { min: 0.4, max: 0.6, results: [] },
      'high': { min: 0.6, max: 0.8, results: [] },
      'very_high': { min: 0.8, max: 1.0, results: [] }
    };
    
    results.forEach(result => {
      const confidence = result.response.confidence_level;
      
      for (const [bucket, range] of Object.entries(confidenceBuckets)) {
        if (confidence >= range.min && confidence <= range.max) {
          range.results.push(result);
          break;
        }
      }
    });
    
    // Calculate stats for each bucket
    for (const [bucket, data] of Object.entries(confidenceBuckets)) {
      if (data.results.length > 0) {
        const correct = data.results.filter(r => r.is_correct).length;
        analysis.confidence_buckets[bucket] = {
          count: data.results.length,
          accuracy: correct / data.results.length,
          avg_confidence: data.results.reduce((sum, r) => sum + r.response.confidence_level, 0) / data.results.length,
          avg_cbm_score: data.results.reduce((sum, r) => sum + r.response.cbm_score, 0) / data.results.length
        };
      }
    }
    
    // Vendor analysis
    const vendorGroups = {};
    results.forEach(result => {
      if (!vendorGroups[result.vendor]) {
        vendorGroups[result.vendor] = [];
      }
      vendorGroups[result.vendor].push(result);
    });
    
    for (const [vendor, vendorResults] of Object.entries(vendorGroups)) {
      const correct = vendorResults.filter(r => r.is_correct).length;
      analysis.vendor_confidence[vendor] = {
        count: vendorResults.length,
        accuracy: correct / vendorResults.length,
        avg_confidence: vendorResults.reduce((sum, r) => sum + r.response.confidence_level, 0) / vendorResults.length,
        avg_cbm_score: vendorResults.reduce((sum, r) => sum + r.response.cbm_score, 0) / vendorResults.length
      };
    }
    
    // Overall stats
    const totalCorrect = results.filter(r => r.is_correct).length;
    analysis.overall_stats = {
      total_tests: results.length,
      overall_accuracy: totalCorrect / results.length,
      avg_confidence: results.reduce((sum, r) => sum + r.response.confidence_level, 0) / results.length,
      avg_cbm_score: results.reduce((sum, r) => sum + r.response.cbm_score, 0) / results.length,
      confidence_accuracy_correlation: calculateCorrelation(
        results.map(r => r.response.confidence_level),
        results.map(r => r.is_correct ? 1 : 0)
      )
    };
    
    res.json(analysis);
  } catch (error) {
    console.error('Error analyzing confidence data:', error);
    res.status(500).json({ error: 'Failed to analyze confidence data' });
  }
});

// Get CBM scoring analysis
router.get('/analysis/cbm', async (req, res) => {
  try {
    const resultsPath = path.join(__dirname, '../../../results/answers.json');
    const resultsData = await fs.readFile(resultsPath, 'utf8');
    const results = JSON.parse(resultsData);
    
    const analysis = {
      score_distribution: {},
      vendor_cbm_performance: {},
      question_difficulty: {},
      calibration_analysis: {}
    };
    
    // Score distribution
    const scoreRanges = {
      'excellent': { min: 1.5, max: 2.0, results: [] },
      'good': { min: 0.5, max: 1.5, results: [] },
      'neutral': { min: -0.5, max: 0.5, results: [] },
      'poor': { min: -1.5, max: -0.5, results: [] },
      'very_poor': { min: -2.0, max: -1.5, results: [] }
    };
    
    results.forEach(result => {
      const score = result.response.cbm_score;
      for (const [range, data] of Object.entries(scoreRanges)) {
        if (score >= data.min && score <= data.max) {
          data.results.push(result);
          break;
        }
      }
    });
    
    for (const [range, data] of Object.entries(scoreRanges)) {
      analysis.score_distribution[range] = {
        count: data.results.length,
        percentage: (data.results.length / results.length) * 100
      };
    }
    
    // Vendor CBM performance
    const vendorGroups = {};
    results.forEach(result => {
      if (!vendorGroups[result.vendor]) {
        vendorGroups[result.vendor] = [];
      }
      vendorGroups[result.vendor].push(result);
    });
    
    for (const [vendor, vendorResults] of Object.entries(vendorGroups)) {
      analysis.vendor_cbm_performance[vendor] = {
        avg_cbm_score: vendorResults.reduce((sum, r) => sum + r.response.cbm_score, 0) / vendorResults.length,
        positive_scores: vendorResults.filter(r => r.response.cbm_score > 0).length,
        negative_scores: vendorResults.filter(r => r.response.cbm_score < 0).length,
        neutral_scores: vendorResults.filter(r => r.response.cbm_score === 0).length
      };
    }
    
    res.json(analysis);
  } catch (error) {
    console.error('Error analyzing CBM data:', error);
    res.status(500).json({ error: 'Failed to analyze CBM data' });
  }
});

// Get current test configuration
router.get('/config', async (req, res) => {
  try {
    const configPath = path.join(__dirname, '../../../Code/config.py');
    const modelsPath = path.join(__dirname, '../../../Code/models.json');
    
    // Read current configuration
    let config = {
      temperatures: [0.0, 0.7, 1.0],
      num_repetitions: 3,
      available_vendors: [],
      api_keys_configured: {}
    };
    
    try {
      const modelsData = await fs.readFile(modelsPath, 'utf8');
      const models = JSON.parse(modelsData);
      config.available_vendors = Object.keys(models);
    } catch (error) {
      console.log('Could not read models configuration');
    }
    
    // Check which API keys are configured
    const apiKeys = {
      'OPENAI_API_KEY_CBM': 'OpenAI',
      'ANTHROPIC_API_KEY_CBM': 'Claude',
      'GEMINI_API_KEY_CBM': 'Gemini',
      'DEEPSEEK_API_KEY_CBM': 'DeepSeek',
      'XAI_API_KEY_CBM': 'XAI'
    };
    
    for (const [envVar, vendor] of Object.entries(apiKeys)) {
      config.api_keys_configured[vendor] = !!process.env[envVar];
    }
    
    res.json(config);
  } catch (error) {
    console.error('Error reading test configuration:', error);
    res.status(500).json({ error: 'Failed to read test configuration' });
  }
});

// Update test configuration
router.post('/config', async (req, res) => {
  try {
    const { temperatures, num_repetitions, selected_vendors } = req.body;
    
    // Validate input
    if (!Array.isArray(temperatures) || temperatures.length === 0) {
      return res.status(400).json({ error: 'Temperatures must be a non-empty array' });
    }
    
    if (!num_repetitions || num_repetitions < 1 || num_repetitions > 10) {
      return res.status(400).json({ error: 'Number of repetitions must be between 1 and 10' });
    }
    
    if (!Array.isArray(selected_vendors) || selected_vendors.length === 0) {
      return res.status(400).json({ error: 'At least one vendor must be selected' });
    }
    
    // Validate temperatures
    for (const temp of temperatures) {
      if (typeof temp !== 'number' || temp < 0 || temp > 2) {
        return res.status(400).json({ error: 'All temperatures must be numbers between 0 and 2' });
      }
    }
    
    // Check that selected vendors have API keys
    const apiKeys = {
      'OpenAI': 'OPENAI_API_KEY_CBM',
      'Claude': 'ANTHROPIC_API_KEY_CBM',
      'Gemini': 'GEMINI_API_KEY_CBM',
      'DeepSeek': 'DEEPSEEK_API_KEY_CBM',
      'XAI': 'XAI_API_KEY_CBM'
    };
    
    const missingKeys = [];
    for (const vendor of selected_vendors) {
      const envVar = apiKeys[vendor];
      if (!process.env[envVar]) {
        missingKeys.push(vendor);
      }
    }
    
    if (missingKeys.length > 0) {
      return res.status(400).json({ 
        error: `Missing API keys for: ${missingKeys.join(', ')}. Please configure environment variables.`,
        missing_keys: missingKeys
      });
    }
    
    // Store configuration in a temporary file for the Python script
    const testConfig = {
      temperatures,
      num_repetitions,
      selected_vendors,
      timestamp: new Date().toISOString()
    };
    
    const configPath = path.join(__dirname, '../../../results/test_config.json');
    await fs.writeFile(configPath, JSON.stringify(testConfig, null, 2));
    
    res.json({
      success: true,
      message: 'Test configuration updated successfully',
      config: testConfig
    });
    
  } catch (error) {
    console.error('Error updating test configuration:', error);
    res.status(500).json({ error: 'Failed to update test configuration' });
  }
});

// Trigger new AI test run with configuration
router.post('/run-test', async (req, res) => {
  try {
    // Check if configuration exists
    const configPath = path.join(__dirname, '../../../results/test_config.json');
    let testConfig;
    
    try {
      const configData = await fs.readFile(configPath, 'utf8');
      testConfig = JSON.parse(configData);
    } catch (error) {
      return res.status(400).json({ 
        error: 'No test configuration found. Please configure test parameters first.',
        requires_config: true
      });
    }
    
    // Validate that API keys are still available
    const apiKeys = {
      'OpenAI': 'OPENAI_API_KEY_CBM',
      'Claude': 'ANTHROPIC_API_KEY_CBM',
      'Gemini': 'GEMINI_API_KEY_CBM',
      'DeepSeek': 'DEEPSEEK_API_KEY_CBM',
      'XAI': 'XAI_API_KEY_CBM'
    };
    
    const missingKeys = [];
    for (const vendor of testConfig.selected_vendors) {
      const envVar = apiKeys[vendor];
      if (!process.env[envVar]) {
        missingKeys.push(vendor);
      }
    }
    
    if (missingKeys.length > 0) {
      return res.status(400).json({ 
        error: `Missing API keys for: ${missingKeys.join(', ')}. Please check your environment variables.`,
        missing_keys: missingKeys
      });
    }
    
    const { spawn } = require('child_process');
    const pythonPath = path.join(__dirname, '../../../Code/enhanced_ai_tester.py');
    
    // Run the Python script with configuration
    const pythonProcess = spawn('python', [pythonPath, '--config', configPath], {
      cwd: path.join(__dirname, '../../..'),
      env: { ...process.env }
    });
    
    let output = '';
    let error = '';
    
    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      error += data.toString();
    });
    
    pythonProcess.on('close', (code) => {
      // This will run after the process completes, but we've already sent a response
      console.log(`AI testing process completed with code ${code}`);
      if (error) {
        console.error('AI testing errors:', error);
      }
    });
    
    // Send immediate response that test is starting
    res.json({ 
      success: true, 
      message: `AI testing started with ${testConfig.selected_vendors.length} vendors, ${testConfig.temperatures.length} temperatures, ${testConfig.num_repetitions} repetitions per test. This may take several minutes...`,
      status: 'running',
      config: testConfig
    });
    
  } catch (error) {
    console.error('Error starting AI test:', error);
    res.status(500).json({ error: 'Failed to start AI test' });
  }
});

// Test single question with XAI
router.post('/test-single-question', async (req, res) => {
  try {
    const { question, options, correctAnswer, includeConfidence } = req.body;
    
    // Validate input
    if (!question) {
      return res.status(400).json({ error: 'Question text is required' });
    }
    
    // Initialize XAI provider
    const xaiProvider = new XAIProvider();
    
    // Ask the question
    const result = await xaiProvider.askSingleQuestion(
      question, 
      options || [], 
      includeConfidence !== false
    );
    
    // Calculate CBM score if correct answer is provided
    let cbmScore = null;
    let isCorrect = null;
    
    if (correctAnswer && result.answer) {
      isCorrect = result.answer.toLowerCase() === correctAnswer.toLowerCase();
      cbmScore = xaiProvider.calculateCBMScore(result.answer, correctAnswer, result.confidence_level);
    }
    
    // Format response
    const response = {
      success: true,
      result: {
        ...result,
        is_correct: isCorrect,
        cbm_score: cbmScore,
        correct_answer: correctAnswer,
        timestamp: new Date().toISOString()
      }
    };
    
    res.json(response);
    
  } catch (error) {
    console.error('Error testing single question with XAI:', error);
    res.status(500).json({ 
      error: 'Failed to test question with XAI', 
      details: error.message 
    });
  }
});

// Test single question from MCQ database
router.post('/test-mcq-question', async (req, res) => {
  try {
    const { questionId } = req.body;
    
    // Load MCQ questions
    const mcqPath = path.join(__dirname, '../../../Code/mcq.json');
    const mcqData = await fs.readFile(mcqPath, 'utf8');
    const mcq = JSON.parse(mcqData);
    
    // Find the question
    const question = mcq.questions.find(q => q.id === parseInt(questionId));
    
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }
    
    // Initialize XAI provider
    const xaiProvider = new XAIProvider();
    
    // Ask the question
    const result = await xaiProvider.askSingleQuestion(
      question.question, 
      question.options, 
      true
    );
    
    // Calculate results
    const isCorrect = result.answer && result.answer.toLowerCase() === question.correctAnswer.toLowerCase();
    const cbmScore = xaiProvider.calculateCBMScore(result.answer, question.correctAnswer, result.confidence_level);
    
    // Format response
    const response = {
      success: true,
      question: {
        id: question.id,
        text: question.question,
        options: question.options,
        correct_answer: question.correctAnswer
      },
      result: {
        ...result,
        is_correct: isCorrect,
        cbm_score: cbmScore,
        timestamp: new Date().toISOString()
      }
    };
    
    res.json(response);
    
  } catch (error) {
    console.error('Error testing MCQ question with XAI:', error);
    res.status(500).json({ 
      error: 'Failed to test MCQ question with XAI', 
      details: error.message 
    });
  }
});

// Get available MCQ questions for testing
router.get('/mcq-questions', async (req, res) => {
  try {
    const mcqPath = path.join(__dirname, '../../../Code/mcq.json');
    const mcqData = await fs.readFile(mcqPath, 'utf8');
    const mcq = JSON.parse(mcqData);
    
    // Return simplified question list
    const questions = mcq.questions.map(q => ({
      id: q.id,
      question: q.question,
      options: q.options,
      correctAnswer: q.correctAnswer
    }));
    
    res.json({
      success: true,
      questions: questions,
      total: questions.length
    });
    
  } catch (error) {
    console.error('Error loading MCQ questions:', error);
    res.status(500).json({ 
      error: 'Failed to load MCQ questions', 
      details: error.message 
    });
  }
});

// Helper function to calculate correlation
function calculateCorrelation(x, y) {
  const n = x.length;
  if (n === 0) return 0;
  
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
  const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);
  
  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  
  return denominator === 0 ? 0 : numerator / denominator;
}

module.exports = router;
