# Getting Started with CBM Assessment System

This guide will help you set up and test the system locally using the mock course infrastructure.

## Quick Start (5 minutes)

### 1. Install Dependencies

```bash
cd submission-assessment-system
npm install
```

### 2. Set Up Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env and add your API keys (at minimum, one LLM provider)
nano .env
```

**Required Configuration:**
- At least one LLM API key (Claude, Gemini, or GPT)
- All other settings have sensible defaults for testing

Example minimal `.env`:
```env
# Just add your API key for testing
ANTHROPIC_API_KEY=your_key_here
# OR
GOOGLE_API_KEY=your_key_here
# OR
OPENAI_API_KEY=your_key_here
```

### 3. Initialize Database

```bash
# Run migrations to create schema and seed mock courses
npm run migrate
```

This creates:
- SQLite database at `./data/cbm_assessment.db`
- 3 mock courses: CS101, PHYS201, BIO150
- Default novelty detection configurations
- Default question generation configurations

### 4. Start the Server

```bash
# Development mode with auto-reload
npm run dev
```

Server starts at: **http://localhost:3000**

### 5. Open the Web Interface

Navigate to: **http://localhost:3000**

You'll see:
- **Home Page** - Overview and navigation
- **Admin Panel** - Course management
- **Submit Page** - Student submission interface

## Testing Workflow

### Step 1: Upload Course Materials (Admin)

1. Go to **Admin Panel** (http://localhost:3000/admin.html)
2. Click on a course (e.g., "CS101")
3. Go to **Course Materials** tab
4. Upload PDF/TXT files representing "standard" course content:
   - Lecture notes
   - Textbook chapters
   - Reference materials

**What happens**: Files are stored and queued for processing (text extraction & embedding generation - to be implemented)

### Step 2: Configure Novelty Detection (Admin)

1. Go to **Novelty Detection** tab
2. Experiment with parameters:
   - **Chunk Size**: How large each text segment is (default: 150 words)
   - **Novelty Threshold High**: Similarity > this = novel content (default: 0.7)
   - **Novelty Threshold Low**: Similarity < this = standard content (default: 0.4)
   - **LLM Provider**: Choose Claude, Gemini, GPT, or local
3. Click **Save Configuration**

### Step 3: Configure Question Generation (Admin)

1. Go to **Question Generation** tab
2. Set question counts:
   - **Standard Questions**: From question bank (default: 15)
   - **Novel Questions**: LLM-generated for novel content (default: 10)
   - **Oral Questions**: For comprehension verification (default: 8)
3. Adjust Bloom taxonomy distribution
4. Click **Save Configuration**

### Step 4: Submit a PDF (Student)

1. Go to **Submit Page** (http://localhost:3000/submit.html)
2. Select course: "CS101"
3. Enter student ID: "student123"
4. Enter name: "Test Student"
5. Upload a PDF document
6. Click **Submit for Assessment**

**What happens**:
- Submission is stored
- Processing begins (to be implemented):
  - Text extraction
  - Novelty detection against course materials
  - Question generation
  - Assessment creation

### Step 5: Check Submission Status

```bash
# Via API
curl http://localhost:3000/api/mock/submissions/{submissionId}/status
```

Or check the database:
```bash
sqlite3 data/cbm_assessment.db "SELECT * FROM submissions;"
```

## API Testing

### Get All Courses
```bash
curl http://localhost:3000/api/courses
```

### Get Course Overview
```bash
curl http://localhost:3000/api/courses/mock-cs101/overview
```

### Get Course Materials
```bash
curl http://localhost:3000/api/courses/mock-cs101/materials
```

### Get Novelty Config
```bash
curl http://localhost:3000/api/courses/mock-cs101/config/novelty
```

### Update Novelty Config
```bash
curl -X PUT http://localhost:3000/api/courses/mock-cs101/config/novelty \
  -H "Content-Type: application/json" \
  -d '{"novelty_threshold_high": 0.8, "chunk_size": 200}'
