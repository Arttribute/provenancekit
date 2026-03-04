#!/bin/bash

# ProvenanceKit Contracts Setup Script
set -e

echo "Setting up ProvenanceKit Contracts..."

# Check if Foundry is installed
if ! command -v forge &> /dev/null; then
    echo "Foundry not found. Installing..."
    curl -L https://foundry.paradigm.xyz | bash
    source ~/.bashrc
    foundryup
fi

# Install dependencies
if [ ! -d "lib" ]; then
    forge install foundry-rs/forge-std --no-commit
fi

# Build and test
forge build
forge test

echo "Setup complete!"
