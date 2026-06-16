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
import re
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

# Embedding models are cached per model name (the question bank may have been
# embedded with a different model than the current default — see match_questions).
_embed_models: Dict[str, SentenceTransformer] = {}


def default_embedding_model() -> str:
    return os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")


def get_embed_model(model_name: Optional[str] = None) -> SentenceTransformer:
    name = model_name or default_embedding_model()
    if name not in _embed_models:
        _embed_models[name] = SentenceTransformer(name)
    return _embed_models[name]


def get_db_path() -> str:
    return os.getenv("CBM_DATABASE_PATH",
                     os.path.join(os.path.dirname(__file__), "../cbm-lti-plugin/data/cbm-lti.db"))


def get_llm_provider() -> LLMProvider:
    """Get the best available LLM provider for question generation.

    Privacy default: student submission text is processed locally (Ollama) and
    never leaves the server. Cloud providers are only used when the operator
    explicitly opts in with VALIDATOR_ALLOW_CLOUD=1, because generation feeds
    student work to the model. The keyword 'fallback' is always last resort.
    """
    providers = discover_providers()
    allow_cloud = os.getenv("VALIDATOR_ALLOW_CLOUD", "0") == "1"

    if allow_cloud:
        order = ["anthropic", "openai", "google", "ollama", "fallback"]
    else:
        order = ["ollama", "fallback"]

    # An explicit override always wins (e.g. VALIDATOR_LLM_PROVIDER=anthropic).
    forced = os.getenv("VALIDATOR_LLM_PROVIDER", "").strip().lower()
    if forced and forced in providers:
        return providers[forced]

    for name in order:
        if name in providers:
            return providers[name]
    return providers.get("fallback", list(providers.values())[0])


def _extract_json(response: str):
    """Best-effort extraction of a JSON value from an LLM response.

    Handles ```json fenced blocks, leading/trailing prose, and falls back to
    locating the outermost array/object. Returns the parsed value or None.
    """
    if not response:
        return None
    text = response.strip()

    # Strip code fences ```json ... ``` or ``` ... ```
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\n?", "", text)
        text = re.sub(r"\n?```$", "", text).strip()

    try:
        return json.loads(text)
    except Exception:
        pass

    # Fall back to the first balanced array or object substring.
    for open_ch, close_ch in (("[", "]"), ("{", "}")):
        start = text.find(open_ch)
        end = text.rfind(close_ch)
        if start != -1 and end != -1 and end > start:
            try:
                return json.loads(text[start:end + 1])
            except Exception:
                continue
    return None


def _embedding_text_for_question(question_text: str,
                                 options=None,
                                 expanded: Optional[str] = None) -> str:
    """Build the text used to embed a question.

    Includes the stem plus answer options so the vector captures the full
    concept being tested. If a topic-expansion string is supplied (concepts the
    question probes), it is prepended so submission prose — which rarely echoes
    a question stem verbatim — matches on shared concepts.
    """
    parts = []
    if expanded:
        parts.append(expanded.strip())
    parts.append(question_text or "")
    if options:
        try:
            opts = options if isinstance(options, list) else json.loads(options)
            parts.extend(o.get("text", "") for o in opts if isinstance(o, dict))
        except Exception:
            pass
    return "\n".join(p for p in parts if p).strip()


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
                   qe.embedding_vector, qe.embedding_model
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
            'warning': 'Question bank is empty for this course (run /embed-bank after import)'
        })

    # The chunks MUST be embedded with the same model the bank was embedded with,
    # otherwise vector dimensions/geometry differ. Use the model recorded on the
    # stored embeddings (assume consistent across a course's bank).
    bank_model_name = bank_rows[0]['embedding_model'] or default_embedding_model()
    model = get_embed_model(bank_model_name)

    # Build FAISS index from question bank embeddings
    bank_embeddings = []
    bank_questions = []
    expected_dim = None
    for row in bank_rows:
        emb = np.frombuffer(row['embedding_vector'], dtype=np.float32)
        if expected_dim is None:
            expected_dim = emb.shape[0]
        elif emb.shape[0] != expected_dim:
            # Skip vectors of inconsistent dimension (mixed-model bank).
            continue
        bank_embeddings.append(emb)
        bank_questions.append(dict(row))

    if not bank_embeddings:
        return jsonify({
            'matched_questions': [],
            'unmatched_chunks': chunks,
            'warning': 'Question bank embeddings had inconsistent dimensions'
        })

    bank_matrix = np.vstack(bank_embeddings).astype('float32')

    # Normalize for cosine similarity
    norms = np.linalg.norm(bank_matrix, axis=1, keepdims=True)
    norms[norms == 0] = 1
    bank_matrix = bank_matrix / norms

    dimension = bank_matrix.shape[1]
    index = faiss.IndexFlatIP(dimension)
    index.add(bank_matrix)

    # Embed submission chunks (same model as the bank)
    chunk_texts = [c['text'] for c in chunks]
    chunk_embeddings = np.asarray(model.encode(chunk_texts), dtype='float32')
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
            response = provider.complete(prompt, max_tokens=1500)
            parsed = _extract_json(response)
            if isinstance(parsed, list):
                all_questions.extend(q for q in parsed if _valid_mcq(q))
            elif isinstance(parsed, dict) and _valid_mcq(parsed):
                all_questions.append(parsed)
        except Exception as e:
            print(f"Error generating MCQs: {e}")
            continue

    return jsonify({'questions': all_questions[:count]})


