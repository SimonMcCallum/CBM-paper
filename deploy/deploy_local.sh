#!/usr/bin/env bash
# Deploy CBM Benchmark website to local nginx directory on Ubuntu.
#
# Usage:
#   ./deploy/deploy_local.sh              # Build and deploy to ~/public/
#   ./deploy/deploy_local.sh /var/www/cbm # Deploy to custom path
#   SKIP_BUILD=1 ./deploy/deploy_local.sh # Skip npm build (reuse existing dist/)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
WEBSITE_DIR="$PROJECT_ROOT/website"
DIST_DIR="$WEBSITE_DIR/dist"
PUBLISHED_DIR="$PROJECT_ROOT/benchmark/results/published"
DEPLOY_PATH="${1:-$HOME/public}"

# --- Check / install Node.js ---
if ! command -v node &>/dev/null; then
    echo "Node.js not found. Installing via NodeSource..."
    if ! command -v curl &>/dev/null; then
        sudo apt-get update && sudo apt-get install -y curl
    fi
    curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
    sudo apt-get install -y nodejs
    echo "Node.js $(node --version) installed."
fi

echo "Using Node.js $(node --version), npm $(npm --version)"

# --- Build website ---
if [ "${SKIP_BUILD:-}" != "1" ]; then
    echo "Installing npm dependencies..."
    (cd "$WEBSITE_DIR" && npm install)

    echo "Building website..."
    (cd "$WEBSITE_DIR" && npm run build)
else
    echo "Skipping build (SKIP_BUILD=1)"
    if [ ! -d "$DIST_DIR" ]; then
        echo "Error: $DIST_DIR does not exist. Run without SKIP_BUILD first."
        exit 1
    fi
fi

# --- Copy published benchmark data ---
DATA_DIR="$DIST_DIR/data"
if [ -d "$DATA_DIR" ]; then
    rm -rf "$DATA_DIR"
fi

if [ -d "$PUBLISHED_DIR" ]; then
    cp -r "$PUBLISHED_DIR" "$DATA_DIR"
    echo "Copied benchmark results to $DATA_DIR"
else
    mkdir -p "$DATA_DIR"
    echo "Warning: No published results at $PUBLISHED_DIR"
fi

# --- Deploy to local path ---
if [ -d "$DEPLOY_PATH" ]; then
    rm -rf "$DEPLOY_PATH"
fi

cp -r "$DIST_DIR" "$DEPLOY_PATH"

FILE_COUNT=$(find "$DEPLOY_PATH" -type f | wc -l)
echo "Deployed $FILE_COUNT files to $DEPLOY_PATH"
echo ""
echo "To serve with nginx, see deploy/nginx-cbm.conf for a sample configuration."
