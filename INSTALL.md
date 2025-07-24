# Installation Instructions

This document provides step-by-step instructions for setting up the CBM Paper project environment.

## Prerequisites

Before running the installation scripts, ensure you have the following software installed:

### Required Software

1. **Python 3.8 or higher**
   - Download from: https://www.python.org/downloads/
   - Make sure to add Python to your system PATH during installation
   - Verify installation: `python --version` or `python3 --version`

2. **Node.js 16 or higher**
   - Download from: https://nodejs.org/
   - npm will be installed automatically with Node.js
   - Verify installation: `node --version` and `npm --version`

3. **Git** (if cloning the repository)
   - Download from: https://git-scm.com/downloads

### Optional Software

- **LaTeX** (for PDF generation from .tex files)
  - Windows: MiKTeX or TeX Live
  - macOS: MacTeX
  - Linux: TeX Live

## Quick Installation

### Windows
1. Open Command Prompt or PowerShell as Administrator
2. Navigate to the project directory
3. Run: `install.bat`

### macOS/Linux
1. Open Terminal
2. Navigate to the project directory
3. Make the script executable: `chmod +x install.sh`
4. Run: `./install.sh`

## Manual Installation

If the automated scripts don't work, follow these manual steps:

### 1. Python Dependencies
```bash
pip install -r requirements.txt
```

### 2. Node.js Dependencies (for web interface)
```bash
cd cbm-question-system
npm install
cd ..
```

### 3. Environment Configuration
```bash
# Copy environment template
cp cbm-question-system/.env.example cbm-question-system/.env

# Edit with your API keys and configuration
# nano cbm-question-system/.env  # or use your preferred editor
```

### 4. Create Required Directories
```bash
mkdir -p logs results cbm-question-system/uploads cbm-question-system/database
```

## Configuration

### API Keys
You'll need to configure API keys for the AI services used in this project:

1. **OpenAI API Key** (for GPT models)
   - Get from: https://platform.openai.com/api-keys
   - Add to `cbm-question-system/.env` as `OPENAI_API_KEY=your_key_here`
   - Add to `Code/config.py` environment variables

2. **Anthropic API Key** (for Claude models)
   - Get from: https://console.anthropic.com/
   - Add to `cbm-question-system/.env` as `ANTHROPIC_API_KEY=your_key_here`
   - Add to `Code/config.py` environment variables

### Environment Variables for Python Scripts
The Python scripts in the `Code/` directory expect these environment variables:
```bash
export OPENAI_API_KEY_CBM=your_openai_key_here
export ANTHROPIC_API_KEY_CBM=your_anthropic_key_here
export GEMINI_API_KEY_CBM=your_gemini_key_here  # optional
export DEEPSEEK_API_KEY_CBM=your_deepseek_key_here  # optional
```

### Environment Variables for Web Interface
Edit `cbm-question-system/.env` with your configuration:
```env
# API Keys
OPENAI_API_KEY=your_openai_key_here
ANTHROPIC_API_KEY=your_anthropic_key_here

# Server Configuration
PORT=3000
NODE_ENV=development

# Database Configuration
DB_PATH=./database/cbm.db
```

## Project Structure

After installation, your project structure should look like:

```
CBM-paper/
├── Code/                     # Python analysis scripts
│   ├── askAll.py            # Main experiment runner
│   ├── api_calls.py         # API communication
│   ├── config.py            # Configuration settings
│   └── qti_converter/       # QTI format conversion
├── cbm-question-system/     # Node.js web interface
│   ├── src/                 # Server source code
│   ├── public/              # Static web files
│   └── package.json         # Node.js dependencies
├── ChromeQuizDownloader/    # Chrome extension
├── Documentation/           # Project documentation
├── logs/                    # Generated log files
├── results/                 # Analysis results
├── requirements.txt         # Python dependencies
├── install.sh              # Unix installation script
├── install.bat             # Windows installation script
└── INSTALL.md              # This file
```

## Running the Project

### Web Interface
```bash
cd cbm-question-system
npm start
```
Then open your browser to `http://localhost:3000`

### Python Scripts
```bash
cd Code
python askAll.py  # or any other script
```

### Chrome Extension
1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `ChromeQuizDownloader` folder

## What Each Component Does

### Python Scripts (`Code/` directory)
- **askAll.py**: Main script for running experiments with multiple AI models
- **api_calls.py**: Handles communication with OpenAI, Anthropic, and other APIs
- **config.py**: Central configuration file for API keys and settings
- **score_analysis.py**: Analyzes results and generates statistics
- **createQTIquiz.py**: Converts questions to QTI format for LMS import

### Web Interface (`cbm-question-system/`)
- Node.js server for web-based question creation and management
- PDF processing capabilities
- QTI export functionality
- Database for storing questions and results

### Chrome Extension (`ChromeQuizDownloader/`)
- Downloads quiz data from Canvas LMS
- Extracts questions for analysis

## Troubleshooting

### Common Issues

**Python not found:**
- Make sure Python is installed and added to your system PATH
- Try using `python3` instead of `python` on macOS/Linux

**npm install fails:**
- Try clearing npm cache: `npm cache clean --force`
- Delete `node_modules` folder and run `npm install` again

**Permission errors (macOS/Linux):**
- You may need to use `sudo` for global installations
- Consider using a Python virtual environment

**API errors:**
- Verify your API keys are correctly set in the configuration files
- Check that you have sufficient credits/quota for the API services

### Getting Help

If you encounter issues not covered here:

1. Check the main README.md for additional information
2. Review the error messages carefully
3. Ensure all prerequisites are properly installed
4. Verify your API keys and configuration

## Virtual Environment (Recommended)

For better dependency management, consider using a Python virtual environment:

```bash
# Create virtual environment
python -m venv cbm-env

# Activate it
# Windows:
cbm-env\Scripts\activate
# macOS/Linux:
source cbm-env/bin/activate

# Install dependencies
pip install -r requirements.txt

# When done, deactivate
deactivate
```

## Development Setup

If you plan to modify the code:

1. Fork the repository
2. Create a new branch for your changes
3. Make sure all tests pass after your changes
4. Follow the existing code style and conventions
5. Update documentation as needed

## Security Notes

- Never commit API keys to version control
- Keep your `.env` files secure and private
- Regularly rotate your API keys
- Monitor your API usage and costs
- The `.gitignore` file is configured to exclude sensitive files

## File Size Management

The updated `.gitignore` file excludes:
- Large research outputs (PDFs, images, CSV files)
- Log files and temporary data
- Node.js and Python build artifacts
- IDE configuration files
- Canvas export files and downloads

This helps keep the repository size manageable while preserving essential source code.
