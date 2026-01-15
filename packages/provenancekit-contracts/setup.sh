#!/bin/bash

# ProvenanceKit Contracts Setup Script
# This script installs Foundry and dependencies

set -e

echo "🔨 Setting up ProvenanceKit Contracts..."

# Check if Foundry is installed
if ! command -v forge &> /dev/null; then
    echo "📦 Foundry not found. Installing..."
    curl -L https://foundry.paradigm.xyz | bash
    source ~/.bashrc
    foundryup
else
    echo "✅ Foundry already installed"
fi

# Initialize Foundry project (if not already done)
if [ ! -d "lib" ]; then
    echo "📚 Initializing Foundry project..."
    forge init --force --no-commit
fi

# Install OpenZeppelin contracts
if [ ! -d "lib/openzeppelin-contracts" ]; then
    echo "📦 Installing OpenZeppelin contracts..."
    forge install OpenZeppelin/openzeppelin-contracts --no-commit
else
    echo "✅ OpenZeppelin contracts already installed"
fi

# Build contracts
echo "🏗️  Building contracts..."
forge build

# Run tests
echo "🧪 Running tests..."
forge test

echo ""
echo "✅ Setup complete!"
echo ""
echo "📝 Next steps:"
echo "  1. Copy .env.example to .env and fill in your values"
echo "  2. Run 'forge test' to run tests"
echo "  3. Run 'forge build' to compile contracts"
echo "  4. Run deployment scripts when ready"
echo ""
