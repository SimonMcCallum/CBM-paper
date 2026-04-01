"""
Submission Validator API — Python sidecar endpoints for System 2.

Provides:
- PDF text extraction and chunking
- FAISS similarity search against question bank embeddings
- LLM-based MCQ generation from novel content
- Oral question generation for tutors

Runs as a Flask Blueprint alongside the existing novelty detector.
"""

import os
import json
import sqlite3
import numpy as np
from typing import List, Dict, Optional
from flask import Blueprint, request, jsonify
from sentence_transformers import SentenceTransformer
import faiss

from pdf_processor import PDFProcessor
from llm_providers import discover_providers, LLMProvider

validator_bp = Blueprint('validator', __name__, url_prefix='/api/validator')

# Shared embedding model (loaded once)
_embed_model = None

def get_embed_model() -> SentenceTransformer:
    global _embed_model
    if _embed_model is None:
        model_name = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
        _embed_model = SentenceTransformer(model_name)
    return _embed_model


def get_db_path() -> str:
    return os.getenv("CBM_DATABASE_PATH",
                     os.path.join(os.path.dirname(__file__), "../cbm-lti-plugin/data/cbm-lti.db"))


def get_llm_provider() -> LLMProvider:
    """Get the best available LLM provider."""
    providers = discover_providers()
    # Prefer cloud providers over fallback for question generation
    for name in ["anthropic", "openai", "google", "ollama"]:
        if name in providers:
            return providers[name]
    return providers.get("fallback", list(providers.values())[0])


# ── Extract & Chunk ──

@validator_bp.route('/extract', methods=['POST'])
def extract_text():
    """Extract text from PDF and chunk it."""
    data = request.get_json()
    pdf_path = data.get('pdf_path')
    if not pdf_path or not os.path.exists(pdf_path):
        return jsonify({'error': 'PDF file not found'}), 400

    processor = PDFProcessor(
        chunk_size=int(data.get('chunk_size', 150)),
        overlap=int(data.get('overlap', 20)),
        chunking_mode=data.get('chunking_mode', 'paragraph')
    )

    text = processor.extract_text(pdf_path)
    chunks = processor.chunk_text(text)

    return jsonify({
        'chunks': chunks,
        'word_count': sum(c['word_count'] for c in chunks),
        'full_text': text[:5000],  # First 5K chars for preview
    })


# ── FAISS Match Against Question Bank ──

