# ProvenanceKit Master Implementation Plan

## Executive Summary

This document details the implementation plan for ProvenanceKit - a universal provenance framework for Human-AI created works. The goal is to create a minimal, elegant, and composable system that enables developers to build applications requiring:

- **Attribution tracking** - Who created what, and what contributions were made
- **Payment distribution** - Fair revenue sharing based on provenance
- **Privacy-preserving proofs** - Prove something happened without revealing details
- **Derivative tracking** - Follow the chain of works that build on each other

**Design Principles:**
- Keep things simple, minimal, and composable
- Provide strong defaults with flexibility for customization
- Avoid locking into specific patterns - enable building on top
- Use established standards where possible (W3C PROV, SPDX, etc.)

---

## Current Progress

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              PLATFORM LAYER (📋 PLANNED)                         │
│  ┌──────────────────────┐              ┌──────────────────────┐                 │
│  │   provenancekit-app  │◄────────────►│   provenancekit-api  │                 │
│  │   (Next.js Frontend) │              │   (API Server)       │                 │
│  └──────────┬───────────┘              └──────────┬───────────┘                 │
│             │                                     │                              │
│             ▼                                     ▼                              │
│  ┌──────────────────────────────────────────────────────────────────────────────┐
│  │                          EXTENSION LAYER                                      │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────┐               │
│  │  │ extensions  │ │  payments   │ │   privacy   │ │   git   │               │
│  │  │ ✅ COMPLETE │ │ 📋 PLANNED  │ │ 🔬 RESEARCH │ │📋 PLANNED│               │
│  │  │ - contrib   │ │ - superfluid│ │ - zk proofs │ │ - hooks │               │
│  │  │ - license   │ │ - x402      │ │ - commitments│ │- blame  │               │
│  │  │ - payment   │ │ - splits    │ │ - encryption│ │ - track │               │
│  │  │ - ai        │ │             │ │             │ │         │               │
│  │  │ - onchain   │ │             │ │             │ │         │               │
│  │  │ - storage   │ │             │ │             │ │         │               │
│  │  │ - distrib.  │ │             │ │             │ │         │               │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────┘               │
│  └──────────────────────────────────────────────────────────────────────────────┘
│                                      │                                           │
└──────────────────────────────────────┼───────────────────────────────────────────┘
                                       │
┌──────────────────────────────────────┼───────────────────────────────────────────┐
│                              BASE LAYER (✅ COMPLETE)                            │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                │
│  │  eaa-types  │ │  contracts  │ │   storage   │ │   indexer   │                │
│  │  (Schemas)  │ │  (On-chain) │ │  (DB/Files) │ │  (Sync)     │                │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘                │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

# PART 1: EXTENSION LAYER

## Package 1: @provenancekit/extensions ✅ COMPLETE

**Status:** Implemented and tested (207 tests passing)

**Purpose:** Type-safe extension schemas and helpers for the EAA extension system.

### 1.1 Implemented Extensions

| Extension | Namespace | Attaches To | Purpose |
|-----------|-----------|-------------|---------|
| **Contrib** | `ext:contrib@1.0.0` | Attribution | Track contribution weights for revenue distribution |
| **License** | `ext:license@1.0.0` | Resource, Attribution | Specify usage rights (SPDX identifiers, CC licenses) |
| **Payment** | `ext:payment@1.0.0` | Attribution, Action | Configure payment recipients and methods |
| **Onchain** | `ext:onchain@1.0.0` | Action, Resource, Attribution | Record blockchain anchoring proofs |
| **Storage** | `ext:storage@1.0.0` | Resource | Track storage replication and pinning status |
| **AI** | `ext:ai@1.0.0` | Action (tool), Entity (agent) | Dual-mode AI tracking |

### 1.2 Key Features

