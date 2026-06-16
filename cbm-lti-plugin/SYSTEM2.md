# System 2 — Submission Validator ("claim of knowledge")

This document describes the **Submission Validator**: students submit a piece of
work as a *claim of knowledge*, and multiple-choice questions — drawn from the
course question bank by semantic (RAG) matching, topped up with LLM-generated
questions for genuinely novel content — validate that the work is theirs.

It consolidates the pipeline, the recommended deployment, and the changes made
to take it from scaffolded-but-broken to working.

---

## 1. End-to-end flow

```
Instructor (once):
  Canvas quiz  ──QTI export──▶  POST /api/quiz/import  ──▶ question_bank rows
                                       │
                                       └─(auto, fire-and-forget)─▶ sidecar /embed-bank
  OR
  Canvas REST  ──canvas_ingest.py──▶ question_bank rows ──▶ /api/validator/embed-bank

Student:
  LTI launch from NUKU ──▶ validator.html
  Upload PDF ──▶ POST /api/validator/submit
      └─ async analyzePipeline():
           1. sidecar /extract      → text + chunks
           2. sidecar /match        → FAISS cosine vs question_bank embeddings
                                        (≈60% of MCQs come from the bank)
           3. sidecar /generate-mcq → LLM MCQs from UNMATCHED (novel) chunks (≈40%)
           4. sidecar /generate-oral→ tutor-only oral questions
           5. store assessment_questions + deferred_assessments (timing)
  Answer MCQs with confidence ──▶ POST /api/validator/answer
      └─ CBM score → LTI AGS grade passback to Canvas
```

The matcher's whole premise is the **question bank must be embedded**. See §3.

---

## 2. What was fixed (June 2026)

The pipeline was structurally complete but had three breakages that meant it
could not actually validate against the bank:

1. **Bank embeddings were never generated.** `POST /api/quiz/import` populated
   `question_bank` but nothing ever embedded it, so `/match` joined an empty
   `question_embeddings` table → 0 bank matches → the 60/40 bank/generated split
   silently became 0/100 (everything LLM-generated).
   *Fix:* `quiz.ts` now calls the sidecar `/embed-bank` (fire-and-forget) after
   import; a new admin proxy `POST /api/validator/embed-bank` allows re-embedding
   with `{force, expand}`.

2. **MCQ/oral generation used the wrong provider method.** `validator_api.py`
   called `provider.generate_prompt()`, which wraps input in the *novelty*
   system prompt ("write a 2-3 sentence prompt to regenerate this text") — so
   generated "questions" were nonsense.
   *Fix:* added `LLMProvider.complete(prompt, system, max_tokens)` (raw
   passthrough) to every provider and switched generation to it, plus robust
   `_extract_json()` parsing and `_valid_mcq()` validation so malformed MCQs
   never reach a student.

3. **`/match` could crash on model mismatch.** It built the FAISS index from
   stored vectors but encoded chunks with the *current* `EMBEDDING_MODEL`;
   differing dimensions threw.
   *Fix:* `/match` now reads the model name recorded on the stored embeddings
   and encodes chunks with the same model, and guards against mixed dimensions.

Also fixed: the O(n²)/buggy indexing in `/embed-bank`
(`texts[rows.index(...)]`), now a clean zip; embeddings now cover the question
**stem + options** (and an optional topic expansion — §4).

---

## 3. Embedding the bank (required before matching works)

After importing or editing questions, embed them:

```bash
# Automatic on QTI import (quiz.ts fires this). To run/repeat manually:
curl -X POST http://localhost:5000/api/validator/embed-bank \
     -H 'Content-Type: application/json' \
     -d '{"course_id": "12345"}'

# Force a full rebuild with LLM topic-expansion (better recall, slower):
curl -X POST http://localhost:5000/api/validator/embed-bank \
     -d '{"course_id":"12345","force":true,"expand":true}'
```

Embedding model is `EMBEDDING_MODEL` (default `all-MiniLM-L6-v2`, 384-d). The
model name is stored per-embedding so `/match` stays consistent even if the
default changes later. To switch models, re-embed with `force:true`.

---

## 4. RAG matching quality & topic expansion

