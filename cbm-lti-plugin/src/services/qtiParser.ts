/**
 * QTI 1.2 Parser — extracts questions from Canvas QTI ZIP exports.
 * Ported from cbm-question-system/src/services/qtiParser.js
 */

import AdmZip from 'adm-zip';
import { parseString } from 'xml2js';
import { v4 as uuid } from 'uuid';
import { QTIQuestion, QuestionOption } from '../types';

function parseXml(xml: string): Promise<any> {
  return new Promise((resolve, reject) => {
    parseString(xml, { explicitArray: false, trim: true }, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

function cleanHTML(html: string): string {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function ensureArray(val: any): any[] {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

function parseMultipleChoiceItem(item: any): QTIQuestion | null {
  try {
    const ident = item.$.ident || uuid();

    // Extract question text
    const presentation = item.presentation;
    if (!presentation) return null;

    let questionText = '';
    const material = presentation.material;
    if (material) {
      const mattext = material.mattext;
      if (mattext) {
        questionText = typeof mattext === 'string' ? mattext : mattext._ || mattext.toString();
      }
    }

    // Extract response options
    const responseLid = presentation.response_lid;
    if (!responseLid) return null;

    const renderChoice = responseLid.render_choice;
    if (!renderChoice) return null;

    const responseLabels = ensureArray(renderChoice.response_label);
    const options: QuestionOption[] = responseLabels.map((label: any, idx: number) => {
      const labelIdent = label.$.ident || `opt_${idx}`;
      let text = '';
      if (label.material?.mattext) {
        const mt = label.material.mattext;
        text = typeof mt === 'string' ? mt : mt._ || mt.toString();
      }
      return { id: labelIdent, text: cleanHTML(text) };
    });

    // Extract correct answer from resprocessing
    let correctAnswer = '';
    const resprocessing = item.resprocessing;
    if (resprocessing) {
      const respconditions = ensureArray(resprocessing.respcondition);
      for (const cond of respconditions) {
        // Look for the condition that sets score
        const setvar = cond.setvar;
        if (setvar) {
          const score = typeof setvar === 'string' ? setvar : setvar._ || '0';
          if (parseFloat(score) > 0 && cond.conditionvar) {
            const varequal = cond.conditionvar.varequal;
            if (varequal) {
              correctAnswer = typeof varequal === 'string' ? varequal : varequal._ || '';
            }
          }
        }
      }
    }

    // Determine question type
    let questionType = 'multiple_choice';
    if (options.length === 2) {
      const texts = options.map(o => o.text.toLowerCase());
      if (texts.includes('true') && texts.includes('false')) {
        questionType = 'true_false';
      }
    }

    return {
      qti_identifier: ident,
      question_text: cleanHTML(questionText),
      question_type: questionType,
      options,
      correct_answer: correctAnswer,
      complexity_level: 5,
    };
  } catch (e) {
    console.error('Error parsing QTI item:', e);
    return null;
  }
}

/**
 * Parse a QTI ZIP file and extract all questions.
 */
export async function parseQTIZip(zipPath: string): Promise<QTIQuestion[]> {
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();
  const questions: QTIQuestion[] = [];

  for (const entry of entries) {
    if (!entry.entryName.endsWith('.xml')) continue;
    if (entry.entryName.includes('imsmanifest')) continue;

    const xml = entry.getData().toString('utf-8');

    try {
      const parsed = await parseXml(xml);

      // Find assessment items
      let items: any[] = [];

      // QTI 1.2 structure: questestinterop > assessment > section > item
      const root = parsed.questestinterop || parsed.questestInterop;
      if (root) {
        const assessment = root.assessment;
        if (assessment) {
          const sections = ensureArray(assessment.section);
          for (const section of sections) {
            items.push(...ensureArray(section.item));
          }
        }
      }

      for (const item of items) {
        if (!item) continue;
        const q = parseMultipleChoiceItem(item);
        if (q && q.question_text && q.options.length > 0) {
          questions.push(q);
        }
      }
    } catch (e) {
      // Skip unparseable XML files
      console.warn(`Skipping ${entry.entryName}: ${e}`);
    }
  }

  return questions;
}

/**
 * Parse QTI from an XML string directly.
 */
export async function parseQTIXml(xml: string): Promise<QTIQuestion[]> {
  const parsed = await parseXml(xml);
  const questions: QTIQuestion[] = [];

  const root = parsed.questestinterop || parsed.questestInterop;
  if (!root) return questions;

  const assessment = root.assessment;
  if (!assessment) return questions;

  const sections = ensureArray(assessment.section);
  for (const section of sections) {
    const items = ensureArray(section.item);
    for (const item of items) {
      if (!item) continue;
      const q = parseMultipleChoiceItem(item);
      if (q && q.question_text && q.options.length > 0) {
        questions.push(q);
      }
    }
  }

  return questions;
}