def _valid_mcq(q) -> bool:
    """Reject malformed generated MCQs so they never reach a student."""
    if not isinstance(q, dict):
        return False
    if not q.get('question_text') or not q.get('correct_answer'):
        return False
    opts = q.get('options')
    if not isinstance(opts, list) or len(opts) < 2:
        return False
    ids = {o.get('id') for o in opts if isinstance(o, dict)}
    return q.get('correct_answer') in ids


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
        response = provider.complete(prompt, max_tokens=1500)
        parsed = _extract_json(response)
        if parsed is None:
            return jsonify({'questions': []})
        questions = parsed if isinstance(parsed, list) else [parsed]
        return jsonify({'questions': questions[:count]})
    except Exception as e:
        print(f"Error generating oral questions: {e}")
        return jsonify({'questions': [], 'error': str(e)})


# ── Topic expansion (improves submission↔question matching) ──

TOPIC_EXPANSION_PROMPT = """You are helping an assessment system match free-text \
student writing to multiple-choice questions by shared concepts.

Given the assessment question below, list the underlying concepts, skills and \
keywords it tests — the things a student would have to write about to demonstrate \
they could answer it. Do NOT give the answer. Output 2-3 sentences of plain text \
(no lists, no JSON).

QUESTION:
{question}
"""


def expand_question_topic(provider: LLMProvider, question_text: str, options) -> Optional[str]:
    """Return a short 'concepts tested' string for a question, or None on failure."""
    try:
        opt_text = ""
        opts = options if isinstance(options, list) else json.loads(options or "[]")
        if opts:
            opt_text = "\nOptions: " + "; ".join(
                o.get("text", "") for o in opts if isinstance(o, dict))
        out = provider.complete(
            TOPIC_EXPANSION_PROMPT.format(question=question_text + opt_text),
            max_tokens=200,
        )
        out = (out or "").strip()
        # Fallback provider returns "[]"; treat that as no expansion.
        return out if out and out != "[]" else None
    except Exception as e:
        print(f"Topic expansion failed: {e}")
        return None


# ── Embed Question Bank (admin utility) ──

@validator_bp.route('/embed-bank', methods=['POST'])
def embed_question_bank():
    """
    Generate embeddings for question bank entries.

    Body (all optional):
      course_id  — restrict to one course (NULL/global always included)
      force      — re-embed even questions that already have an embedding
      expand     — use the LLM to add a 'concepts tested' expansion before
                   embedding (better submission↔question recall; default off
                   so the endpoint stays fast and offline-capable)

    Call this after importing QTI questions (the TS import does it automatically).
    """
    import uuid as uuid_mod

    data = request.get_json() or {}
    course_id = data.get('course_id')
    force = bool(data.get('force', False))
    expand = bool(data.get('expand', os.getenv('VALIDATOR_EXPAND_TOPICS', '0') == '1'))

    model_name = default_embedding_model()
    model = get_embed_model(model_name)
    db_path = get_db_path()

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    where = "1=1"
    params: list = []
    if course_id:
        where = "(course_id = ? OR course_id IS NULL)"
        params.append(course_id)
    if not force:
        where += " AND id NOT IN (SELECT question_id FROM question_embeddings)"

    cursor.execute(
        f"SELECT id, question_text, options FROM question_bank WHERE {where}", params)
    rows = cursor.fetchall()

    if not rows:
        conn.close()
        return jsonify({'embedded': 0, 'message': 'No questions needed embedding'})

    provider = get_llm_provider() if expand else None

    # Build the text to embed for each question (stem + options [+ expansion]).
    texts = []
    for row in rows:
        expanded = expand_question_topic(provider, row['question_text'], row['options']) if provider else None
        texts.append(_embedding_text_for_question(row['question_text'], row['options'], expanded))

    embeddings = model.encode(texts)

    if force:
        # Replace existing vectors for these questions.
        qids = [row['id'] for row in rows]
        cursor.executemany(
            "DELETE FROM question_embeddings WHERE question_id = ?",
            [(q,) for q in qids])

    for row, text_used, emb in zip(rows, texts, embeddings):
        emb_bytes = np.asarray(emb, dtype=np.float32).tobytes()
        cursor.execute("""
            INSERT INTO question_embeddings (id, question_id, embedding_model, embedding_vector, text_used)
            VALUES (?, ?, ?, ?, ?)
        """, (str(uuid_mod.uuid4()), row['id'], model_name, emb_bytes, text_used[:200]))

    conn.commit()
    conn.close()

    return jsonify({
        'embedded': len(rows),
        'model': model_name,
        'expanded': bool(provider),
    })
