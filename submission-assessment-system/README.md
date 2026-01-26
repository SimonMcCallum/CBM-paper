# CBM Submission Assessment System

LTI-integrated submission assessment system that combines novelty detection with intelligent question generation and Confidence-Based Marking (CBM).

## Overview

This system enables automated assessment of student submissions (PDFs, text, code repositories) by:

1. **Analyzing novelty** - Detecting novel vs. standard content using LLM-powered semantic analysis
2. **Selecting questions** - RAG-based retrieval from question bank for standard content
3. **Generating questions** - LLM-generated MCQs for novel content and oral assessments
4. **Assessing with CBM** - Students answer with confidence levels, scored using CBM methodology
5. **Reporting results** - Comprehensive exports for staff including novelty reports and oral question sheets

## Core Principle

**Submitted work = Claim of knowledge**
**Generated questions = Test of that claim**

The system validates understanding through:
- MCQs testing knowledge of standard content
- Targeted questions on novel/unique content
- Oral questions verifying deep comprehension and authorship

## Features

### LTI Integration
- ✅ LTI 1.3 OAuth and secure launch
- ✅ Canvas Assignment & Grade Services (AGS) integration
- ✅ Deep Linking for assignment creation
- ✅ Automatic processing when students submit work

### Novelty Detection
- ✅ PDF text extraction and chunking
- ✅ LLM-powered semantic similarity analysis
- ✅ Color-coded novelty annotations
- ✅ Embedding-based content classification

### Question Bank Management
- ✅ QTI 1.2/2.x import from Canvas
- ✅ Web-based MCQ creation interface
- ✅ Question metadata and quality tracking
- ✅ Embedding-based search and retrieval

### Intelligent Question Generation
- ✅ RAG retrieval for standard content questions
- ✅ LLM-generated MCQs for novel content
- ✅ Oral assessment question generation
- ✅ Configurable LLM providers (Claude, Gemini, GPT, local)

### Assessment & Scoring
- ✅ Student quiz interface with confidence levels
- ✅ Configurable CBM scoring rules
- ✅ Automatic grade calculation
- ✅ Grade passback to Canvas via LTI AGS

### Staff Reporting
- ✅ Novelty analysis reports (PDF + CSV)
- ✅ Oral assessment question sheets
- ✅ Detailed score spreadsheets (Excel)
- ✅ Analytics dashboard

## Architecture

```
Canvas LMS (LTI Consumer)
    ↓
LTI Integration Layer
    ↓
PDF Upload & Analysis Pipeline
    ↓
Novelty Detection Service
    ↓
Question Bank System ← QTI Import | Web UI
    ↓
Question Generation Engine
    ├─ RAG Retrieval (standard content)
    ├─ LLM Generation (novel content)
    └─ Oral Questions (comprehension)
    ↓
Student Assessment Interface
    ↓
CBM Scoring Engine
    ↓
Results & Reporting System
    ├─ Grade Passback (LTI AGS)
    ├─ Novelty Reports
    ├─ Oral Question Sheets
    └─ Score Spreadsheets
```

## Technology Stack

### Backend
- **Runtime**: Node.js 18+ with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL (production) / SQLite (dev)
- **LTI**: ltijs library
- **PDF**: pdf-parse, pdf-lib

### AI/ML
- **Novelty Detection**: Python service (novelty_detector/)
- **Embeddings**: sentence-transformers
- **Vector Search**: FAISS
- **LLM Providers**: Anthropic Claude, Google Gemini, OpenAI GPT, local servers

### Frontend
- **Framework**: React with TypeScript
- **UI**: Material-UI
- **State**: React Query

## Installation

### Prerequisites
- Node.js 18+
- PostgreSQL 14+ (or SQLite for development)
- Python 3.9+ (for novelty detector)
- OpenSSL (for generating LTI keys)

### Verify Prerequisites

```bash
# Verify Node.js version (should be >= 18.0.0)
node --version

# Verify Python version (should be >= 3.9)
python --version

# Verify OpenSSL
openssl version

# For PostgreSQL (optional, only if not using SQLite)
psql --version
```

### Setup

1. **Clone repository**
   ```bash
   git clone <repo-url>
   cd submission-assessment-system
   ```

2. **Install Node.js dependencies**
   ```bash
   npm install
   ```

3. **Generate LTI authentication keys**
   ```bash
   mkdir -p secrets
   openssl genrsa -out secrets/lti_private_key.pem 2048
   openssl rsa -in secrets/lti_private_key.pem -pubout -out secrets/lti_public_key.pem
   ```

