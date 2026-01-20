# ProvenanceKit Pyramid Roadmap

## Vision

Build a universal provenance framework for Human-AI created works, structured as a pyramid:

```
                    ┌─────────────────────┐
                    │   PLATFORM LAYER    │  ← Fully opinionated
                    │  provenancekit-app  │     End-user product
                    │  provenancekit-api  │     Direct interaction
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              │         EXTENSION LAYER         │  ← Pluggable, opinionated
              │  ext:contrib  ext:x402  ext:license │
              │  provenancekit-payments         │     Dev helper tools
              │  provenancekit-git              │     Domain packages
              └────────────────┬────────────────┘
                               │
    ┌──────────────────────────┼──────────────────────────┐
    │                    BASE LAYER                       │  ← Pure protocol
    │  eaa-types    provenancekit-contracts               │     Framework
    │  provenancekit-storage    provenancekit-indexer     │     Build anything
    └─────────────────────────────────────────────────────┘
```

---

## Layer 1: Base Layer (✅ COMPLETE)

The foundation. Pure provenance primitives with no opinions about usage.

| Package | Status | Purpose |
|---------|--------|---------|
| `@arttribute/eaa-types` | ✅ Done | Entity-Action-Attribution type system |
| `@provenancekit/contracts` | ✅ Done | On-chain provenance recording |
| `@provenancekit/storage` | ✅ Done | Database & file storage abstraction |
| `@provenancekit/indexer` | ✅ Done | Blockchain → Storage sync |

**Principles:**
- Zero opinions about economics, governance, licensing
- W3C PROV compatible
- Extension system for domain-specific data
- Storage/chain agnostic

---

## Layer 2: Extension Layer (🚧 NEXT)

Pluggable, opinionated modules. Developers choose which to use.

### Phase 2A: Extension Schemas

Define Zod schemas for standard extensions that live in `extensions` fields.

| Extension | Purpose | Key Fields |
|-----------|---------|------------|
| `ext:contrib@1.0.0` | Contribution weights | `weight`, `basis`, `verified` |
| `ext:license@1.0.0` | Licensing terms | `type`, `terms`, `commercial`, `attribution` |
| `ext:payment@1.0.0` | Payment configuration | `recipient`, `method`, `amount`, `currency` |
| `ext:storage@1.0.0` | Storage metadata | `pinned`, `replicas`, `expires` |
| `ext:onchain@1.0.0` | On-chain proof | `chainId`, `txHash`, `blockNumber` |

**Package:** `@provenancekit/extensions`

```typescript
// Usage example
import { ContribExtension, LicenseExtension } from "@provenancekit/extensions";

const attribution: Attribution = {
  resourceRef: cidRef("bafy..."),
  entityId: "did:key:alice",
  role: "creator",
  extensions: {
    "ext:contrib@1.0.0": { weight: 6000, basis: "points" }, // 60%
    "ext:license@1.0.0": { type: "CC-BY-4.0", commercial: true },
  },
};
```

### Phase 2B: Payment Distribution

Support multiple payment methods for revenue distribution based on provenance.

| Method | Use Case | Integration |
|--------|----------|-------------|
| **x402** | Per-access micropayments | HTTP 402 middleware |
| **Superfluid** | Continuous streaming | Real-time royalty flows |
| **Splits** | One-time distribution | 0xSplits contracts |
| **Manual** | Off-chain tracking | Ledger + settlement |

**Package:** `@provenancekit/payments`

```typescript
// Calculate distribution from provenance graph
const distribution = await calculateDistribution(resourceCid);
// { alice: 6000, bob: 3000, platform: 1000 } // basis points

// Option 1: Superfluid streaming
await superfluid.createStream({
  receiver: alice,
  flowRate: calculateFlowRate(revenue, 6000),
});

// Option 2: x402 per-access
app.use("/resource/:cid", x402Middleware({ distribution }));

// Option 3: 0xSplits one-time
await splits.distribute(splitContract, revenue);
```

#### Superfluid Integration