```

### Mock Submission
```bash
curl -X POST http://localhost:3000/api/mock/submit \
  -F "file=@test.pdf" \
  -F "courseId=mock-cs101" \
  -F "studentId=student123" \
  -F "studentName=Test Student"
```

## Database Inspection

View the database directly:

```bash
sqlite3 data/cbm_assessment.db

# List all tables
.tables

# View courses
SELECT * FROM courses;

# View course materials
SELECT * FROM course_materials;

# View novelty config
SELECT * FROM novelty_detection_config;

# View submissions
SELECT * FROM submissions;

# Exit
.quit
```

## Experimentation Guide

### Testing Novelty Detection Sensitivity

1. **Upload baseline materials** to a course:
   - e.g., CS101 lecture notes on "Variables and Data Types"

2. **Test with different submissions**:
   - **Low Novelty**: PDF paraphrasing the lecture notes
   - **Medium Novelty**: PDF extending concepts with new examples
   - **High Novelty**: PDF on advanced topics not covered

3. **Adjust thresholds** and re-test:
   - Lower `novelty_threshold_high` → More content classified as novel
   - Raise `novelty_threshold_low` → More content classified as standard

### Testing Question Generation Parameters

1. **Vary question counts**:
   - Set `standard_questions_count` to 0 → Only novel content questions
   - Set `novel_questions_count` to 0 → Only bank questions

2. **Experiment with Bloom levels**:
   - Focus on "remember" and "understand" for basic courses
   - Focus on "analyze" and "evaluate" for advanced courses

3. **Test different LLM providers**:
   - Claude: Generally better at nuanced understanding
   - Gemini: Faster, good for large volumes
   - GPT-4: Balanced performance
   - Local: For offline/privacy-sensitive scenarios

### Testing with Multiple Courses

The system includes 3 mock courses:

1. **CS101** (Computer Science)
   - Test with: Python code, algorithms, data structures

2. **PHYS201** (Physics)
   - Test with: Problem sets, lab reports, theory explanations

3. **BIO150** (Biology)
   - Test with: Cell biology, genetics, evolution essays

Each course can have different:
- Materials (different "standard" content baselines)
- Novelty parameters (different sensitivity)
- Question generation strategies

## Next Steps

Once you've tested the mock system:

1. **Implement Material Processing** - Extract text and generate embeddings from uploaded materials
2. **Implement Novelty Detection** - Compare submissions against course material embeddings
3. **Implement Question Generation** - RAG retrieval + LLM generation
4. **Build Assessment Interface** - Student quiz with CBM scoring
5. **Integrate LTI** - Connect to Canvas

## Troubleshooting

### Server won't start
```bash
# Check Node.js version
node --version  # Should be 18+

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Database errors
```bash
# Delete and recreate database
rm -rf data/
npm run migrate
```

### API returns errors
```bash
# Check server logs
npm run dev

# Check environment variables
cat .env
```

### File uploads fail
```bash
# Ensure upload directory exists and is writable
mkdir -p uploads/course-materials uploads/submissions
chmod 755 uploads
```

## Development Mode Features

When running `npm run dev`:
- Auto-reload on code changes
- Detailed logging to console
- Stack traces in error responses
- CORS enabled for all origins
- No authentication required

## Production Deployment

For production use:

1. Switch to PostgreSQL:
   ```env
   DB_TYPE=postgresql
   DB_HOST=localhost
   DB_NAME=cbm_assessment
   DB_USER=cbm_user
   DB_PASSWORD=secure_password
   ```

2. Use Docker:
   ```bash
   docker-compose up -d
   ```

3. Enable LTI integration
4. Add authentication middleware
5. Set up SSL/HTTPS
6. Configure backups

## Support

- **Documentation**: See `/todo.md` for full system design
- **API Docs**: http://localhost:3000/api
- **Health Check**: http://localhost:3000/health

---

**Happy Testing!** 🎓✨
