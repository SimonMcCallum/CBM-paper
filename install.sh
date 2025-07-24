#!/bin/bash

# CBM Paper Project Installation Script
# This script installs all required dependencies for the project

set -e  # Exit on any error

echo "=== CBM Paper Project Installation ==="
echo

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "Error: Python 3 is not installed. Please install Python 3.8 or higher."
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed. Please install Node.js 16 or higher."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "Error: npm is not installed. Please install npm."
    exit 1
fi

echo "✓ Python 3 found: $(python3 --version)"
echo "✓ Node.js found: $(node --version)"
echo "✓ npm found: $(npm --version)"
echo

# Install Python dependencies
echo "Installing Python dependencies..."
if command -v pip3 &> /dev/null; then
    pip3 install -r requirements.txt
elif command -v pip &> /dev/null; then
    pip install -r requirements.txt
else
    echo "Error: pip is not installed. Please install pip."
    exit 1
fi
echo "✓ Python dependencies installed"
echo

# Install Node.js dependencies for cbm-question-system
if [ -d "cbm-question-system" ]; then
    echo "Installing Node.js dependencies for cbm-question-system..."
    cd cbm-question-system
    npm install
    cd ..
    echo "✓ Node.js dependencies installed"
else
    echo "⚠ cbm-question-system directory not found, skipping Node.js setup"
fi
echo

# Create .env file if it doesn't exist
if [ -d "cbm-question-system" ] && [ ! -f "cbm-question-system/.env" ]; then
    echo "Creating .env file from template..."
    if [ -f "cbm-question-system/.env.example" ]; then
        cp cbm-question-system/.env.example cbm-question-system/.env
        echo "✓ .env file created from .env.example"
        echo "⚠ Please edit cbm-question-system/.env with your API keys and configuration"
    else
        echo "⚠ .env.example not found, please create .env manually"
    fi
fi
echo

# Create necessary directories
echo "Creating necessary directories..."
mkdir -p logs
mkdir -p results
mkdir -p cbm-question-system/uploads
mkdir -p cbm-question-system/database
echo "✓ Directories created"
echo

echo "=== Installation Complete ==="
echo
echo "Next steps:"
echo "1. Configure your API keys in cbm-question-system/.env (if using the web interface)"
echo "2. Configure your API keys in Code/config.py (for Python scripts)"
echo "3. To start the web interface: cd cbm-question-system && npm start"
echo "4. To run Python scripts: cd Code && python3 <script_name>.py"
echo
echo "For more information, see INSTALL.md"
