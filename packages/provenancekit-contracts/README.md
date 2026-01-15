# @provenancekit/contracts

Solidity contracts for on-chain provenance recording. Base implementations following OpenZeppelin patterns.

## Architecture

```
IProvenanceProvider         ← Standard interface (events + minimal functions)
        ↑
ProvenanceCore              ← Abstract base with hooks
        ↑
ProvenanceVerifiable        ← Proof layer (signatures, commitments)
        ↑
ProvenanceRegistry          ← Reference implementation
```

## Installation

```bash
forge install provenancekit/provenancekit-contracts
```

## Usage

### Option 1: Use ProvenanceRegistry directly

```solidity
import {ProvenanceRegistry} from "@provenancekit/contracts/ProvenanceRegistry.sol";

ProvenanceRegistry registry = new ProvenanceRegistry();

// Record an action
string[] memory inputs = new string[](0);
string[] memory outputs = new string[](1);
outputs[0] = "QmImageCID...";

bytes32 actionId = registry.recordAction("create", inputs, outputs);

// Register entity, resource, attribution
registry.registerEntity("did:example:alice", "human");
registry.registerResource("QmImageCID...", "image", actionId);
registry.recordAttribution("QmImageCID...", "creator");
```

### Option 2: Extend ProvenanceCore (custom logic)

```solidity
import {ProvenanceCore} from "@provenancekit/contracts/core/ProvenanceCore.sol";

contract MyProvenance is ProvenanceCore {
    mapping(address => bool) public whitelist;

    function _beforeRecordAction(
        bytes32 actionId,
        string calldata actionType,
        string[] calldata inputs,
        string[] calldata outputs
    ) internal override {
        require(whitelist[msg.sender], "Not allowed");
    }
}
```

### Option 3: Extend ProvenanceVerifiable (with proofs)

```solidity
import {ProvenanceVerifiable} from "@provenancekit/contracts/core/ProvenanceVerifiable.sol";

contract SecureProvenance is ProvenanceVerifiable {
    // Inherits:
    // - recordActionWithProof() for signature verification
    // - recordActionWithCommitment() for ZK-friendly commitments
    // - revealCommitment() for later reveal
}
```

## Contracts

| Contract | Type | Description |
|----------|------|-------------|
| `IProvenanceProvider` | Interface | Standard interface - emit these events to be compatible |
| `ProvenanceCore` | Abstract | Base with before/after hooks |
| `ProvenanceVerifiable` | Abstract | Adds ECDSA signatures and commitments |
| `ProvenanceRegistry` | Concrete | Complete reference implementation |

## Standard Events

Any contract emitting these events is ProvenanceKit compatible:

```solidity
event ActionRecorded(
    bytes32 indexed actionId,
    string actionType,
    address indexed performer,
    string[] inputs,
    string[] outputs,
    uint256 timestamp
);

event ResourceRegistered(string indexed cid, string resourceType, address indexed creator, bytes32 rootAction, uint256 timestamp);
event EntityRegistered(address indexed entityAddress, string entityId, string entityRole, uint256 timestamp);
event AttributionRecorded(string indexed cid, address indexed entityAddress, string role, uint256 timestamp);
```

## Development

```bash
# Setup
./setup.sh

# Build
forge build

# Test
forge test

# Test with verbosity
forge test -vvv

# Format
forge fmt
```

## Deployment

Deploy using Foundry:

```bash
forge create src/ProvenanceRegistry.sol:ProvenanceRegistry \
  --rpc-url <RPC_URL> \
  --private-key <PRIVATE_KEY>
```

## License

MIT
