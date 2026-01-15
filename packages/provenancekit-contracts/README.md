# @provenancekit/contracts

Smart contracts for on-chain provenance recording. Minimal, gas-efficient base implementation following OpenZeppelin patterns.

## Overview

This package provides Solidity smart contracts for recording provenance data on-chain using the **Entity-Action-Attribution (EAA)** model. The contracts follow an event-sourced architecture where the blockchain acts as the immutable source of truth.

### Design Principles

- **Minimal storage**: Only essential data stored on-chain (gas-efficient)
- **Event-driven**: Primary data storage through events (for off-chain indexing)
- **Immutable**: Append-only records (no updates or deletions)
- **Extensible**: Base contracts can be inherited and extended
- **OpenZeppelin-style**: Clean, well-tested, production-ready patterns

## Architecture

```
┌─────────────────────────────────────────┐
│  Blockchain (Source of Truth)           │
│  ProvenanceRegistry.sol                  │
│  - Events: ActionRecorded,               │
│            ResourceRegistered, etc.      │
│  - Minimal on-chain storage              │
└──────────┬──────────────────────────────┘
           │ Emit events
           ↓
┌──────────────────────────────────────────┐
│  Off-chain Indexer                       │
│  - Listen to events                      │
│  - Build materialized views              │
│  - Store in database of choice           │
└──────────────────────────────────────────┘
```

## Contracts

### Core Contracts

#### `ProvenanceRegistry.sol`

Base implementation of the provenance registry. Records:

- **Entities**: Actors (humans, AI, organizations) with off-chain identifiers
- **Actions**: Operations performed (create, transform, aggregate, verify)
- **Resources**: Content-addressed outputs (IPFS CIDs)
- **Attributions**: Relationships between entities and resources

**Key Functions**:

```solidity
// Register an entity
function registerEntity(
    string calldata entityId,      // Off-chain ID (DID, UUID, etc.)
    string calldata entityRole,    // "human", "ai", "organization"
    bytes calldata publicKey       // Optional public key
) external;

// Record an action
function recordAction(
    string calldata actionType,    // "create", "transform", etc.
    string calldata performerId,   // Off-chain performer ID
    string[] calldata inputs,      // Input CIDs
    string[] calldata outputs,     // Output CIDs
    bytes32 proof                  // Cryptographic proof
) external returns (bytes32 actionId);

// Register a resource
function registerResource(
    string calldata cid,           // IPFS CID
    string calldata resourceType,  // "text", "image", "audio", etc.
    string calldata creatorId,     // Off-chain creator ID
    bytes32 rootAction             // Action that created this
) external;

// Record attribution
function recordAttribution(
    string calldata resourceCid,   // Resource CID
    string calldata entityId,      // Entity ID
    address entityAddress,         // Entity address
    string calldata role           // "creator", "contributor", "source"
) external;
```

### Interfaces

#### `IProvenanceRegistry.sol`

Standard interface for provenance registries. Implement this interface to create custom registries or extensions.

## Events

All provenance data is primarily stored in events for gas efficiency and off-chain indexing:

```solidity
event ActionRecorded(
    bytes32 indexed actionId,
    string actionType,
    address indexed performer,
    string performerId,
    string[] inputs,
    string[] outputs,
    uint256 timestamp,
    bytes32 proof
);

event ResourceRegistered(
    string indexed cid,
    string resourceType,
    address indexed creator,
    string creatorId,
    bytes32 rootAction,
    uint256 timestamp
);

event EntityRegistered(
    address indexed entityAddress,
    string entityId,
    string entityRole,
    bytes publicKey,
    uint256 timestamp
);

event AttributionRecorded(
    string indexed resourceCid,
    string entityId,
    address indexed entityAddress,
    string role,
    uint256 timestamp
);
```

## Installation

### Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- Node.js >= 18

### Install Dependencies

```bash
cd packages/provenancekit-contracts

# Install Foundry dependencies
forge install OpenZeppelin/openzeppelin-contracts

# Install npm dependencies
pnpm install
```

## Development

### Build

```bash
forge build
```

### Test

```bash
# Run all tests
forge test

# Run with verbosity
forge test -vvv

# Run specific test
forge test --match-test test_RecordAction

# Run with gas report
forge test --gas-report

# Run with coverage
forge coverage
```

### Format

```bash
forge fmt
```

## Deployment

### Base Sepolia Testnet

1. Set environment variables:

```bash
export PRIVATE_KEY="your-private-key"
export BASESCAN_API_KEY="your-basescan-api-key"
```

2. Deploy:

```bash
forge script script/DeployBaseSepolia.s.sol \
  --rpc-url https://sepolia.base.org \
  --broadcast \
  --verify
```

### Base Mainnet

1. Set environment variables (same as testnet)

2. Deploy:

```bash
forge script script/DeployBase.s.sol \
  --rpc-url https://mainnet.base.org \
  --broadcast \
  --verify
```

## Usage Examples

### Recording a Complete Provenance Flow

```solidity
// 1. Register entities
registry.registerEntity(
    "did:example:alice123",
    "human",
    publicKey
);

registry.registerEntity(
    "agent:openai:gpt4",
    "ai",
    ""
);

// 2. Record action (AI generates image from text)
string[] memory inputs = new string[](1);
inputs[0] = "QmText..."; // Text prompt CID

string[] memory outputs = new string[](1);
outputs[0] = "QmImage..."; // Generated image CID

bytes32 actionId = registry.recordAction(
    "create",
    "agent:openai:gpt4",
    inputs,
    outputs,
    proofHash
);

// 3. Register the output resource
registry.registerResource(
    "QmImage...",
    "image",
    "agent:openai:gpt4",
    actionId
);

// 4. Record attributions
registry.recordAttribution(
    "QmImage...",
    "did:example:alice123",
    aliceAddress,
    "contributor"  // Alice provided the prompt
);

registry.recordAttribution(
    "QmImage...",
    "agent:openai:gpt4",
    aiAgentAddress,
    "creator"  // AI created the image
);
```

## Gas Costs

Approximate gas costs on Base (as of 2025):

| Operation | Gas Cost | USD (at $3000 ETH, 0.001 gwei) |
|-----------|----------|-------------------------------|
| Register Entity | ~50,000 | ~$0.15 |
| Record Action | ~80,000 | ~$0.24 |
| Register Resource | ~60,000 | ~$0.18 |
| Record Attribution | ~45,000 | ~$0.14 |

**Note**: Base L2 gas costs are ~10-100x cheaper than Ethereum mainnet.

## Network Deployments

### Testnet

- **Base Sepolia**: `[TBD - deploy and update]`
- Chain ID: 84532
- RPC: https://sepolia.base.org
- Explorer: https://sepolia.basescan.org

### Mainnet

- **Base**: `[TBD - deploy and update]`
- Chain ID: 8453
- RPC: https://mainnet.base.org
- Explorer: https://basescan.org

## Extension Patterns

The base contracts can be extended following OpenZeppelin patterns:

### Example: Adding Access Control

```solidity
import {ProvenanceRegistry} from "@provenancekit/contracts/ProvenanceRegistry.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

contract GovernedProvenanceRegistry is ProvenanceRegistry, AccessControl {
    bytes32 public constant RECORDER_ROLE = keccak256("RECORDER_ROLE");

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function recordAction(
        string calldata actionType,
        string calldata performerId,
        string[] calldata inputs,
        string[] calldata outputs,
        bytes32 proof
    ) external override onlyRole(RECORDER_ROLE) returns (bytes32) {
        return super.recordAction(actionType, performerId, inputs, outputs, proof);
    }
}
```

### Example: Adding Upgradeability

```solidity
import {ProvenanceRegistry} from "@provenancekit/contracts/ProvenanceRegistry.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract UpgradeableProvenanceRegistry is ProvenanceRegistry, UUPSUpgradeable {
    function _authorizeUpgrade(address newImplementation) internal override {
        // Add authorization logic
    }
}
```

## Security Considerations

1. **Immutability**: Records cannot be deleted or modified once recorded
2. **No Token Value**: Contract does not hold tokens or ETH
3. **Public Data**: All data is public on the blockchain
4. **Gas Costs**: Users pay gas fees for recording provenance
5. **Signature Verification**: Proof field can store signatures for verification

## Contributing

We follow OpenZeppelin's contribution standards:

1. Write comprehensive tests
2. Follow Solidity style guide
3. Add NatSpec documentation
4. Keep gas costs minimal
5. Ensure backwards compatibility

## License

MIT

## Resources

- [Foundry Book](https://book.getfoundry.sh/)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/)
- [Base Documentation](https://docs.base.org/)
- [ProvenanceKit EAA Types](https://github.com/provenancekit/provenancekit/tree/main/packages/eaa-types)