@validator_bp.route('/match', methods=['POST'])
def match_questions():
    """
    Match submission chunks against question bank embeddings.

    For each chunk, finds the most similar question bank entry.
    Returns matched questions and unmatched chunks (novel content).
    """
    data = request.get_json()
    chunks = data.get('chunks', [])
    course_id = data.get('course_id', '')
    max_questions = data.get('max_questions', 6)
    similarity_threshold = data.get('threshold', 0.5)

    if not chunks:
        return jsonify({'error': 'No chunks provided'}), 400

    model = get_embed_model()
    db_path = get_db_path()

    # Load question bank for this course
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # Get questions with embeddings
        cursor.execute("""
            SELECT qb.id, qb.question_text, qb.question_type, qb.options,
                   qb.correct_answer, qb.explanation, qb.topic,
                   qe.embedding_vector
            FROM question_bank qb
            JOIN question_embeddings qe ON qe.question_id = qb.id
            WHERE qb.course_id = ? OR qb.course_id IS NULL
        """, (course_id,))
        bank_rows = cursor.fetchall()
        conn.close()
    except Exception as e:
        return jsonify({
            'matched_questions': [],
            'unmatched_chunks': chunks,
            'warning': f'Could not load question bank: {e}'
        })

    if not bank_rows:
        return jsonify({
            'matched_questions': [],
            'unmatched_chunks': chunks,
            'warning': 'Question bank is empty for this course'
        })

    # Build FAISS index from question bank embeddings
    bank_embeddings = []
    bank_questions = []
    for row in bank_rows:
        emb = np.frombuffer(row['embedding_vector'], dtype=np.float32)
        bank_embeddings.append(emb)
        bank_questions.append(dict(row))
    bank_matrix = np.vstack(bank_embeddings).astype('float32')

    # Normalize for cosine similarity
    norms = np.linalg.norm(bank_matrix, axis=1, keepdims=True)
    norms[norms == 0] = 1
    bank_matrix = bank_matrix / norms

    dimension = bank_matrix.shape[1]
    index = faiss.IndexFlatIP(dimension)
    index.add(bank_matrix)

    # Embed submission chunks
    chunk_texts = [c['text'] for c in chunks]
    chunk_embeddings = model.encode(chunk_texts)
    chunk_norms = np.linalg.norm(chunk_embeddings, axis=1, keepdims=True)
    chunk_norms[chunk_norms == 0] = 1
    chunk_embeddings = chunk_embeddings / chunk_norms

    # Search: for each chunk, find the most similar bank question
    matched_questions = []
    matched_bank_ids = set()
    unmatched_chunks = []

    for i, chunk in enumerate(chunks):
        query = chunk_embeddings[i:i+1].astype('float32')
        distances, indices = index.search(query, min(5, len(bank_questions)))

        best_match = None
        for dist, idx in zip(distances[0], indices[0]):
            if idx < 0:
                continue
            q = bank_questions[idx]
            if q['id'] in matched_bank_ids:
                continue
            if dist >= similarity_threshold:
                best_match = q
                best_match['similarity'] = float(dist)
                break

        if best_match and len(matched_questions) < max_questions:
            matched_questions.append({
                'question_bank_id': best_match['id'],
                'question_text': best_match['question_text'],
                'question_type': best_match['question_type'],
                'options': json.loads(best_match['options']) if isinstance(best_match['options'], str) else best_match['options'],
                'correct_answer': best_match['correct_answer'],
                'explanation': best_match.get('explanation'),
                'topic': best_match.get('topic'),
                'similarity': best_match['similarity'],
            })
            matched_bank_ids.add(best_match['id'])
        else:
            unmatched_chunks.append(chunk)

    return jsonify({
        'matched_questions': matched_questions,
        'unmatched_chunks': unmatched_chunks,
        'bank_size': len(bank_questions),
    })


# ── Generate MCQs from Novel Content ──

MCQ_PROMPT = """You are an expert educator creating multiple-choice assessment questions.

Given the following text from a student's essay, create {count} multiple-choice question(s) that test whether the student truly understands this content.

TEXT:
{text}

Requirements:
- Each question should have 4 options (A, B, C, D)
- Exactly one option must be correct
- Distractors should be plausible but clearly wrong to someone who understands the material
- Questions should test comprehension, not just recall
- Include a brief explanation for the correct answer

Respond in JSON format:
[
  {{
    "question_text": "...",
    "options": [
      {{"id": "A", "text": "..."}},
      {{"id": "B", "text": "..."}},
      {{"id": "C", "text": "..."}},
      {{"id": "D", "text": "..."}}
    ],
    "correct_answer": "A",
    "explanation": "...",
    "topic": "..."
  }}
]

Return ONLY valid JSON, no other text."""


