#!/bin/bash
# Automated Node.js and MCP Browser Server Setup Script
# This script will install everything needed for MCP browser automation

set -e  # Exit on error

echo "=========================================="
echo "Node.js & MCP Browser Server Setup"
echo "=========================================="
echo ""

# Check if Homebrew is installed
if ! command -v brew &> /dev/null; then
    echo "📦 Homebrew not found. Installing Homebrew..."
    echo "⚠️  You may be prompted for your password."
    echo ""
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    
    # Add Homebrew to PATH for Apple Silicon Macs
    if [[ $(uname -m) == 'arm64' ]]; then
        echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
        eval "$(/opt/homebrew/bin/brew shellenv)"
    fi
    
    echo "✅ Homebrew installed successfully"
    echo ""
else
    echo "✅ Homebrew already installed"
    echo ""
fi

# Install Node.js
if ! command -v node &> /dev/null; then
    echo "📦 Installing Node.js..."
    brew install node
    echo "✅ Node.js installed successfully"
    echo ""
else
    echo "✅ Node.js already installed"
    echo ""
fi

# Verify installation
echo "🔍 Verifying installation..."
echo "Node.js version: $(node --version)"
echo "npm version: $(npm --version)"
echo "npx version: $(npx --version)"
echo ""

# Install MCP browser server globally (optional, will auto-install on first use)
echo "📦 Installing MCP Browser Server..."
npm install -g @modelcontextprotocol/server-cursor-ide-browser
echo "✅ MCP Browser Server installed"
echo ""

echo "=========================================="
echo "✅ Setup Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Quit Cursor completely (Cmd + Q)"
echo "2. Reopen Cursor"
echo "3. The MCP browser server will be active"
echo ""
echo "To verify it works, ask the AI:"
echo '  "Test the browser functionality"'
echo ""
