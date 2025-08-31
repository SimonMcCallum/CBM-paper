@echo off
setlocal enabledelayedexpansion

echo === CBM Paper Project Installation ===
echo.

REM Check if Python is installed
python --version >nul 2>&1
if !errorlevel! neq 0 (
    echo Error: Python is not installed. Please install Python 3.8 or higher.
    pause
    exit /b 1
)

REM Check if Node.js is installed
node --version >nul 2>&1
if !errorlevel! neq 0 (
    echo Error: Node.js is not installed. Please install Node.js 16 or higher.
    pause
    exit /b 1
)

REM Check if npm is installed
npm --version >nul 2>&1
if !errorlevel! neq 0 (
    echo Error: npm is not installed. Please install npm.
    pause
    exit /b 1
)

echo ✓ Python found: 
python --version
echo ✓ Node.js found: 
node --version
echo ✓ npm found: 
npm --version
echo.

REM Install Python dependencies
echo Installing Python dependencies...
pip install -r requirements.txt
if !errorlevel! neq 0 (
    echo Error: Failed to install Python dependencies.
    pause
    exit /b 1
)
echo ✓ Python dependencies installed
echo.

REM Install Node.js dependencies for cbm-question-system
if exist "cbm-question-system" (
    echo Installing Node.js dependencies for cbm-question-system...
    cd cbm-question-system
    npm install
    if !errorlevel! neq 0 (
        echo Error: Failed to install Node.js dependencies.
        cd ..
        pause
        exit /b 1
    )
    cd ..
    echo ✓ Node.js dependencies installed
) else (
    echo ⚠ cbm-question-system directory not found, skipping Node.js setup
)
echo.

REM Create .env file if it doesn't exist
if exist "cbm-question-system" (
    if not exist "cbm-question-system\.env" (
        echo Creating .env file from template...
        if exist "cbm-question-system\.env.example" (
            copy "cbm-question-system\.env.example" "cbm-question-system\.env" >nul
            echo ✓ .env file created from .env.example
            echo ⚠ Please edit cbm-question-system\.env with your API keys and configuration
        ) else (
            echo ⚠ .env.example not found, please create .env manually
        )
    )
)
echo.

REM Create necessary directories
echo Creating necessary directories...
if not exist "logs" mkdir logs
if not exist "results" mkdir results
if not exist "cbm-question-system\uploads" mkdir cbm-question-system\uploads
if not exist "cbm-question-system\database" mkdir cbm-question-system\database
echo ✓ Directories created
echo.

echo === Installation Complete ===
echo.
echo Next steps:
echo 1. Configure your API keys in cbm-question-system\.env (if using the web interface)
echo 2. Configure your API keys in Code\config.py (for Python scripts)
echo 3. To start the web interface: cd cbm-question-system ^&^& npm start
echo 4. To run Python scripts: cd Code ^&^& python ^<script_name^>.py
echo.
echo For more information, see INSTALL.md
echo.
pause