Submission prose rarely echoes a question stem verbatim ("I built a hash table
with chaining" vs "Which collision-resolution strategy…"). Two levers:

- **Stem + options embedding** (always on) — the vector captures the full
  concept, not just the stem.
- **Topic expansion** (`expand:true`, or `VALIDATOR_EXPAND_TOPICS=1`) — an LLM
  rewrites each question into *the concepts it tests*, prepended before
  embedding. Off by default so embedding stays fast and offline-capable.

### Evaluating match quality

`novelty_detector/eval_matching.py` measures whether selected questions actually
probe a submission (precision/recall/F1 swept across thresholds):

```bash
python eval_matching.py --demo                       # built-in synthetic smoke test
python eval_matching.py --dataset eval_data.json     # your labelled data
```

The synthetic demo scores F1=1.0 up to threshold 0.5 and degrades at 0.6,
confirming the default `threshold=0.5` in `/match` is reasonable. Build a
labelled `eval_data.json` from real course data before tuning for production.

---

## 5. Extracting the bank from NUKU (Canvas)

Two supported paths (see the architecture review for the full trade-off table):

### a) QTI export → import (reliable, Classic Quizzes)
Export the quiz from Canvas (Classic) as a QTI 1.2 zip and `POST` it to
`/api/quiz/import`. Fully supported today; embeds automatically.

### b) Canvas REST API → bank (`Canvas_update/canvas_ingest.py`)
Stdlib-only tool (no pip install). Needs a teacher access token.

```bash
export CANVAS_BASE_URL=https://canvas.vuw.ac.nz      # NUKU
export CANVAS_API_TOKEN=xxxxx
export CBM_DATABASE_PATH=/path/to/cbm-lti.db

python Canvas_update/canvas_ingest.py --course 12345 --list      # inspect; flags New Quizzes
python Canvas_update/canvas_ingest.py --course 12345 --all --write
# then: POST /api/validator/embed-bank
```

- **Classic Quizzes**: fully supported — answers + correctness come from
  `/quizzes/:id/questions` (teacher token). Non-MCQ types are skipped and
  counted. Re-runs are idempotent (de-dupes on `canvas:<quiz>:<question>`).
- **New Quizzes**: detected (`is_quiz_lti_assignment`) and reported, but **not**
  ingested via the classic API.

> **Use Classic Quizzes only.** NUKU allows both Classic and New Quizzes, but
> **only Classic permits downloading all student responses** needed to process
> CBM scores (the `student_analysis` report / submissions export — see §5c). New
> Quizzes has no equivalent bulk-response export. So CBM assessments must use
> Classic Quizzes end-to-end.

> Canvas REST has no stable public "question banks" endpoint; banks are reached
> via quizzes or QTI export. This tool ingests per-quiz questions.

### c) Downloading responses for scoring (`Canvas_update/canvas_responses.py`)
For the Classic-quiz CBM workflow (confidence questions added via
`insertCBM.py`, students answer in Canvas, scores processed externally), pull
every student's answers via the canonical `student_analysis` report:

```bash
python Canvas_update/canvas_responses.py --course 12345 --quiz 678 \
       --out responses.csv --json responses.json
# or raw submissions:
python Canvas_update/canvas_responses.py --course 12345 --quiz 678 --submissions subs.json
```

It requests the report, polls until Canvas generates the CSV, downloads it, and
parses it losslessly into per-student records (`meta` + `answers`) for
`Code/score_analysis.py`. **This export is the reason Classic is mandatory.**

---

## 6. Privacy / data sovereignty (NZ Privacy Act 2020)

Student submissions are personal data. Defaults are privacy-preserving:

- **Embeddings**: local `sentence-transformers` — submission text never leaves
  the server.
- **Generation**: local Ollama by default. Cloud LLMs (Claude/GPT/Gemini) feed
  student work to a third party and are **opt-in only** via
  `VALIDATOR_ALLOW_CLOUD=1` (or a forced `VALIDATOR_LLM_PROVIDER=<name>`).
- Run production on a **VUW-hosted VM** to keep PII inside the institution;
  pilot on your own server only with student consent + ethics approval.

---

## 7. Auth / login

- **Primary**: LTI 1.3 launch from NUKU (already implemented in `src/lti/setup.ts`)
  — silent OIDC SSO, signed token carries user/course/roles + the AGS line item
  for grade passback. This is the smooth login path; no second sign-in.
- **Outside Canvas**: prefer deep-linking the ECS/VUW system *into* the Canvas
  assignment over building separate VUW SSO. If standalone access is truly
  required, add SAML/OIDC against the VUW IdP (likely Tuakiri) — but you lose the
  automatic AGS line item and must map IdP attributes to `student_id`/`course_id`.

---

## 8. Config reference (sidecar / validator)

| Env var | Default | Purpose |
|---|---|---|
| `EMBEDDING_MODEL` | `all-MiniLM-L6-v2` | sentence-transformers model for bank + chunks |
| `CBM_DATABASE_PATH` | `../cbm-lti-plugin/data/cbm-lti.db` | shared SQLite DB |
| `VALIDATOR_ALLOW_CLOUD` | `0` | allow cloud LLMs for generation (privacy opt-in) |
| `VALIDATOR_LLM_PROVIDER` | _(unset)_ | force a specific provider (overrides order) |
| `VALIDATOR_EXPAND_TOPICS` | `0` | default topic-expansion on at embed time |
| `SIDECAR_URL` (TS side) | `http://localhost:5000` | where the Node tool reaches the Python sidecar |

---

## 9. Tests

```bash
python -m pytest Canvas_update/test_canvas_ingest.py \
                 novelty_detector/test_validator_logic.py -q
```

Covers the Canvas transforms (MC/TF/multi-answer, skipping non-MCQ, pagination,
New-Quiz detection) and the validator helpers (JSON extraction, MCQ validation,
embedding-text construction, and the numpy matching/metric core).

---

## 10. Known gaps / next steps

- **Classic Quizzes are mandatory** (settled): only Classic exports the
  responses needed for scoring. Configure NUKU CBM assessments as Classic.
- `canvas_responses.py` report flow is unverified against live Canvas — the CSV
  column layout (answer/points pairing) varies by Canvas version; the parser is
  intentionally lossless. Validate against one real report before bulk use.
- `src/services/sidecar.ts` is an unused parallel client — `validator.ts` calls
  the sidecar via `axios` directly. Consolidate or remove to avoid drift.
- Two state stores (MongoDB for ltijs, SQLite for app) — fine for one host;
  define an API boundary before splitting services.
- Build a real labelled `eval_data.json` from course data to tune the match
  threshold and the bank/generated ratio per assignment.
