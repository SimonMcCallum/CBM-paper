const fs = require('fs').promises;
const pdfParse = require('pdf-parse');

async function extractPDFContent(pdfPath) {
  try {
    const pdfBuffer = await fs.readFile(pdfPath);
    const data = await pdfParse(pdfBuffer);
    
    return {
      text: data.text,
      pages: data.numpages,
      info: data.info,
      metadata: {
        wordCount: data.text.split(/\s+/).length,
        characterCount: data.text.length,
        extractedAt: new Date().toISOString()
      }
    };
  } catch (error) {
    throw new Error(`PDF extraction failed: ${error.message}`);
  }
}

async function preprocessContent(content) {
  const text = content.text;
  
  const sections = text.split(/\n\s*\n/).filter(section => section.trim().length > 0);
  
  const keywords = extractKeywords(text);
  const topics = identifyTopics(text);
  
  return {
    originalText: text,
    sections,
    keywords,
    topics,
    complexity: estimateComplexity(text),
    readabilityLevel: calculateReadabilityLevel(text)
  };
}

function extractKeywords(text) {
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3);
  
  const wordFreq = {};
  words.forEach(word => {
    wordFreq[word] = (wordFreq[word] || 0) + 1;
  });
  
  return Object.entries(wordFreq)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 20)
    .map(([word]) => word);
}

function identifyTopics(text) {
  const topicIndicators = [
    { topic: 'Programming', keywords: ['code', 'function', 'variable', 'algorithm', 'programming', 'software'] },
    { topic: 'Mathematics', keywords: ['equation', 'formula', 'calculate', 'theorem', 'proof', 'mathematics'] },
    { topic: 'Science', keywords: ['experiment', 'hypothesis', 'theory', 'research', 'data', 'analysis'] },
    { topic: 'Literature', keywords: ['author', 'character', 'plot', 'theme', 'narrative', 'literature'] },
    { topic: 'History', keywords: ['century', 'war', 'revolution', 'empire', 'civilization', 'historical'] }
  ];
  
  const lowerText = text.toLowerCase();
  
  return topicIndicators
    .map(({ topic, keywords }) => ({
      topic,
      relevance: keywords.filter(keyword => lowerText.includes(keyword)).length / keywords.length
    }))
    .filter(({ relevance }) => relevance > 0.1)
    .sort((a, b) => b.relevance - a.relevance);
}

function estimateComplexity(text) {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const avgWordsPerSentence = text.split(/\s+/).length / sentences.length;
  
  const complexWords = text.split(/\s+/).filter(word => word.length > 6).length;
  const totalWords = text.split(/\s+/).length;
  const complexWordRatio = complexWords / totalWords;
  
  let complexity = 1;
  if (avgWordsPerSentence > 15) complexity += 2;
  if (avgWordsPerSentence > 25) complexity += 2;
  if (complexWordRatio > 0.15) complexity += 2;
  if (complexWordRatio > 0.25) complexity += 2;
  
  return Math.min(complexity, 10);
}

function calculateReadabilityLevel(text) {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
  const words = text.split(/\s+/).length;
  const syllables = countSyllables(text);
  
  const fleschScore = 206.835 - (1.015 * (words / sentences)) - (84.6 * (syllables / words));
  
  if (fleschScore >= 90) return 'Very Easy';
  if (fleschScore >= 80) return 'Easy';
  if (fleschScore >= 70) return 'Fairly Easy';
  if (fleschScore >= 60) return 'Standard';
  if (fleschScore >= 50) return 'Fairly Difficult';
  if (fleschScore >= 30) return 'Difficult';
  return 'Very Difficult';
}

function countSyllables(text) {
  return text.toLowerCase()
    .split(/\s+/)
    .reduce((total, word) => {
      const syllableCount = word.match(/[aeiouy]+/g)?.length || 1;
      return total + syllableCount;
    }, 0);
}

module.exports = {
  extractPDFContent,
  preprocessContent
};