**Distribution Calculator:**
- Mathematically fair allocation using Largest Remainder Method (Hamilton's method)
- Handles dust/remainders explicitly for caller control
- Supports both resource-level and action-level distributions
- Merge multiple distributions, normalize contributions
- Full validation with detailed error types

**AI Extension (Dual-Mode Design):**
- **AI as Tool**: When human uses AI to accomplish a task (attached to Action)
- **AI as Agent**: When AI operates autonomously (attached to Entity with role: "ai")
- Supports multi-agent systems with collaborators, session tracking, autonomy levels

**Generic Utilities:**
- `withExtension()`, `getExtension()`, `hasExtension()` for custom extensions
- `copyExtensions()`, `withoutExtension()` for manipulation
- `isValidNamespace()` for validation

### 1.3 Integration with Indexer

The indexer automatically adds `ext:onchain@1.0.0` to all events transformed from on-chain data, including:
- chainId, blockNumber, transactionHash, logIndex
- Enables verification that provenance is anchored on-chain

### 1.4 Example Usage

```typescript
import {
  withContrib, withLicense, withPayment, withAITool,
  calculateDistribution, splitAmount, Licenses, PAYMENT_METHODS
} from "@provenancekit/extensions";

// Add contribution weight to attribution
const attr = withContrib(attribution, {
  weight: 6000,        // 60% in basis points
  basis: "points",
  source: "agreed",
  category: "design",
});

// Add license to resource
const licensed = withLicense(resource, Licenses.CC_BY);

// Calculate distribution from attributions
const dist = calculateDistribution(cidRef("bafy..."), attributions);

// Split an amount according to distribution
const { shares, dust } = splitAmount(1000000n, dist);
```

---

## Package 2: @provenancekit/payments 📋 PLANNED

**Status:** Not yet implemented

**Purpose:** Payment distribution based on provenance data. Supports multiple payment methods.

### 2.1 Design Approach

The payments package should:
- Provide **adapters** for payment methods (Superfluid, 0xSplits, x402, direct)
- Use the distribution calculator from extensions
- Keep adapters **optional** - don't force specific dependencies
- Be composable - applications choose which adapters they need

### 2.2 Planned Adapters

| Adapter | Purpose | Chains |
|---------|---------|--------|
| **Superfluid** | Real-time token streaming | ETH, Polygon, Arbitrum, Base, etc. |
| **0xSplits** | On-chain split contracts | Most EVM chains |
| **x402** | HTTP micropayments | Base (primary) |
| **Direct** | One-time transfers | Any EVM |

### 2.3 Core Interface (Draft)

```typescript
interface IPaymentAdapter {
  name: string;
  supportedChains: number[];

  initialize(config: unknown): Promise<void>;
  createPayment(params: CreatePaymentParams): Promise<PaymentResult>;
  getPaymentStatus(paymentId: string): Promise<PaymentStatus>;
  cancelPayment?(paymentId: string): Promise<void>;
}

interface CreatePaymentParams {
  distribution: Distribution;  // From @provenancekit/extensions
  amount: bigint;
  currency: string;
  payer: string;
  metadata?: Record<string, unknown>;
}
```

---

## Package 3: @provenancekit/privacy 🔬 RESEARCH COMPLETE

**Status:** Research complete, ready for implementation planning

**Purpose:** Privacy-preserving provenance with ability to prove things happened without revealing details.

### 3.1 Research Findings: ZK Proof Systems

| System | Proof Size | Trusted Setup | Gas Cost | Quantum Safe | Best For |
|--------|-----------|---------------|----------|--------------|----------|
| **Groth16** | ~288 bytes | Per-circuit | 150-200k | No | Min gas cost, DeFi |
| **PLONK** | KB range | Universal (once) | 600-800k | No | Flexible circuits |
| **STARKs** | Larger | None | 2-5M | Yes | Max security |

**Recommendation for ProvenanceKit:** Start with **Groth16/PLONK via snarkjs+circom** for on-chain verification (lowest gas). Use **STARKs** only if post-quantum security is required.

### 3.2 Research Findings: TypeScript/JavaScript Libraries

| Library | Purpose | Maturity | Notes |
|---------|---------|----------|-------|
| **[snarkjs](https://github.com/iden3/snarkjs)** | ZK proof generation/verification | Production | Groth16, PLONK, FFLONK. Works in browser + Node.js |
| **[circom](https://docs.circom.io/)** | ZK circuit DSL | Production | Compiles to snarkjs-compatible format |
| **[@noble/curves](https://github.com/paulmillr/noble-curves)** | Elliptic curve crypto | Production | 6 audits, used by Metamask, Phantom. BLS12-381, secp256k1, ed25519 |
| **[sd-jwt](https://sdjwt.js.org/)** | Selective disclosure JWT | Production | RFC 9901 (Nov 2025), TypeScript reference impl |
| **[@lit-protocol/lit-node-client](https://developer.litprotocol.com/)** | Token-gated encryption | Production | Mainnet live (Datil), threshold cryptography + TEE |
| **[pedersen-commitments](https://github.com/christsim/pedersen-commitments)** | Commitment scheme | Stable | Node.js, homomorphic addition/subtraction |

### 3.3 Research Findings: Selective Disclosure

**SD-JWT (Recommended for most cases):**
- RFC 9901 published November 2025
- Mandatory standard in EU eIDAS2 regulations
- Simple JSON-based format, easy to implement
- TypeScript reference implementation available
- Best for: Selective reveal of provenance claims (show some fields, hide others)

**BBS+ Signatures (For advanced use cases):**
- W3C VC-DI-BBS cryptosuite
- Requires BLS12-381 curve (@noble/curves supports this)
- Allows proving knowledge of signed data without revealing all fields
- More complex but mathematically elegant
- Best for: True zero-knowledge attribute proofs

### 3.4 Research Findings: Access Control

**Lit Protocol (Recommended):**
- Decentralized key management network
- Token-gated encryption/decryption
- Access Control Conditions: ERC20 balance, NFT ownership, DAO membership
- TEE-backed security (each node runs in TEE)
- Mainnet live (Datil network) as of 2025
- SDK: `@lit-protocol/lit-node-client`

**Example Access Condition:**
```typescript
// Only users with >= 1 ProvenanceNFT can decrypt
const accessControlConditions = [{
  contractAddress: "0x...",
  chain: "base",
  method: "balanceOf",
  parameters: [":userAddress"],
  returnValueTest: { comparator: ">=", value: "1" }
}];
```

### 3.5 Research Findings: Commitment Schemes

**Pedersen Commitments:**
- Formula: `C = g*v + h*r` (value + blinding factor)
- **Homomorphic**: Can add/subtract commitments without revealing values
- Information-theoretically hiding (unbreakable even with infinite compute)
- Used by Monero, Confidential Transactions
- **ProvenanceKit use case**: Commit to contribution weights, prove sum = 100%, reveal individual weights later

**Integration with ProvenanceVerifiable Contract:**
- Contract already supports commitment→reveal pattern
- Can store Pedersen commitment on-chain
- Reveal with proof that committed value matches claim
- Range proofs (Bulletproofs) ensure values are valid (non-negative, within bounds)

### 3.6 Privacy + Payments Intersection

**The Challenge:**
How do you distribute payments based on contribution weights when the weights are private?

**Solution Architecture:**

```
┌─────────────────────────────────────────────────────────────────┐
│                    PRIVATE CONTRIBUTION FLOW                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. COMMIT PHASE (Private)                                       │
│     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     │
│     │ Alice: 60%  │     │ Bob: 30%    │     │ Carol: 10%  │     │
│     │ C_a = P(60) │     │ C_b = P(30) │     │ C_c = P(10) │     │
│     └──────┬──────┘     └──────┬──────┘     └──────┬──────┘     │
│            │                   │                   │             │
│            └───────────────────┼───────────────────┘             │
│                                ▼                                 │
│     ZK Proof: C_a + C_b + C_c = P(100) ✓ (sum check)            │
│                                                                  │
│  2. ON-CHAIN RECORD                                              │
│     Store: commitments + sum proof on ProvenanceVerifiable       │
│                                                                  │
│  3. PAYMENT DISTRIBUTION                                         │
│     Option A: Reveal weights → use standard distribution         │
│     Option B: ZK payment proof → verify without revealing        │
│     Option C: Token-gated reveal → Lit Protocol decryption       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Implementation Options:**

| Approach | Privacy Level | Complexity | Gas Cost |
|----------|--------------|------------|----------|
| **Delayed reveal** | Medium (private until payment) | Low | Low |
| **ZK sum proof** | High (only prove sum=100%) | Medium | Medium |
| **Lit Protocol gating** | Medium (authorized parties see) | Low | Low |
| **Full ZK payment** | Very High (never reveal amounts) | High | High |

**Recommended Approach for V1:**
1. **Default**: Delayed reveal (commit→verify→pay→reveal)
2. **Optional**: Lit Protocol gating (authorized auditors can decrypt)
3. **Future**: ZK payment proofs for maximum privacy

### 3.7 Encrypted File Storage (IPFS/Arweave)

**The Problem:**
Files on IPFS and Arweave are **public by default**. Anyone with the CID can access them. IPFS uses transport-encryption but not content encryption - this is intentional to let developers choose their encryption method.

**Solution: Client-Side Encryption Before Upload**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     ENCRYPTED FILE STORAGE FLOW                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  UPLOAD (Encryption)                                                         │
│  ┌──────────┐    ┌─────────────┐    ┌──────────┐    ┌───────────────┐      │
│  │ Raw File │───►│ Encrypt     │───►│ Encrypted│───►│ Upload to     │      │
│  │          │    │ (AES-GCM)   │    │ Blob     │    │ IPFS/Arweave  │      │
│  └──────────┘    └──────┬──────┘    └──────────┘    └───────┬───────┘      │
│                         │                                    │               │
│                         ▼                                    ▼               │
│              ┌──────────────────┐              ┌─────────────────────┐      │
│              │ Encryption Key   │              │ CID (encrypted)     │      │
│              └────────┬─────────┘              └──────────┬──────────┘      │
│                       │                                   │                  │
│                       ▼                                   │                  │
│              ┌──────────────────────────────────────────────────────┐       │
│              │           KEY MANAGEMENT OPTIONS                      │       │
│              ├──────────────────────────────────────────────────────┤       │
│              │ 1. Lit Protocol (Recommended)                         │       │
│              │    - Store encrypted key with access conditions       │       │
│              │    - Token-gated: NFT ownership, ERC20 balance        │       │
│              │    - TEE-backed security                              │       │
│              │                                                       │       │
│              │ 2. Password-Derived (Simple)                          │       │
│              │    - PBKDF2/Argon2 from user password                │       │
│              │    - User manages password                            │       │
│              │                                                       │       │
│              │ 3. Wallet-Derived (Self-custody)                      │       │
│              │    - Derive from wallet signature                     │       │
│              │    - Only wallet owner can decrypt                    │       │
│              └──────────────────────────────────────────────────────┘       │
│                                                                              │
│  DOWNLOAD (Decryption)                                                       │
│  ┌───────────────┐    ┌─────────────┐    ┌──────────┐    ┌──────────┐      │
│  │ Fetch from    │───►│ Get Key     │───►│ Decrypt  │───►│ Raw File │      │
│  │ IPFS/Arweave  │    │ (verify     │    │ (AES-GCM)│    │          │      │
│  │               │    │  access)    │    │          │    │          │      │
│  └───────────────┘    └─────────────┘    └──────────┘    └──────────┘      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Recommended Encryption Algorithms:**
- **XChaCha20-Poly1305** (preferred) - Extended nonce, safe with random nonces
- **AES-256-GCM-SIV** - Nonce-misuse resistant
- **AES-256-GCM** - Standard, widely supported

All available via [@noble/ciphers](https://github.com/paulmillr/noble-ciphers) (6 audits by Cure53).

**Lit Protocol Integration for IPFS:**

```typescript
import { LitNodeClient } from "@lit-protocol/lit-node-client";
import { encryptToJson, decryptFromJson } from "@lit-protocol/encryption";

// Encrypt file before IPFS upload
const { ciphertext, dataToEncryptHash } = await LitJsSdk.encryptToJson({
  accessControlConditions: [{
    contractAddress: "0x...",
    chain: "base",
    method: "balanceOf",
    parameters: [":userAddress"],
    returnValueTest: { comparator: ">=", value: "1" }
  }],
  dataToEncrypt: fileBuffer,
  chain: "base",
});

// Upload encrypted ciphertext to IPFS
const cid = await ipfsClient.add(ciphertext);

// Store metadata: { cid, dataToEncryptHash, accessControlConditions }
```

**Lit's `encryptToIPFS` Shortcut:**
Lit SDK provides `encryptToIPFS` method that handles encryption and upload in one call.

**Storage Extension for Encrypted Files:**

```typescript
// ext:storage@1.0.0 with encryption metadata
{
  "ext:storage@1.0.0": {
    pinned: true,
    encrypted: true,
    contentType: "image/png",
    replicas: [{ provider: "ipfs-pinata", status: "active" }],
    encryption: {
      algorithm: "xchacha20-poly1305",
      keyAccess: "lit-protocol",  // or "password", "wallet"
      accessConditions: { /* Lit ACCs */ },
      dataToEncryptHash: "0x..."
    }
  }
}
```

**Arweave Consideration:**
Arweave stores data **permanently**. Encrypted files could theoretically be cracked in the future (quantum computing). For maximum forward-secrecy:
- Use post-quantum algorithms when mature
- Consider IPFS for sensitive data (can be unpinned)
- Use Arweave for data that's OK to become public eventually

### 3.8 Core Use Cases

1. **Private Attribution**: Commit to weight, prove it's valid, reveal only when needed
2. **Private Actions**: Record commitment on-chain, store encrypted details off-chain
3. **Delayed Disclosure**: Already supported by ProvenanceVerifiable contract
4. **Token-Gated Access**: Use Lit Protocol for NFT-gated decryption
5. **Encrypted Resources**: Store encrypted files on IPFS/Arweave with token-gated access

### 3.10 Implementation Plan

**Phase 1: Encryption Primitives (Foundation)**
- Integrate `@noble/ciphers` for symmetric encryption (XChaCha20-Poly1305, AES-GCM)
- Integrate `@noble/curves` for asymmetric/commitment crypto
- Create `IEncryptionProvider` interface for swappable backends
- Add password-based and wallet-derived key derivation

**Phase 2: Encrypted File Storage**
- Create `EncryptedFileStorage` wrapper for IFileStorage
- Encrypt-before-upload, decrypt-after-download
- Store encryption metadata in `ext:storage@1.0.0`
- Support IPFS, Arweave, and other backends transparently

**Phase 3: Access Control (Lit Protocol)**
- Integrate Lit Protocol SDK
- Token-gated decryption keys (NFT, ERC20, DAO membership)
- Access Control Conditions builder helpers
- `encryptToIPFS` integration for streamlined flow

**Phase 4: Selective Disclosure**
- Integrate SD-JWT for selective provenance claims
- Add `ext:private@1.0.0` extension for encrypted fields
- Partial reveal of attribution/action details

**Phase 5: Commitment Schemes**
- Add Pedersen commitment helpers
- Homomorphic operations (add/subtract commitments)
- Integration with ProvenanceVerifiable contract
- Range proof helpers (ensure weights are valid)

**Phase 6: ZK Proofs (Advanced)**
- Circom circuits for contribution sum proofs
- Proof generation in browser via snarkjs
- On-chain Groth16/PLONK verifier contracts
- Private payment distribution proofs

### 3.9 Recommended Dependencies

```json
{
  "@provenancekit/privacy": {
    "@noble/curves": "^1.6.0",
    "@noble/ciphers": "^0.4.0",
    "@lit-protocol/lit-node-client": "^3.0.0",
    "snarkjs": "^0.7.0"
  }
}
```

---

## Package 4: @provenancekit/git 📋 PLANNED

**Status:** Not yet implemented

**Purpose:** Git integration for tracking code contributions including AI assistance.

### 4.1 Core Features (Draft)

- **Post-commit hook**: Record provenance for each commit
- **AI detection**: Detect AI co-authors from commit messages, IDE telemetry
- **Blame analysis**: Calculate contribution weights from git blame
- **GitHub integration**: Track PRs, reviews, issues

### 4.2 ext:git@1.0.0 Extension (Draft)

```typescript
// Attached to Action representing a commit
{
  "ext:git@1.0.0": {
    repository: "https://github.com/org/repo",
    branch: "main",
    commit: "abc123...",
    message: "feat: add feature X",
    filesChanged: 5,
    linesAdded: 100,
    linesRemoved: 20,
  }
}
```

---

# PART 2: BASE LAYER REFERENCE

## Completed Packages Summary

### eaa-types
- W3C PROV-aligned types: Entity, Action, Resource, Attribution
- Flexible ContentReference (CID, Arweave, HTTP, custom schemes)
- Extensible enums with `ext:namespace` pattern
- Zero external dependencies (only Zod)

### provenancekit-contracts
- Layered architecture: ProvenanceCore → ProvenanceVerifiable → ProvenanceRegistry
- Event-driven design (minimal on-chain storage)
- Cross-chain ID uniqueness (chainId in hash)
- ERC-165 compliant

### provenancekit-storage
- Interface segregation: IProvenanceStorage, IFileStorage
- Optional capabilities: ITransactionalStorage, IVectorStorage, ISyncableStorage, ISubscribableStorage
- Multiple adapters: PostgreSQL, MongoDB, Supabase, Memory (DB); Pinata, Infura, Web3.Storage, Arweave (Files)

### provenancekit-indexer
- Historical sync + real-time watching
- Automatic `ext:onchain@1.0.0` extension on transformed events
- Retry logic with exponential backoff
- Chain presets for common networks

---

# PART 3: IMPLEMENTATION PHASES

## Phase 1: Extension Foundations ✅ COMPLETE

- All 6 extension schemas implemented and tested
- Helper functions for all extensions
- Distribution calculator with Largest Remainder Method
- 207 tests passing
- Package ready for npm publish

## Phase 2: Privacy Research ✅ COMPLETE

| Task | Status |
|------|--------|
| Research ZK proof systems (Groth16, PLONK, STARKs) | ✅ Complete |
| Evaluate TypeScript ZK libraries | ✅ Complete |
| Research commitment schemes for provenance | ✅ Complete |
| Evaluate Lit Protocol for token-gating | ✅ Complete |
| Research selective disclosure (BBS+, SD-JWT) | ✅ Complete |
| Document findings and recommendations | ✅ Complete |

**Key Findings:**
- **ZK Proofs**: Use snarkjs+circom (Groth16/PLONK) for on-chain verification
- **Commitments**: Pedersen commitments for private weights, homomorphic for sum proofs
- **Selective Disclosure**: SD-JWT (RFC 9901) for most cases, BBS+ for advanced ZK
- **Access Control**: Lit Protocol (mainnet ready, TEE-backed, token-gating)
- **Privacy+Payments**: Delayed reveal for V1, ZK sum proofs for V2

## Phase 3: Payment Infrastructure

| Task | Status |
|------|--------|
| Design IPaymentAdapter interface | 📋 Pending |
| Implement Superfluid adapter | 📋 Pending |
| Implement 0xSplits adapter | 📋 Pending |
| Implement x402 adapter + middleware | 📋 Pending |
| Integration tests on testnet | 📋 Pending |

## Phase 4: Domain Packages

| Package | Status |
|---------|--------|
| @provenancekit/git | 📋 Planned |
| @provenancekit/media (C2PA) | 📋 Planned |

## Phase 5: Platform Layer

| Package | Status |
|---------|--------|
| @provenancekit/api | 📋 Planned |
| @provenancekit/app | 📋 Planned |

---

# PART 4: EXTERNAL DEPENDENCIES

## NPM Dependencies (Planned)

```json
{
  "@provenancekit/payments": {
    "@superfluid-finance/sdk-core": "^0.6.0",
    "@0xsplits/splits-sdk": "^2.0.0",
    "viem": "^2.0.0"
  },
  "@provenancekit/privacy": {
    "@lit-protocol/lit-node-client": "^3.0.0",
    "@noble/ciphers": "^0.4.0"
  },
  "@provenancekit/git": {
    "simple-git": "^3.20.0"
  }
}
```

## External Services

| Service | Purpose | Required |
|---------|---------|----------|
| RPC Provider (Alchemy/Infura) | Blockchain access | Yes (for chain features) |
| Pinata / web3.storage | IPFS pinning | Yes (for file storage) |
| PostgreSQL | Database | Yes |
| Superfluid | Payment streaming | No (optional) |
| Lit Protocol | Access control | No (optional) |

---

*This document is updated as implementation progresses. Last updated: 2026-01-20*