4. **Create necessary directories**
   ```bash
   mkdir -p data uploads exports logs
   ```

5. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration:
   # - Set LLM_PROVIDER (claude, gemini, gpt, or local)
   # - Add corresponding API key (ANTHROPIC_API_KEY, GOOGLE_API_KEY, or OPENAI_API_KEY)
   # - Configure database settings if using PostgreSQL
   ```

6. **Build TypeScript application**
   ```bash
   npm run build
   ```

7. **Set up database**
   ```bash
   # For SQLite (development) - database will be created automatically
   npm run migrate

   # For PostgreSQL (production)
   # First create the database and user:
   # sudo -u postgres psql
   # CREATE DATABASE cbm_assessment;
   # CREATE USER cbm_user WITH PASSWORD 'your_password';
   # GRANT ALL PRIVILEGES ON DATABASE cbm_assessment TO cbm_user;
   # \q
   # Then update .env with DB_TYPE=postgresql and run:
   npm run migrate
   ```

8. **Set up novelty detector service**
   ```bash
   cd ../novelty_detector

   # Install Python dependencies
   pip install -r requirements.txt

   # Download spaCy language model
   python -m spacy download en_core_web_sm

   # Configure environment
   cp .env.example .env
   # Edit .env and add at least one LLM API key:
   # - ANTHROPIC_API_KEY for Claude
   # - GOOGLE_API_KEY for Gemini
   # - OPENAI_API_KEY for GPT

   # Return to main directory
   cd ../submission-assessment-system
   ```

9. **Start services**

   **Option A: Development (two terminals)**
   ```bash
   # Terminal 1 - Start novelty detector service
   cd ../novelty_detector
   python server.py

   # Terminal 2 - Start main application
   cd ../submission-assessment-system
   npm run dev
   ```

   **Option B: Production (using Docker)**
   ```bash
   # Build and start all services
   docker-compose up -d

   # View logs
   docker-compose logs -f

   # Stop services
   docker-compose down
   ```

10. **Verify installation**
    ```bash
    # Check main application health
    curl http://localhost:3000/health

    # Check novelty detector health
    curl http://localhost:5000/health
    ```

## Canvas LTI Setup

### 1. Register LTI Tool in Canvas

1. Navigate to Admin → Developer Keys
2. Click "+ Developer Key" → "+ LTI Key"
3. Configure:
   - **Key Name**: CBM Submission Assessment
   - **Redirect URIs**: `https://your-domain.com/lti/launch`
   - **Method**: Manual Entry
   - **Title**: CBM Assessment Tool
   - **Description**: Automated submission assessment with novelty detection
   - **Target Link URI**: `https://your-domain.com/lti/launch`
   - **OpenID Connect Initiation URL**: `https://your-domain.com/lti/login`
   - **JWK Method**: Public JWK URL
   - **Public JWK URL**: `https://your-domain.com/.well-known/jwks.json`

4. **LTI Advantage Services**:
   - ✅ Can create and view assignment data (AGS)
   - ✅ Can view assignment data (AGS)
   - ✅ Can view submission data (AGS)
   - ✅ Can update submission results (AGS)
   - ✅ Can retrieve user data (NRPS)

5. **Placements**:
   - ✅ Assignment Selection
   - ✅ Link Selection
   - Message Type: `LtiResourceLinkRequest`

6. Save and copy the **Client ID**

### 2. Configure Tool

Add to `.env`:
```env
LTI_ISSUER=https://canvas.instructure.com
LTI_CLIENT_ID=<your-client-id>
```

### 3. Deploy Tool

Enable the developer key in Canvas and add to your course.

## Usage

### For Students

1. **Submit PDF**: Upload your work through Canvas assignment
2. **Wait for processing**: System analyzes novelty (~1-2 minutes)
3. **Take assessment**: Answer MCQs with confidence levels (1-5)
4. **Review results**: View CBM score and feedback

### For Staff

1. **Create assignment** in Canvas using LTI tool
2. **Configure parameters**: Question counts, difficulty levels
3. **Students submit**: Automatic processing triggered
4. **Review analytics**: Access dashboard for insights
5. **Export data**:
   - Novelty reports (identify high-novelty submissions)
   - Oral question sheets (for in-person verification)
   - Score spreadsheets (detailed analytics)

## Configuration

### Question Selection

