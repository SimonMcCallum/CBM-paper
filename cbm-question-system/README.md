# CBM Question Creation System

A Node.js server system for creating Confidence-Based Marking (CBM) assessments from PDF documents using multiple LLM providers.

## Features

- **PDF Processing**: Upload and extract content from PDF documents
- **Multi-LLM Support**: Support for Gemini, Claude, OpenAI, Deepseek, and custom OpenAI-compatible APIs
- **Question Bank**: Curated question database with complexity ratings (1-10)
- **Intelligent Matching**: Automatically match PDF content with relevant questions from the bank
- **Question Generation**: Generate unique questions using LLMs based on PDF content
- **Confidence-Based Marking**: Implement CBM scoring system where student confidence affects scoring
- **Assessment Management**: Complete assessment lifecycle from creation to results analysis
- **Admin Interface**: RESTful API for managing question banks and system configuration

## Quick Start

### Prerequisites

- Node.js 16+ 
- npm or yarn
- At least one LLM API key (Gemini, Claude, OpenAI, or Deepseek)

### Installation

1. Clone and navigate to the project:
```bash
cd cbm-question-system
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

4. Edit `.env` file with your configuration:
```bash
# Required: Set at least one LLM API key
GEMINI_API_KEY=your_gemini_api_key_here
# CLAUDE_API_KEY=your_claude_api_key_here
# OPENAI_API_KEY=your_openai_api_key_here
# DEEPSEEK_API_KEY=your_deepseek_api_key_here

# Optional: Custom LLM (OpenAI-compatible)
# CUSTOM_LLM_URL=http://localhost:8080/v1
# CUSTOM_LLM_API_KEY=your_custom_api_key_here

# Set default provider
DEFAULT_LLM_PROVIDER=gemini
```

5. Start the server:
```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

The server will start on http://localhost:3000

## API Endpoints

### PDF Processing
- `POST /api/pdf/upload` - Upload PDF and create assessment
- `GET /api/pdf/status/:assessmentId` - Check processing status

### Question Bank Management
- `GET /api/questions` - List questions with filtering
- `POST /api/questions` - Add new question to bank
- `PUT /api/questions/:id` - Update existing question
- `DELETE /api/questions/:id` - Deactivate question

### Assessment & Student Responses
- `GET /api/assessments/:assessmentId` - Get assessment details
- `POST /api/assessments/:assessmentId/responses` - Submit student response
- `GET /api/assessments/:assessmentId/results/:studentId` - Get student results
- `GET /api/assessments/:assessmentId/statistics` - Assessment statistics

### Admin Functions
- `POST /api/admin/questions/bulk` - Bulk upload questions
- `GET /api/admin/statistics` - System statistics
- `GET /api/admin/question-bank/export` - Export question bank
- `GET /api/admin/cbm-rules` - Get CBM scoring rules
- `PUT /api/admin/cbm-rules/:confidenceLevel` - Update CBM rules

## Usage Examples

### Upload PDF for Assessment
```bash
curl -X POST http://localhost:3000/api/pdf/upload \\
  -F "pdf=@document.pdf" \\
  -F "difficulty=6" \\
  -F "questionCount=10" \\
  -F "llmProvider=gemini"
```

### Add Question to Bank
```bash
curl -X POST http://localhost:3000/api/questions \\
  -H "Content-Type: application/json" \\
  -d '{
    "question_text": "What is the primary purpose of version control?",
    "question_type": "multiple_choice",
    "correct_answer": "Track changes and manage code history",
    "options": ["Track changes and manage code history", "Compile code", "Debug applications", "Deploy software"],
    "complexity_level": 4,
    "topic": "Software Development",
    "keywords": ["version control", "git", "software development"]
  }'
```

### Submit Student Response
```bash
curl -X POST http://localhost:3000/api/assessments/{assessmentId}/responses \\
  -H "Content-Type: application/json" \\
  -d '{
    "questionId": 1,
    "answer": "Track changes and manage code history",
    "confidenceLevel": 4,
    "studentId": "student123"
  }'
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3000 |
| `DATABASE_PATH` | SQLite database path | `./database/cbm_system.db` |
| `DEFAULT_LLM_PROVIDER` | Default LLM service | `gemini` |
| `MAX_FILE_SIZE` | Max upload size in bytes | 10485760 (10MB) |
| `DEFAULT_COMPLEXITY_LEVEL` | Default question complexity | 5 |
| `MIN_QUESTIONS_PER_ASSESSMENT` | Minimum questions per assessment | 5 |
| `MAX_QUESTIONS_PER_ASSESSMENT` | Maximum questions per assessment | 20 |

### LLM Provider Configuration

The system supports multiple LLM providers. Configure at least one:

- **Gemini**: Set `GEMINI_API_KEY`
- **Claude**: Set `CLAUDE_API_KEY` 
- **OpenAI**: Set `OPENAI_API_KEY`
- **Deepseek**: Set `DEEPSEEK_API_KEY`
- **Custom**: Set `CUSTOM_LLM_URL` and optionally `CUSTOM_LLM_API_KEY`

### Confidence-Based Marking (CBM)

Default CBM scoring rules:

| Confidence Level | Correct Score | Incorrect Score |
|------------------|---------------|-----------------|
| 1 (Guessing) | +1 | 0. 0|
| 3 (Somewhat) | +1.5 | -0.5 |
| 5 (Very Confident) | +2.0 | -2.0 |

## Database Schema

The system uses SQLite with the following main tables:

- `question_bank` - Curated questions with complexity ratings
- `assessments` - PDF upload and processing records
- `assessment_questions` - Questions generated for each assessment
- `student_responses` - Student answers and CBM scores
- `cbm_scoring_rules` - Configurable scoring rules
- `llm_requests` - API usage tracking and costs

## Development

### Scripts
- `npm run dev` - Development server with auto-reload
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm test` - Run tests

### Adding New LLM Providers

1. Create a new provider class in `src/services/llmService.js`
2. Implement the `makeRequest(prompt, type)` method
3. Add configuration in `src/utils/config.js`
4. Update environment variables documentation

## Future Enhancements

- **GitLab Integration**: Process GitLab project repositories (planned)
- **Web Interface**: Frontend dashboard for lecturers and students
- **Advanced Analytics**: Detailed learning analytics and insights
- **Question Templates**: Pre-built question templates for different subjects
- **Automated Grading**: Enhanced AI-powered essay grading
- **Multi-tenancy**: Support for multiple institutions

## License

ISC

## Support

For issues and feature requests, please check the project repository or contact the development team.