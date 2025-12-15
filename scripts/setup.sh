#!/bin/bash
# =============================================================================
# WE Accounting & Tax AI - Local Development Setup Script
# =============================================================================
# Usage: ./scripts/setup.sh
# =============================================================================

set -e

echo "🚀 WE Accounting & Tax AI - Local Setup"
echo "========================================"

# Check Node.js version
echo ""
echo "📦 Checking Node.js version..."
NODE_VERSION=$(node -v)
echo "   Node.js: $NODE_VERSION"

REQUIRED_VERSION="20"
CURRENT_VERSION=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')

if [ "$CURRENT_VERSION" -lt "$REQUIRED_VERSION" ]; then
    echo "❌ Node.js version $REQUIRED_VERSION or higher is required"
    echo "   Please install Node.js from https://nodejs.org/"
    exit 1
fi
echo "✅ Node.js version OK"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Check for .env file
echo ""
echo "🔐 Checking environment configuration..."
if [ ! -f ".env" ]; then
    echo "   Creating .env from .env.example..."
    cp .env.example .env
    echo "   ⚠️  Please edit .env with your credentials"
else
    echo "   ✅ .env file exists"
fi

# Verify Firebase configuration
echo ""
echo "🔥 Checking Firebase configuration..."
if grep -q "your_firebase_api_key" .env; then
    echo "   ⚠️  Firebase API key not configured"
    echo "   Please update FIREBASE_API_KEY in .env"
else
    echo "   ✅ Firebase appears to be configured"
fi

# Verify Gemini API
echo ""
echo "🤖 Checking Gemini AI configuration..."
if grep -q "your_gemini_api_key" .env; then
    echo "   ⚠️  Gemini API key not configured"
    echo "   Get your key from: https://aistudio.google.com/app/apikey"
else
    echo "   ✅ Gemini API appears to be configured"
fi

# Build check
echo ""
echo "🔨 Running build check..."
npm run build 2>/dev/null || {
    echo "   ⚠️  Build has some warnings/errors. Check after starting dev server."
}

echo ""
echo "========================================"
echo "✅ Setup complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Edit .env with your API keys"
echo "   2. Run: npm run dev"
echo "   3. Open: http://localhost:5173"
echo ""
echo "📚 Documentation:"
echo "   - Firebase: https://console.firebase.google.com"
echo "   - Gemini AI: https://aistudio.google.com"
echo "   - E-Commerce APIs: See .env.example for links"
echo ""
