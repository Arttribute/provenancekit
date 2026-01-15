# QuickStart Guide

Get up and running with ProvenanceKit Contracts in 5 minutes.

## Prerequisites

- **Node.js** >= 18
- **pnpm** (or npm/yarn)
- **Git**

## Installation

### Option 1: Automated Setup (Recommended)

```bash
cd packages/provenancekit-contracts
./setup.sh
```

This will:
1. Install Foundry (if not already installed)
2. Install contract dependencies
3. Build contracts
4. Run tests

### Option 2: Manual Setup

#### 1. Install Foundry

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

#### 2. Install Dependencies

```bash
cd packages/provenancekit-contracts

# Install OpenZeppelin contracts
forge install OpenZeppelin/openzeppelin-contracts --no-commit

# Install forge-std (should be automatic)
forge install foundry-rs/forge-std --no-commit
```

#### 3. Build & Test

```bash
# Build contracts
forge build

# Run tests
forge test

# Run tests with verbosity
forge test -vvv
```

## Quick Test

Verify everything works:

```bash
cd packages/provenancekit-contracts

# Run all tests
forge test

# Expected output:
# Running 15 tests...
# Test result: ok. 15 passed; 0 failed...
```

## Deploying to Base Sepolia Testnet

### 1. Get Test ETH

Visit [Base Sepolia Faucet](https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet) to get test ETH.

### 2. Set Environment Variables

```bash
cp .env.example .env
```

Edit `.env` and add:
```bash
PRIVATE_KEY=your_private_key_here
BASESCAN_API_KEY=your_basescan_api_key_here
```

**Note**: Get Basescan API key from [Basescan](https://basescan.org/myapikey).

### 3. Deploy

```bash
forge script script/DeployBaseSepolia.s.sol \
  --rpc-url base-sepolia \
  --broadcast \
  --verify
```

The contract address will be printed to the console and verified on Basescan automatically.

## Using the Deployed Contract

### Via Cast (Foundry CLI)

```bash
# Set contract address
CONTRACT=0x... # Your deployed address

# Register an entity
cast send $CONTRACT \
  "registerEntity(string,string,bytes)" \
  "did:example:alice" "human" "0x" \
  --rpc-url base-sepolia \
  --private-key $PRIVATE_KEY

# Record an action
cast send $CONTRACT \
  "recordAction(string,string,string[],string[],bytes32)" \
  "create" "did:example:alice" "[]" "[\"QmExample\"]" "0x0000000000000000000000000000000000000000000000000000000000000000" \
  --rpc-url base-sepolia \
  --private-key $PRIVATE_KEY

# Check if resource exists
cast call $CONTRACT \
  "resourceExists(string)" \
  "QmExample" \
  --rpc-url base-sepolia
```

### Via Web3 Library

```typescript
import { ethers } from 'ethers';
import abi from './ProvenanceRegistry.json';

const provider = new ethers.JsonRpcProvider('https://sepolia.base.org');
const signer = new ethers.Wallet(privateKey, provider);
const contract = new ethers.Contract(contractAddress, abi, signer);

// Register entity
await contract.registerEntity(
  'did:example:alice',
  'human',
  '0x'
);

// Record action
await contract.recordAction(
  'create',
  'did:example:alice',
  [], // inputs
  ['QmExample'], // outputs
  ethers.ZeroHash // proof
);
```

## Development Workflow

### 1. Make Changes

Edit contracts in `src/`.

### 2. Write Tests

Add tests in `test/`. Follow the existing pattern:

```solidity
// test/MyTest.t.sol
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ProvenanceRegistry} from "../src/ProvenanceRegistry.sol";

contract MyTest is Test {
    ProvenanceRegistry public registry;

    function setUp() public {
        registry = new ProvenanceRegistry();
    }

    function test_MyFeature() public {
        // Test code here
    }
}
```

### 3. Run Tests

```bash
# Run all tests
forge test

# Run specific test
forge test --match-test test_MyFeature

# Run with gas report
forge test --gas-report

# Run with coverage
forge coverage
```

### 4. Format & Lint

```bash
# Format code
forge fmt

# Check formatting
forge fmt --check
```

## Common Commands

```bash
# Build contracts
forge build

# Run tests
forge test

# Run tests with console logs
forge test -vvv

# Generate gas report
forge test --gas-report

# Generate coverage report
forge coverage

# Clean build artifacts
forge clean

# Update dependencies
forge update

# Format code
forge fmt

# Deploy to testnet
pnpm deploy:sepolia

# Deploy to mainnet
pnpm deploy:base
```

## Troubleshooting

### "command not found: forge"

Foundry is not installed or not in PATH. Install:
```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### "Error: Could not find artifact"

Run `forge build` first.

### "Error: Deployment failed"

Check:
1. You have test ETH in your wallet
2. `.env` file exists with correct values
3. RPC URL is correct
4. Network is accessible

### Tests failing

```bash
# Clean and rebuild
forge clean
forge build
forge test -vvv
```

## Next Steps

1. **Read the full README**: [README.md](./README.md)
2. **Explore examples**: Check `test/` for usage examples
3. **Read EAA types**: [packages/eaa-types](../eaa-types)
4. **Join community**: [GitHub Discussions](https://github.com/provenancekit/provenancekit/discussions)

## Resources

- [Foundry Book](https://book.getfoundry.sh/)
- [Base Documentation](https://docs.base.org/)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/)
- [Solidity Documentation](https://docs.soliditylang.org/)
