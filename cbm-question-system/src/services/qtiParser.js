const xml2js = require('xml2js');
const { DOMParser } = require('xmldom');

class QTIParser {
  constructor() {
    this.parser = new xml2js.Parser({ 
      explicitArray: false,
      ignoreAttrs: false,
      attrkey: '@',
      charkey: '#'
    });
  }

  /**
   * Parse QTI XML content and extract questions
   * @param {string} xmlContent - Raw QTI XML content
   * @returns {Array} Array of parsed question objects
   */
  async parseQTI(xmlContent) {
    try {
      const result = await this.parser.parseStringPromise(xmlContent);
      const questions = [];
      
      // Handle different QTI structures
      if (result.questestinterop) {
        // QTI 1.2 format (Canvas export format)
        const items = this.extractItems(result.questestinterop);
        for (const item of items) {
          const question = this.parseQTI12Item(item);
          if (question) {
            questions.push(question);
          }
        }
      } else if (result.assessmentTest || result.assessmentItem) {
        // QTI 2.x format
        const items = result.assessmentTest ? 
          this.extractQTI2Items(result.assessmentTest) : 
          [result.assessmentItem];
        
        for (const item of items) {
          const question = this.parseQTI2Item(item);
          if (question) {
            questions.push(question);
          }
        }
      }
      
      return questions;
    } catch (error) {
      throw new Error(`Failed to parse QTI XML: ${error.message}`);
    }
  }

  /**
   * Extract items from QTI 1.2 format
   */
  extractItems(questestinterop) {
    const items = [];
    
    if (questestinterop.item) {
      if (Array.isArray(questestinterop.item)) {
        items.push(...questestinterop.item);
      } else {
        items.push(questestinterop.item);
      }
    }
    
    if (questestinterop.assessment && questestinterop.assessment.section) {
      const sections = Array.isArray(questestinterop.assessment.section) ? 
        questestinterop.assessment.section : [questestinterop.assessment.section];
      
      for (const section of sections) {
        if (section.item) {
          if (Array.isArray(section.item)) {
            items.push(...section.item);
          } else {
            items.push(section.item);
          }
        }
      }
    }
    
    return items;
  }

  /**
   * Parse QTI 1.2 item
   */
  parseQTI12Item(item) {
    try {
      const question = {
        qti_identifier: item['@'] ? item['@'].ident : null,
        question_text: '',
        question_type: 'multiple_choice',
        correct_answer: '',
        options: [],
        complexity_level: 5, // Default complexity
        topic: null,
        subtopic: null,
        keywords: [],
        created_by: 'qti_import',
        qti_metadata: {}
      };

      // Extract title
      if (item['@'] && item['@'].title) {
        question.topic = item['@'].title;
      }

      // Extract question text
      if (item.presentation && item.presentation.material) {
        question.question_text = this.extractText(item.presentation.material);
      }

      // Extract question type and answers
      if (item.presentation && item.presentation.response_lid) {
        const responseType = item.presentation.response_lid;
        question.question_type = 'multiple_choice';
        question.options = this.parseMultipleChoiceAnswers(responseType);
      } else if (item.presentation && item.presentation.response_str) {
        question.question_type = 'short_answer';
        question.options = [];
      } else if (item.presentation && item.presentation.response_num) {
        question.question_type = 'short_answer'; // Treat numerical as short answer
        question.options = [];
      }

      // Extract correct answers from resprocessing
      if (item.resprocessing) {
        this.processCorrectAnswers(item.resprocessing, question);
      }

      // Extract metadata
      if (item.itemmetadata) {
        question.qti_metadata = this.extractMetadata(item.itemmetadata);
        
        // Extract complexity level from metadata if available
        if (question.qti_metadata.points_possible) {
          const points = parseFloat(question.qti_metadata.points_possible);
          // Map points to complexity (1-10 scale)
          question.complexity_level = Math.min(10, Math.max(1, Math.round(points * 2)));
        }
        
        // Extract topic information
        if (question.qti_metadata.topic) {
          question.topic = question.qti_metadata.topic;
        }
      }

      // Generate keywords from question text
      question.keywords = this.generateKeywords(question.question_text);

      return question;
    } catch (error) {
      console.error('Error parsing QTI 1.2 item:', error);
      return null;
    }
  }

  /**
   * Parse QTI 2.x item (basic implementation)
   */
  parseQTI2Item(item) {
    // Basic QTI 2.x parsing - can be extended
    console.warn('QTI 2.x parsing is basic - may need enhancement for full compatibility');
    
    try {
      const question = {
        qti_identifier: item['@'] ? item['@'].identifier : null,
        question_text: '',
        question_type: 'multiple_choice',
        correct_answer: '',
        options: [],
        complexity_level: 5,
        topic: null,
        keywords: [],
        created_by: 'qti_import',
        qti_metadata: {}
      };

      // Extract question text from itemBody
      if (item.itemBody) {
        question.question_text = this.extractQTI2Text(item.itemBody);
      }

      return question;
    } catch (error) {
      console.error('Error parsing QTI 2.x item:', error);
      return null;
    }
  }

  /**
   * Extract text content from material elements
   */
  extractText(material) {
    if (typeof material === 'string') {
      return material;
    }
    
    if (material.mattext) {
      if (typeof material.mattext === 'string') {
        return material.mattext;
      }
      if (material.mattext['#']) {
        return material.mattext['#'];
      }
    }
    
    if (material.mattextxml) {
      return this.cleanHTML(material.mattextxml);
    }
    
    return '';
  }

