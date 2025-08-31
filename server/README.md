# QTI Quiz CBM Server

A Node.js server for inserting confidence-based marking (CBM) questions into Canvas quiz files.

## Setup

1. Install dependencies:
```bash
cd server
npm install
```

2. Make sure Python is available in your system PATH and the `insertCBM.py` script is working:
```bash
python ../Canvas_update/insertCBM.py --help
```

## Running the Server

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

The server will start on port 3000 by default (or the PORT environment variable).

## Usage

### Web Interface
1. Open http://localhost:3000 in your browser
2. Upload a Canvas quiz ZIP file
3. Select the confidence question type:
   - **Mixed**: Automatically chooses appropriate confidence questions based on original question types
   - **Multiple Choice**: Adds 5-choice confidence questions only
   - **True/False**: Adds True/False confidence questions only
4. Click "Process Quiz"
5. The processed quiz will automatically download

### API Endpoints

#### POST /process-quiz
Upload and process a quiz file.

**Parameters:**
- `quizFile` (file): Canvas quiz ZIP file
- `questionType` (string, optional): `mixed` (default), `mc`, or `tf`

**Response:** 
- Success: Downloads the processed ZIP file
- Error: JSON with error details

#### GET /health
Health check endpoint.

**Response:**
```json
{
  "status": "OK",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## File Structure

```
server/
├── package.json          # Dependencies and scripts
├── server.js             # Main server application
├── public/
│   └── index.html        # Web interface
├── uploads/              # Temporary uploaded files
├── temp/                 # Temporary processing directory
└── output/               # Temporary output files
```

## Error Handling

The server includes comprehensive error handling for:
- Invalid file types (only ZIP files accepted)
- File size limits (50MB max)
- Python script execution errors
- File system operations
- Network errors

## Security Notes

- Files are automatically cleaned up after processing
- Only ZIP files are accepted for upload
- File size is limited to prevent abuse
- Temporary directories are isolated