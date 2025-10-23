#!/usr/bin/env node

// Simple test script for XAI integration without server dependencies
const XAIProvider = require('./src/services/xaiService');

async function testXAI() {
  console.log('Testing XAI Integration...\n');

  try {
    const xaiProvider = new XAIProvider();
    
    // Test with a simple question from the MCQ set
    const testQuestion = "What do we mean by meaningful play?";
    const testOptions = [
      { key: "a", text: "That the rules of the game provide a fair contest" },
      { key: "b", text: "That there is an enjoyable outcome from the game" },
      { key: "c", text: "That the game has strong narrative content" },
      { key: "d", text: "That it is easy to link your actions to consequences" },
      { key: "e", text: "That the play results in meaning" }
    ];
    const correctAnswer = "d";

    console.log(`Question: ${testQuestion}\n`);
    testOptions.forEach(option => {
      console.log(`${option.key.toUpperCase()}. ${option.text}`);
    });
    console.log(`\nCorrect Answer: ${correctAnswer}\n`);

    // Test the XAI service
    console.log('Asking XAI (Grok-4)...');
    const result = await xaiProvider.askSingleQuestion(testQuestion, testOptions, true);
    
    console.log('\n=== XAI Response ===');
    console.log(`Raw Response: ${result.response}`);
    console.log(`Parsed Answer: ${result.answer}`);
    console.log(`Confidence Level: ${result.confidence_level}`);
    console.log(`Confidence Description: ${result.confidence_description}`);
    console.log(`Processing Time: ${result.processing_time}ms`);
    
    // Calculate results
    const isCorrect = result.answer && result.answer.toLowerCase() === correctAnswer.toLowerCase();
    const cbmScore = xaiProvider.calculateCBMScore(result.answer, correctAnswer, result.confidence_level);
    
    console.log('\n=== Results ===');
    console.log(`Is Correct: ${isCorrect ? '✓' : '✗'}`);
    console.log(`CBM Score: ${cbmScore}`);
    
    // Test without confidence
    console.log('\n\n=== Testing without confidence requirement ===');
    const simpleResult = await xaiProvider.askSingleQuestion(testQuestion, testOptions, false);
    console.log(`Simple Response: ${simpleResult.response}`);
    console.log(`Answer: ${simpleResult.answer}`);
    
    console.log('\n✅ XAI Integration test completed successfully!');
    
  } catch (error) {
    console.error('\n❌ XAI Integration test failed:');
    console.error('Error:', error.message);
    
    if (error.message.includes('XAI API key not configured')) {
      console.log('\n💡 To fix this, set the XAI_API_KEY_CBM environment variable.');
      console.log('You can set it temporarily for testing like this:');
      console.log('XAI_API_KEY_CBM=your_api_key_here node test-xai.js');
    }
  }
}

// Run the test
testXAI();