  /**
   * Extract text from QTI 2.x format
   */
  extractQTI2Text(itemBody) {
    // Basic text extraction for QTI 2.x
    if (typeof itemBody === 'string') {
      return this.cleanHTML(itemBody);
    }
    
    // Handle nested structures
    if (itemBody.p) {
      return this.cleanHTML(itemBody.p);
    }
    
    return '';
  }

  /**
   * Parse multiple choice answers
   */
  parseMultipleChoiceAnswers(responseType) {
    const answers = [];
    
    if (responseType.render_choice && responseType.render_choice.response_label) {
      const labels = Array.isArray(responseType.render_choice.response_label) ?
        responseType.render_choice.response_label :
        [responseType.render_choice.response_label];
      
      for (const label of labels) {
        const answerText = this.extractText(label.material || {});
        if (answerText.trim()) {
          answers.push(answerText.trim());
        }
        
        // Store identifier for correct answer matching
        if (label['@'] && label['@'].ident) {
          label._identifier = label['@'].ident;
          label._text = answerText.trim();
        }
      }
    }
    
    return answers;
  }

  /**
   * Process correct answers from resprocessing
   */
  processCorrectAnswers(resprocessing, question) {
    // Process response conditions to identify correct answers
    if (resprocessing.respcondition) {
      const conditions = Array.isArray(resprocessing.respcondition) ?
        resprocessing.respcondition : [resprocessing.respcondition];
      
      for (const condition of conditions) {
        if (condition.conditionvar && condition.conditionvar.varequal) {
          const varequal = condition.conditionvar.varequal;
          const correctAnswerId = typeof varequal === 'string' ? varequal : varequal['#'];
          
          // Find the answer text for this identifier
          if (question.question_type === 'multiple_choice' && question.options.length > 0) {
            // For multiple choice, set the first option as correct answer for now
            // This could be enhanced to match by identifier
            question.correct_answer = question.options[0];
          }
        }
      }
    }

    // Extract points/score information
    if (resprocessing.outcomes) {
      const outcomes = Array.isArray(resprocessing.outcomes) ?
        resprocessing.outcomes : [resprocessing.outcomes];
      
      for (const outcome of outcomes) {
        if (outcome.decvar && outcome.decvar['@']) {
          if (outcome.decvar['@'].varname === 'SCORE') {
            const maxValue = parseFloat(outcome.decvar['@'].maxvalue);
            if (maxValue) {
              // Map score to complexity level (1-10 scale)
              question.complexity_level = Math.min(10, Math.max(1, Math.round(maxValue * 2)));
            }
          }
        }
      }
    }
  }

  /**
   * Extract metadata
   */
  extractMetadata(itemmetadata) {
    const metadata = {};
    
    if (itemmetadata.qtimetadata && itemmetadata.qtimetadata.qtimetadatafield) {
      const fields = Array.isArray(itemmetadata.qtimetadata.qtimetadatafield) ?
        itemmetadata.qtimetadata.qtimetadatafield :
        [itemmetadata.qtimetadata.qtimetadatafield];
      
      for (const field of fields) {
        if (field.fieldlabel && field.fieldentry) {
          metadata[field.fieldlabel] = field.fieldentry;
        }
      }
    }
    
    return metadata;
  }

  /**
   * Clean HTML content
   */
  cleanHTML(html) {
    if (typeof html !== 'string') {
      return '';
    }
    
    // Basic HTML cleaning - remove dangerous elements and clean up
    return html
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
      .replace(/on\w+="[^"]*"/gi, '') // Remove event handlers
      .replace(/<[^>]+>/g, ' ') // Remove HTML tags
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Generate keywords from question text
   */
  generateKeywords(text) {
    if (!text || typeof text !== 'string') return [];
    
    // Simple keyword extraction - remove common words and short words
    const commonWords = ['the', 'is', 'are', 'was', 'were', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'what', 'how', 'why', 'when', 'where', 'which'];
    
    return text.toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .split(/\s+/)
      .filter(word => word.length > 3 && !commonWords.includes(word))
      .slice(0, 10); // Limit to 10 keywords
  }

  /**
   * Validate parsed question
   */
  validateQuestion(question) {
    const errors = [];
    
    if (!question.question_text || question.question_text.trim() === '') {
      errors.push('Question text is required');
    }
    
    if (question.question_text && question.question_text.length < 10) {
      errors.push('Question text must be at least 10 characters long');
    }
    
    if (!question.question_type) {
      errors.push('Question type is required');
    }
    
    if (question.question_type === 'multiple_choice' && (!question.options || question.options.length < 2)) {
      errors.push('Multiple choice questions must have at least 2 answer options');
    }
    
    if (!question.correct_answer || question.correct_answer.trim() === '') {
      // For multiple choice, try to set first option as correct answer
      if (question.question_type === 'multiple_choice' && question.options && question.options.length > 0) {
        question.correct_answer = question.options[0];
      } else {
        errors.push('Correct answer is required');
      }
    }
    
    if (question.complexity_level < 1 || question.complexity_level > 10) {
      errors.push('Complexity level must be between 1 and 10');
    }
    
    return errors;
  }

  /**
   * Convert QTI question to database format
   */
  convertToDBFormat(qtiQuestion) {
    return {
      question_text: qtiQuestion.question_text,
      question_type: qtiQuestion.question_type,
      correct_answer: qtiQuestion.correct_answer,
      options: qtiQuestion.options,
      complexity_level: qtiQuestion.complexity_level,
      topic: qtiQuestion.topic,
      subtopic: qtiQuestion.subtopic,
      keywords: qtiQuestion.keywords,
      created_by: qtiQuestion.created_by || 'qti_import',
      qti_metadata: qtiQuestion.qti_metadata
    };
  }
}

module.exports = QTIParser;