Edit `config/question-selection.json`:
```json
{
  "standardContent": {
    "questionsPerSubmission": 15,
    "minSimilarity": 0.6,
    "bloomDistribution": {
      "remember": 0.2,
      "understand": 0.3,
      "apply": 0.3,
      "analyze": 0.2
    }
  },
  "novelContent": {
    "questionsPerSubmission": 10,
    "questionsPerChunk": 2,
    "targetBloomLevels": ["understand", "analyze", "evaluate"]
  },
  "oralAssessment": {
    "questionsPerSubmission": 8,
    "targetBloomLevels": ["analyze", "evaluate", "create"]
  }
}
```

### CBM Scoring Rules

Edit `config/cbm-scoring.json`:
```json
{
  "rules": [
    {"confidenceLevel": 5, "correctScore": 2.0, "incorrectScore": -2.0},
    {"confidenceLevel": 4, "correctScore": 1.5, "incorrectScore": -1.5},
    {"confidenceLevel": 3, "correctScore": 1.0, "incorrectScore": -1.0},
    {"confidenceLevel": 2, "correctScore": 0.5, "incorrectScore": -0.5},
    {"confidenceLevel": 1, "correctScore": 0.0, "incorrectScore": 0.0}
  ]
}
```

## API Documentation

API documentation available at `/api/docs` when `ENABLE_SWAGGER=true`.

### Key Endpoints

- `POST /lti/launch` - LTI launch endpoint
- `POST /api/submissions` - Upload submission
- `GET /api/submissions/:id/status` - Check processing status
- `GET /api/submissions/:id/assessment` - Get generated assessment
- `POST /api/submissions/:id/responses` - Submit student responses
- `GET /api/exports/novelty/:id` - Export novelty report
- `GET /api/exports/oral/:id` - Export oral questions
- `GET /api/exports/scores/:id` - Export detailed scores

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm test -- --coverage
```

## Deployment

### Docker

```bash
# Build image
docker build -t cbm-assessment .

# Run with docker-compose
docker-compose up -d
```

### Manual

1. Build application: `npm run build`
2. Set up PostgreSQL database
3. Run migrations: `npm run migrate`
4. Start with PM2: `pm2 start dist/index.js --name cbm-assessment`
5. Configure Nginx reverse proxy
6. Set up SSL certificates
7. Configure monitoring (Prometheus/Grafana)

## Security

- LTI 1.3 OAuth for secure authentication
- JWT validation for all LTI launches
- File upload validation and sanitization
- SQL injection prevention (parameterized queries)
- XSS prevention (input sanitization)
- CORS configuration
- Rate limiting
- Helmet.js security headers

## Privacy & Compliance

- **FERPA Compliant**: Student data handling procedures
- **GDPR**: Data retention and deletion policies
- **Accessibility**: WCAG 2.1 AA compliance
- **Encryption**: At rest and in transit

## Roadmap

### MVP (Current)
- ✅ PDF submissions
- ✅ LTI integration
- ✅ Question bank with RAG
- ✅ LLM question generation
- ✅ CBM scoring
- ✅ Staff exports

### Future
- ⬜ Text submission support
- ⬜ Code repository analysis (Git integration)
- ⬜ Adaptive questioning
- ⬜ Peer review integration
- ⬜ Mobile app
- ⬜ Multi-language support

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Troubleshooting

### Common Issues

#### "Cannot find module" errors
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

#### "Port already in use" errors
```bash
# Find and kill process using port 3000
# Linux/Mac:
lsof -ti:3000 | xargs kill -9

# Windows:
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

#### Database migration fails
```bash
# Remove existing database and retry
rm data/cbm_assessment.db
npm run build
npm run migrate
```

#### Novelty detector connection errors
```bash
# Verify novelty detector is running
curl http://localhost:5000/health

# Check logs
cd ../novelty_detector
python server.py
```

#### Missing LTI keys error
```bash
# Regenerate keys
mkdir -p secrets
openssl genrsa -out secrets/lti_private_key.pem 2048
openssl rsa -in secrets/lti_private_key.pem -pubout -out secrets/lti_public_key.pem
```

#### TypeScript compilation errors
```bash
# Clean build directory and rebuild
rm -rf dist
npm run build
```

#### Python dependencies fail to install
```bash
# Try upgrading pip first
pip install --upgrade pip

# Install with verbose output to see errors
pip install -r requirements.txt -v

# For Windows, some packages may need Visual C++ Build Tools
```

## Support

- **Documentation**: See `docs/` directory
- **Issues**: https://github.com/your-repo/issues
- **Email**: support@your-domain.com

---

For detailed design documentation, see [todo.md](../todo.md)