[Superfluid](https://superfluid.org/) enables real-time token streaming - perfect for:
- **Continuous royalties**: Stream payments to contributors as revenue flows in
- **Subscription content**: Pay-per-second access to provenance-tracked content
- **Dynamic splits**: Adjust flow rates based on real-time usage

Key concepts:
- **Super Tokens**: Wrapped ERC-20s with streaming capability
- **Constant Flow Agreement (CFA)**: Continuous token streams
- **Instant Distribution Agreement (IDA)**: One-to-many distributions

```typescript
// Stream royalties to all contributors
const streams = distribution.map(({ entityId, weight }) => ({
  receiver: getWalletAddress(entityId),
  flowRate: (totalFlowRate * BigInt(weight)) / 10000n,
}));

await superfluid.batchCreateStreams(streams);
```

### Phase 2C: Domain-Specific Packages

Helper packages for specific use cases.

| Package | Domain | Features |
|---------|--------|----------|
| `@provenancekit/git` | Code provenance | Git hooks, AI attribution, diff tracking |
| `@provenancekit/media` | Media provenance | C2PA compatibility, EXIF extraction |
| `@provenancekit/ai` | AI generations | Model tracking, prompt provenance |

#### provenancekit-git

Track code contributions including AI-assisted development.

```typescript
// Git hook integration
await provenanceGit.install(); // Installs post-commit hook

// On commit, records:
// - Who committed (human)
// - AI assistance used (Copilot, Cursor, Claude)
// - Files changed with attribution
// - Prompt history (optional)
```

#### provenancekit-media

Media provenance with industry standard compatibility.

```typescript
// Extract existing provenance
const c2pa = await extractC2PA(imageBuffer);

// Convert to EAA bundle
const bundle = c2paToBundle(c2pa);

// Embed provenance in file
const signedImage = await embedProvenance(imageBuffer, bundle);
```

### Phase 2D: Privacy & Security Layer

Support privacy-preserving provenance for sensitive data.

| Feature | Purpose | Technology |
|---------|---------|------------|
| **Encryption** | Protect content & metadata | AES-256, hybrid encryption |
| **Access Control** | Who can view provenance | Lit Protocol, token-gating |
| **ZK Proofs** | Prove without revealing | ZK-SNARKs, commitment schemes |
| **TEE Support** | Verifiable computation | Intel SGX, AWS Nitro, Marlin |

**Package:** `@provenancekit/privacy`

#### Encryption Modes

```typescript
// Mode 1: Public provenance, encrypted content
const resource = await pk.createResource({
  content: encryptedBuffer,
  provenance: "public", // Provenance visible
  contentKey: "owner-only", // Only owner can decrypt content
});

// Mode 2: Private provenance (commitment only)
const resource = await pk.createResource({
  content: buffer,
  provenance: "private", // Only commitment hash on-chain
  fullBundle: "stored-encrypted", // Full data encrypted in storage
});

// Mode 3: Selective disclosure
const resource = await pk.createResource({
  content: buffer,
  provenance: {
    public: ["type", "createdAt"], // Public fields
    private: ["createdBy", "attributions"], // Encrypted fields
  },
});
```

#### Zero-Knowledge Proofs

Use the commitment scheme already in `ProvenanceVerifiable.sol`:

```solidity
// Already implemented in contracts:
function recordActionWithCommitment(
    string actionType,
    string[] inputs,
    string[] outputs,
    bytes32 commitment  // Hash of private data
) external returns (bytes32 actionId);

function revealCommitment(
    bytes32 actionId,
    bytes revealData,
    bytes32 salt
) external;  // Reveal later when needed
```

Use cases:
- **Prove ownership** without revealing identity
- **Prove creation date** without revealing content
- **Prove attribution** without revealing contributor list

#### TEE Integration

Trusted Execution Environments for sensitive operations:

```typescript
// Run provenance computation in TEE
const result = await pk.computeInTEE({
  operation: "calculateDistribution",
  resourceCid: "bafy...",
  attestation: true, // Get cryptographic proof of correct execution
});

// Verify TEE attestation
const verified = await pk.verifyAttestation(result.attestation);
```

Supported TEEs:
- **Intel SGX**: Hardware enclaves
- **AWS Nitro Enclaves**: Cloud-based isolation
- **Marlin Oyster**: Decentralized TEE network

#### Access Control with Lit Protocol

Token-gate provenance access:

```typescript
import { LitAccessControl } from "@provenancekit/privacy";

// Define access conditions
const accessConditions = [
  {
    contractAddress: "0x...", // NFT contract
    standardContractType: "ERC721",
    chain: "base",
    method: "balanceOf",
    parameters: [":userAddress"],
    returnValueTest: { comparator: ">", value: "0" },
  },
];

// Encrypt provenance bundle
const encrypted = await pk.encryptBundle(bundle, {
  accessControl: accessConditions,
});

// Decrypt (only if user meets conditions)
const decrypted = await pk.decryptBundle(encrypted, { wallet });
```

### Phase 2E: SDK Enhancement

Enhance `@provenancekit/sdk` with blockchain recording.

```typescript
import { ProvenanceKit } from "@provenancekit/sdk";

const pk = new ProvenanceKit({
  chain: { rpcUrl, contractAddress },
  storage: postgresStorage,
  files: pinataStorage,
});

// Record action (writes to chain + storage)
const action = await pk.recordAction({
  type: "create",
  performer: "did:key:alice",
  inputs: [],
  outputs: [cidRef("bafy...")],
});

// Get provenance (reads from storage)
const lineage = await pk.getLineage("bafy...");

// Verify on-chain (checks blockchain)
const verified = await pk.verify(action.id);
```

---

## Layer 3: Platform Layer (🔮 FUTURE)

The fully opinionated provenance platform for end users.

### provenancekit-app (Frontend)

User-facing application for:
- **Creators**: Track and prove ownership of works
- **Collaborators**: Get attributed and paid for contributions
- **Consumers**: Verify authenticity and provenance
- **Organizations**: Manage provenance for teams/projects

Features:
- Visual provenance graph explorer
- One-click content registration
- Revenue dashboard
- Collaboration tools
- API key management

### provenancekit-api (Backend)

Hosted API service:
- REST/GraphQL endpoints
- Webhook notifications
- Managed indexing
- Multi-tenant support
- Analytics & reporting

---

## Implementation Phases

### Phase 1: Extension Foundations (Weeks 1-2)

**Goal:** Define extension schemas and enhance SDK

| Task | Package | Priority |
|------|---------|----------|
| Define `ext:contrib@1.0.0` schema | extensions | P0 |
| Define `ext:license@1.0.0` schema | extensions | P0 |
| Define `ext:payment@1.0.0` schema | extensions | P0 |
| Register extensions in global registry | extensions | P0 |
| Add blockchain recording to SDK | sdk | P0 |
| Implement `ISyncableStorage` in Postgres adapter | storage | P1 |

### Phase 2: Payment Infrastructure (Weeks 3-4)

**Goal:** Enable revenue distribution from provenance

| Task | Package | Priority |
|------|---------|----------|
| Distribution calculator from provenance graph | payments | P0 |
| x402 middleware integration | payments | P0 |
| Superfluid streaming integration | payments | P1 |
| 0xSplits integration | payments | P1 |
| Payment recording in provenance | payments | P0 |

### Phase 3: Privacy & Security (Weeks 5-6)

**Goal:** Enable private and encrypted provenance

| Task | Package | Priority |
|------|---------|----------|
| Encryption utilities (AES, hybrid) | privacy | P0 |
| Selective disclosure schema | privacy | P0 |
| ZK commitment helpers (use existing contract) | privacy | P1 |
| Lit Protocol access control | privacy | P1 |
| TEE integration (Marlin/Nitro) | privacy | P2 |

### Phase 4: Domain Packages (Weeks 7-8)

**Goal:** Support specific use cases

| Task | Package | Priority |
|------|---------|----------|
| Git hook system | git | P1 |
| AI code attribution detection | git | P2 |
| C2PA extraction/embedding | media | P1 |
| EXIF/metadata handling | media | P2 |

### Phase 5: Platform MVP (Weeks 9-12)

**Goal:** Usable end-to-end platform

| Task | Component | Priority |
|------|-----------|----------|
| API routes for provenance CRUD | api | P0 |
| Authentication & API keys | api | P0 |
| Basic dashboard UI | app | P0 |
| Provenance graph visualization | app | P1 |
| Revenue/attribution dashboard | app | P1 |

### Phase 6: Production Readiness (Weeks 13-14)

**Goal:** Production deployment

| Task | Component | Priority |
|------|-----------|----------|
| Contract deployment to mainnet | contracts | P0 |
| Deployment registry | contracts | P0 |
| Rate limiting & security | api | P0 |
| Documentation site | docs | P0 |
| Example applications | examples | P1 |

---

## Package Dependency Graph

```
┌─────────────────────────────────────────────────────────────┐
│                      Platform Layer                          │
│  ┌─────────────────┐      ┌─────────────────┐              │
│  │ provenancekit-  │      │ provenancekit-  │              │
│  │      app        │◄────►│      api        │              │
│  └────────┬────────┘      └────────┬────────┘              │
└───────────┼────────────────────────┼────────────────────────┘
            │                        │
┌───────────┼────────────────────────┼────────────────────────┐
│           │    Extension Layer     │                        │
│  ┌────────▼────────┐      ┌───────▼────────┐               │
│  │ provenancekit-  │      │ provenancekit- │               │
│  │    payments     │      │      git       │               │
│  └────────┬────────┘      └───────┬────────┘               │
│           │                       │                         │
│  ┌────────▼────────┐      ┌───────▼────────┐               │
│  │ provenancekit-  │      │ provenancekit- │               │
│  │    privacy      │      │     media      │               │
│  └────────┬────────┘      └───────┬────────┘               │
│           │                       │                         │
│  ┌────────▼───────────────────────▼────────┐               │
│  │         provenancekit-extensions        │               │
│  └────────────────────┬────────────────────┘               │
└───────────────────────┼─────────────────────────────────────┘
            │                       │
┌───────────┼───────────────────────┼─────────────────────────┐
│           │      Base Layer       │                         │
│  ┌────────▼────────┐      ┌───────▼────────┐               │
│  │ provenancekit-  │◄────►│ provenancekit- │               │
│  │      sdk        │      │    indexer     │               │
│  └────────┬────────┘      └───────┬────────┘               │
│           │                       │                         │
│  ┌────────▼────────┐      ┌───────▼────────┐               │
│  │ provenancekit-  │◄────►│ provenancekit- │               │
│  │   contracts     │      │    storage     │               │
│  └────────┬────────┘      └───────┬────────┘               │
│           │                       │                         │
│           └───────────┬───────────┘                         │
│                       │                                     │
│              ┌────────▼────────┐                           │
│              │   eaa-types     │                           │
│              └─────────────────┘                           │
└─────────────────────────────────────────────────────────────┘
```

---

## Technology Choices

### Payment Infrastructure

| Technology | Purpose | Why |
|------------|---------|-----|
| [Superfluid](https://superfluid.org/) | Streaming payments | Real-time royalties, programmable flows |
| [x402](https://www.x402.org/) | Micropayments | HTTP-native, AI agent friendly |
| [0xSplits](https://splits.org/) | Revenue splits | Battle-tested, gas efficient |

### Privacy & Security

| Technology | Purpose | Why |
|------------|---------|-----|
| [Lit Protocol](https://litprotocol.com/) | Access control | Decentralized encryption, token-gating |
| [Marlin Oyster](https://www.marlin.org/) | Decentralized TEE | Verifiable compute, no centralized trust |
| [AWS Nitro](https://aws.amazon.com/ec2/nitro/nitro-enclaves/) | Cloud TEE | Enterprise-grade, easy integration |
| ZK Commitments | Selective disclosure | Already in contracts, no new deps |

### Blockchain

| Chain | Use Case | Why |
|-------|----------|-----|
| Base | Default L2 | Low fees, Coinbase ecosystem, x402 native |
| Arbitrum | Alternative L2 | Wide adoption, Superfluid support |
| Ethereum | High-value | Maximum security for important records |

### Storage

| Technology | Use Case | Why |
|------------|----------|-----|
| IPFS + Pinata | File storage | Content addressing, decentralized |
| PostgreSQL | Provenance DB | Mature, pgvector for similarity |
| Arweave | Permanent storage | Immutable, pay-once |

---

## Success Metrics

### Developer Adoption (Extension Layer)
- NPM downloads for packages
- GitHub stars
- Projects building on ProvenanceKit
- Developer documentation quality

### Platform Usage (Platform Layer)
- Registered users
- Provenance records created
- Revenue distributed through platform
- API calls per month

### Ecosystem Health
- Smart contract TVL (if applicable)
- Cross-chain deployments
- Third-party integrations
- Community contributions

---

## Next Steps

1. **Immediate**: Start `@provenancekit/extensions` with core schemas
2. **Week 1**: Enhance SDK with blockchain recording
3. **Week 2**: Build payment distribution calculator
4. **Week 3**: Superfluid integration prototype
5. **Week 4**: x402 middleware

---

## References

### Payment & Distribution
- [Superfluid Documentation](https://docs.superfluid.org/)
- [x402 Protocol](https://www.x402.org/)
- [0xSplits](https://splits.org/)

### Privacy & Security
- [Lit Protocol Documentation](https://developer.litprotocol.com/)
- [Marlin Oyster TEE](https://docs.marlin.org/oyster/)
- [AWS Nitro Enclaves](https://docs.aws.amazon.com/enclaves/)
- [ZK Proofs Overview](https://ethereum.org/en/zero-knowledge-proofs/)

### Standards & Provenance
- [C2PA Specification](https://c2pa.org/)
- [W3C PROV](https://www.w3.org/TR/prov-overview/)
- [ISCN (LikeCoin)](https://iscn.io/)