@validator_bp.route('/generate-mcq', methods=['POST'])
def generate_mcq():
    """Generate MCQ questions from novel (unmatched) content chunks."""
    data = request.get_json()
    chunks = data.get('chunks', [])
    count = data.get('count', 4)

    if not chunks:
        return jsonify({'questions': []})

    provider = get_llm_provider()

    # Combine chunks into context blocks (max ~500 words each)
    text_blocks = []
    current_block = []
    current_words = 0
    for chunk in chunks:
        words = len(chunk['text'].split())
        if current_words + words > 500 and current_block:
            text_blocks.append(' '.join(current_block))
            current_block = [chunk['text']]
            current_words = words
        else:
            current_block.append(chunk['text'])
            current_words += words
    if current_block:
        text_blocks.append(' '.join(current_block))

    # Generate questions from each block
    all_questions = []
    questions_per_block = max(1, count // len(text_blocks))

    for block in text_blocks:
        if len(all_questions) >= count:
            break

        prompt = MCQ_PROMPT.format(
            count=min(questions_per_block, count - len(all_questions)),
            text=block[:2000]
        )

        try:
            response = provider.generate_prompt(prompt)
            # Parse JSON from response
            # Try to extract JSON array from the response
            response = response.strip()
            if response.startswith('```'):
                response = response.split('```')[1]
                if response.startswith('json'):
                    response = response[4:]
            parsed = json.loads(response)
            if isinstance(parsed, list):
                all_questions.extend(parsed)
            elif isinstance(parsed, dict):
                all_questions.append(parsed)
        except Exception as e:
            print(f"Error generating MCQs: {e}")
            continue

    return jsonify({'questions': all_questions[:count]})


# ── Generate Oral Questions for Tutors ──

ORAL_PROMPT = """You are an expert educator creating oral assessment questions for tutors.

Given the following text from a student's essay, create {count} oral question(s) that a tutor could ask to verify the student's understanding. These are open-ended questions that cannot be answered by simply memorizing the text.

TEXT:
{text}

Requirements:
- Questions should probe deep understanding, application, or critical thinking
- Include expected answer points (key things the student should mention)
- Vary difficulty from moderate to challenging
- Questions should be conversational and open-ended

Respond in JSON format:
[
  {{
    "question_text": "...",
    "expected_answer_points": ["point 1", "point 2", "point 3"],
    "topic": "...",
    "difficulty": "moderate|challenging|advanced"
  }}
]

Return ONLY valid JSON, no other text."""


@validator_bp.route('/generate-oral', methods=['POST'])
def generate_oral():
    """Generate oral questions for tutor assessment."""
    data = request.get_json()
    chunks = data.get('chunks', [])
    count = data.get('count', 3)

    if not chunks:
        return jsonify({'questions': []})

    provider = get_llm_provider()

    # Use a representative sample of chunks
    sample_text = ' '.join(c['text'] for c in chunks[:5])[:3000]

    prompt = ORAL_PROMPT.format(count=count, text=sample_text)

    try:
        response = provider.generate_prompt(prompt)
        response = response.strip()
        if response.startswith('```'):
            response = response.split('```')[1]
            if response.startswith('json'):
                response = response[4:]
        parsed = json.loads(response)
        questions = parsed if isinstance(parsed, list) else [parsed]
        return jsonify({'questions': questions[:count]})
    except Exception as e:
        print(f"Error generating oral questions: {e}")
        return jsonify({'questions': [], 'error': str(e)})


# ── Embed Question Bank (admin utility) ──

@validator_bp.route('/embed-bank', methods=['POST'])
def embed_question_bank():
    """
    Generate embeddings for all question bank entries that don't have them.
    Call this after importing QTI questions.
    """
    data = request.get_json() or {}
    course_id = data.get('course_id')

    model = get_embed_model()
    db_path = get_db_path()

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Find questions without embeddings
    if course_id:
        cursor.execute("""
            SELECT id, question_text FROM question_bank
            WHERE (course_id = ? OR course_id IS NULL)
            AND id NOT IN (SELECT question_id FROM question_embeddings)
        """, (course_id,))
    else:
        cursor.execute("""
            SELECT id, question_text FROM question_bank
            WHERE id NOT IN (SELECT question_id FROM question_embeddings)
        """)

    rows = cursor.fetchall()
    if not rows:
        conn.close()
        return jsonify({'embedded': 0, 'message': 'All questions already have embeddings'})

    # Generate embeddings in batches
    import uuid as uuid_mod
    model_name = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
    texts = [row[1] for row in rows]
    embeddings = model.encode(texts)

    for (qid, _), emb in zip(rows, embeddings):
        emb_bytes = emb.astype(np.float32).tobytes()
        cursor.execute("""
            INSERT INTO question_embeddings (id, question_id, embedding_model, embedding_vector, text_used)
            VALUES (?, ?, ?, ?, ?)
        """, (str(uuid_mod.uuid4()), qid, model_name, emb_bytes, texts[rows.index((qid, _))][:200]))

    conn.commit()
    conn.close()

    return jsonify({
        'embedded': len(rows),
        'model': model_name,
    })
