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
│                              PLATFORM LAYER                                      │
│  ┌──────────────────────┐              ┌──────────────────────┐                 │
│  │   provenancekit-app  │◄────────────►│   provenancekit-api  │                 │
│  │   (Next.js Frontend) │              │   ✅ COMPLETE        │                 │
│  │   📋 PLANNED         │              │   (Hono + Storage)   │                 │
│  └──────────┬───────────┘              └──────────┬───────────┘                 │
│             │                                     │                              │
│             ▼                                     ▼                              │
│  ┌──────────────────────────────────────────────────────────────────────────────┐
│  │                          EXTENSION LAYER                                      │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────┐ ┌─────────┐  │
│  │  │ extensions  │ │  payments   │ │   privacy   │ │   git   │ │  media  │  │
│  │  │ ✅ COMPLETE │ │ ✅ COMPLETE │ │ ✅ COMPLETE │ │✅ COMPLETE│ │✅ COMPLETE│  │
│  │  │ - contrib   │ │ - direct    │ │ - zk proofs │ │ - hooks │ │ - C2PA  │  │
│  │  │ - license   │ │ - superfluid│ │ - commitments│ │- blame  │ │ - read  │  │
│  │  │ - payment   │ │ - splits    │ │ - encryption│ │ - track │ │ - write │  │
│  │  │ - ai        │ │             │ │             │ │         │ │ - conv. │  │
│  │  │ - onchain   │ │             │ │             │ │         │ │         │  │
│  │  │ - storage   │ │             │ │             │ │         │ │         │  │
│  │  │ - distrib.  │ │             │ │             │ │         │ │         │  │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────┘ └─────────┘  │
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

## Package 2: @provenancekit/payments ✅ COMPLETE

**Status:** Implemented with 3 adapters (Direct, 0xSplits, Superfluid)

**Purpose:** Payment distribution based on provenance data. Supports multiple payment methods.

### 2.1 Design Approach

The payments package:
- Provides **adapters** for payment methods (Direct, 0xSplits, Superfluid)
- Uses the distribution calculator from extensions (`splitAmount`)
- Keeps adapters **optional** - import only what you need
- Is composable - applications choose which adapters they need

### 2.2 Implemented Adapters

| Adapter | Purpose | Model | Chains |
|---------|---------|-------|--------|
| **DirectTransferAdapter** | One-time ETH/ERC-20 transfers | one-time | All EVM |
| **SplitsAdapter** | 0xSplits automatic revenue splitting | split-contract | ETH, Polygon, Arbitrum, Optimism, Base, Gnosis |
| **SuperfluidAdapter** | Real-time token streaming | streaming | ETH, Polygon, Arbitrum, Optimism, Base, Avalanche, BSC, Gnosis |

**Note:** x402 adapter deferred for API layer integration.

### 2.3 Core Interface

```typescript
interface IPaymentAdapter {
  readonly name: string;
  readonly description: string;
  readonly supportedChains: number[];
  readonly model: PaymentModel;  // "one-time" | "streaming" | "split-contract"

  distribute(params: DistributeParams): Promise<PaymentResult>;
  estimateFees?(params: DistributeParams): Promise<FeeEstimate>;
  supportsToken?(token: Address, chainId: number): Promise<boolean>;
}

interface DistributeParams {
  distribution: Distribution;  // From @provenancekit/extensions
  amount: bigint;
  token: Address;             // Token address (zeroAddress for native)
  chainId: number;
  walletClient: WalletClient; // viem wallet client
  publicClient: PublicClient; // viem public client
  options?: AdapterOptions;
}
```

### 2.4 Usage Example

```typescript
import { DirectTransferAdapter } from "@provenancekit/payments/adapters/direct";
import { calculateDistribution } from "@provenancekit/extensions";
import { parseEther, zeroAddress } from "viem";

// Calculate distribution from attributions
const distribution = calculateDistribution(resourceRef, attributions);

// Execute payment
const adapter = new DirectTransferAdapter();
const result = await adapter.distribute({
  distribution,
  amount: parseEther("10"),
  token: zeroAddress,  // Native ETH
  chainId: 8453,       // Base
  walletClient,
  publicClient,
});

console.log(`Paid ${result.payments.length} recipients`);
```

---

## Package 3: @provenancekit/privacy ✅ CORE COMPLETE

**Status:** Phases 1-5 implemented (187 tests passing), Phase 6 (ZK proofs) optional/advanced

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

**Phase 1: Encryption Primitives (Foundation) ✅ COMPLETE**
- ✅ Integrated `@noble/ciphers` for symmetric encryption (XChaCha20-Poly1305, AES-GCM)
- ✅ Created `IEncryptionProvider` interface for swappable backends
- ✅ Added password-based key derivation (PBKDF2)
- ✅ Added wallet-derived key derivation (HKDF from signatures)
- ✅ IKeyManager interface with KeyRing implementation

**Phase 2: Encrypted File Storage ✅ COMPLETE**
- ✅ Created `EncryptedFileStorage` wrapper for IFileStorage
- ✅ Encrypt-before-upload, decrypt-after-download
- ✅ Store encryption metadata in `ext:storage@1.0.0`
- ✅ Support IPFS, Arweave, and other backends transparently
- ✅ Helper functions: `createEncryptedStorageExtension`, `extractEnvelopeFromExtension`

**Phase 3: Access Control ✅ COMPLETE**
- ✅ Access condition types (ERC20, ERC721, ERC1155, Contract, SIWE)
- ✅ Condition builders (`erc20Condition`, `erc721Condition`, etc.)
- ✅ Combinators (`allOf`, `anyOf`)
- ✅ Lit Protocol format conversion (`toLitCondition`, `toLitUnifiedConditions`)
- ✅ Common patterns (`requireNFT`, `requireTokens`, `requireDAOMembership`)
- ✅ `IAccessControlProvider` interface for pluggable backends

**Phase 4: Selective Disclosure ✅ COMPLETE**
- ✅ SD-JWT-like selective disclosure for provenance claims
- ✅ `createSelectiveDisclosure`, `createPresentation`, `verifyPresentation`
- ✅ Provenance helpers (`createAttributionDisclosure`, `createResourceDisclosure`)
- ✅ Serialization/deserialization for storage and transmission
- ✅ Expiration support for time-limited access proofs

**Phase 5: Commitment Schemes ✅ COMPLETE**
- ✅ Pedersen commitments using secp256k1 curve
- ✅ Homomorphic operations (`addCommitments`, `subtractCommitments`, `sumCommitments`)
- ✅ Contribution weight helpers (`commitContributionWeights`, `verifyWeightSum`)
- ✅ Contract integration (`commitmentToBytes`, `commitmentHash`)
- ✅ Serialization for storage and transmission

**Phase 6: ZK Proofs (Advanced) 📋 OPTIONAL**
- Circom circuits for contribution sum proofs
- Proof generation in browser via snarkjs
- On-chain Groth16/PLONK verifier contracts
- Private payment distribution proofs

### 3.9 Implemented Dependencies

```json
{
  "@provenancekit/privacy": {
    "@noble/curves": "^1.6.0",
    "@noble/ciphers": "^1.0.0",
    "@noble/hashes": "^1.5.0"
  }
}
```

**Optional peer dependencies (for advanced use cases):**
- `@lit-protocol/lit-node-client` - Token-gated encryption (Phase 6)
- `snarkjs` - ZK proof generation (Phase 6)

---

## Package 4: @provenancekit/git ✅ COMPLETE

**Status:** Implemented and tested (71 tests passing)

**Purpose:** Git integration for tracking code contributions including AI assistance.

### 4.1 Core Use Cases

1. **Track commits as Actions** - Each commit creates provenance records
2. **Detect AI assistance** - Parse commit messages, IDE telemetry for AI co-authors
3. **Calculate contributions** - Use git blame to determine who wrote what
4. **GitHub integration** - Track PRs, reviews, issues as provenance events

### 4.2 Package Structure

```
@provenancekit/git/
├── src/
│   ├── index.ts              # Main exports
│   ├── types.ts              # Git-specific types
│   │
│   ├── tracker/
│   │   ├── commit.ts         # Commit tracking & provenance creation
│   │   ├── blame.ts          # Git blame analysis for weights
│   │   └── hooks.ts          # Git hook generators
│   │
│   ├── ai/
│   │   ├── detector.ts       # AI co-author detection
│   │   └── patterns.ts       # Known AI patterns (Copilot, Claude, etc.)
│   │
│   ├── extensions/
│   │   └── git.ts            # ext:git@1.0.0 extension schema
│   │
│   └── integrations/
│       ├── github.ts         # GitHub API integration
│       └── gitlab.ts         # GitLab API integration (future)
│
├── cli/
│   └── index.ts              # CLI for git hooks setup
│
└── tests/
```

### 4.3 ext:git@1.0.0 Extension

```typescript
// Attached to Action representing a commit
interface GitExtension {
  repository: string;           // e.g., "github.com/org/repo"
  branch: string;
  commit: string;               // SHA
  message: string;
  parent?: string;              // Parent commit SHA

  // Statistics
  filesChanged: number;
  linesAdded: number;
  linesRemoved: number;

  // AI assistance (if detected)
  aiAssisted?: {
    tool: string;               // "github-copilot", "claude", "cursor", etc.
    confidence: number;         // 0-1
    indicators: string[];       // What triggered detection
  };

  // Signature verification
  signature?: {
    type: "gpg" | "ssh";
    verified: boolean;
    signer?: string;
  };
}
```

### 4.4 AI Detection Patterns

```typescript
// Detect AI co-authorship from various signals
const AI_PATTERNS = {
  // Commit message patterns
  commitMessage: [
    /Co-authored-by:.*(?:GitHub Copilot|Copilot)/i,
    /Co-authored-by:.*(?:Claude|Anthropic)/i,
    /Co-authored-by:.*(?:ChatGPT|OpenAI)/i,
    /\[AI-assisted\]/i,
    /Generated (?:by|with|using) (?:AI|LLM|GPT|Claude)/i,
  ],

  // File patterns that suggest AI generation
  filePatterns: [
    /\.cursor\//,           // Cursor AI
    /\.github\/copilot/,    // GitHub Copilot config
    /\.aider/,              // Aider AI
  ],
};
```

### 4.5 Blame Analysis

```typescript
interface BlameAnalysis {
  // Per-file breakdown
  files: Map<string, FileBlame>;

  // Aggregated by author
  byAuthor: Map<string, {
    linesAuthored: number;
    filesContributed: number;
    percentage: number;
  }>;

  // Ready for distribution calculation
  toDistribution(): Distribution;
}

// Calculate contributions from git blame
async function analyzeBlame(
  repoPath: string,
  options?: {
    branch?: string;
    paths?: string[];      // Filter to specific paths
    since?: Date;          // Only consider commits since
    ignorePatterns?: string[]; // Ignore generated files
  }
): Promise<BlameAnalysis>;
```

### 4.6 Git Hooks

```typescript
// Generate post-commit hook that records provenance
function generatePostCommitHook(config: {
  storageUrl?: string;     // Where to send provenance
  contractAddress?: string; // On-chain registration
  aiDetection?: boolean;   // Enable AI detection
}): string;
```

### 4.7 CLI Commands

```bash
# Setup git hooks in a repo
npx @provenancekit/git init

# Record provenance for the last commit
npx @provenancekit/git record-commit

# Analyze blame and output contribution weights
npx @provenancekit/git blame-analysis --format=json

# Detect AI assistance in commit history
npx @provenancekit/git detect-ai --since="2024-01-01"
```

### 4.8 Integration Example

```typescript
import { createAction, createAttribution } from "@arttribute/eaa-types";
import { withContrib, withAITool } from "@provenancekit/extensions";
import { recordCommit, analyzeBlame } from "@provenancekit/git";

// Record a commit with full provenance
const { action, attributions } = await recordCommit({
  repoPath: ".",
  commitSha: "HEAD",
  detectAI: true,
});

// action has ext:git@1.0.0 extension
// attributions have contribution weights from blame
// AI attribution added if detected

// Calculate payment distribution from blame
const blame = await analyzeBlame(".", { branch: "main" });
const distribution = blame.toDistribution();
```

### 4.9 Dependencies

```json
{
  "simple-git": "^3.20.0",
  "@octokit/rest": "^20.0.0"
}
```

---

## Package 5: @provenancekit/media ✅ COMPLETE

**Status:** Implemented and tested (157 tests passing)

**Purpose:** C2PA (Coalition for Content Provenance and Authenticity) media provenance integration for reading and writing content credentials in images and videos.

### 5.1 Core Use Cases

1. **Read C2PA manifests** - Extract provenance data from media files
2. **Write C2PA manifests** - Embed provenance credentials in media files
3. **AI disclosure detection** - Detect AI-generated content from C2PA metadata
4. **Convert C2PA ↔ EAA** - Bidirectional conversion between C2PA and EAA types

### 5.2 Package Structure

```
@provenancekit/media/
├── src/
│   ├── index.ts              # Main exports
│   ├── types.ts              # C2PA types & schemas
│   ├── extension.ts          # ext:c2pa@1.0.0 helpers
│   │
│   ├── reader/
│   │   └── index.ts          # Read C2PA manifests from files
│   │
│   ├── writer/
│   │   └── index.ts          # Write C2PA manifests to files
│   │
│   └── converter/
│       └── index.ts          # C2PA ↔ EAA type conversion
│
└── tests/
```

### 5.3 ext:c2pa@1.0.0 Extension

```typescript
// C2PA extension data attached to Resource
interface C2PAExtension {
  manifestLabel: string;        // Unique manifest identifier
  claimGenerator: string;       // Tool that created the manifest
  claimGeneratorVersion?: string;
  title?: string;               // Asset title
  format?: string;              // MIME type
  instanceId?: string;          // Instance identifier

  // Actions performed on the asset
  actions?: Array<{
    action: C2PAActionType;     // e.g., "c2pa.created", "c2pa.edited"
    when?: string;
    softwareAgent?: { name: string; version?: string };
    digitalSourceType?: string;
  }>;

  // Source materials used
  ingredients?: Array<{
    title: string;
    format?: string;
    hash?: string;
    relationship?: "parentOf" | "componentOf" | "inputTo";
  }>;

  // Signature info
  signature?: {
    algorithm: string;
    issuer?: string;
    timestamp?: string;
  };

  // Validation
  validationStatus?: {
    isValid: boolean;
    errors?: string[];
    warnings?: string[];
  };

  // AI disclosure
  aiDisclosure?: {
    isAIGenerated: boolean;
    aiTool?: string;
    trainingDataUsed?: boolean;
  };

  // Creative work info
  creativeWork?: {
    author?: string[];
    dateCreated?: string;
    copyright?: string;
  };
}
```

### 5.4 Reader API

```typescript
import { readManifest, hasManifest, isC2PAAvailable } from "@provenancekit/media";

// Check if c2pa-node is available
const available = await isC2PAAvailable();

// Read C2PA manifest from file
const result = await readManifest("./photo.jpg");

console.log("Title:", result.c2pa.title);
console.log("Creator:", result.c2pa.creativeWork?.author?.[0]);
console.log("Is AI generated:", result.c2pa.aiDisclosure?.isAIGenerated);
console.log("Actions:", result.actions.length);
console.log("Attributions:", result.attributions.length);

// Quick check if file has manifest
const hasC2PA = await hasManifest("./photo.jpg");
```

### 5.5 Writer API

```typescript
import { writeManifest, writeManifestFromEAA } from "@provenancekit/media";

// Write C2PA manifest to file
const result = await writeManifest("./input.jpg", "./output.jpg", {
  signer: {
    certificate: fs.readFileSync("cert.pem"),
    privateKey: fs.readFileSync("key.pem"),
    algorithm: "es256",
  },
  title: "My Photo",
  actions: [
    { action: "c2pa.created", softwareAgent: { name: "My App" } }
  ],
  creativeWork: {
    author: ["John Doe"],
    copyright: "© 2025 John Doe",
  },
  aiDisclosure: {
    isAIGenerated: false,
  },
});

// Write from existing EAA provenance data
const result = await writeManifestFromEAA(
  "./input.jpg", "./output.jpg",
  { resource, actions, attributions, entities },
  signerConfig
);
```

### 5.6 Extension Helpers

```typescript
import {
  withC2PA, hasC2PA, getC2PA,
  isAIGenerated, getAITool,
  getC2PAActions, getC2PAIngredients,
  isC2PAValid, getValidationErrors,
} from "@provenancekit/media";

// Add C2PA to a resource
const resource = withC2PA(baseResource, {
  manifestLabel: "urn:uuid:...",
  claimGenerator: "ProvenanceKit/1.0",
  title: "My Photo",
});

// Check for C2PA data
if (hasC2PA(resource)) {
  const c2pa = getC2PA(resource);

  // Check AI disclosure
  if (isAIGenerated(resource)) {
    console.log("AI tool:", getAITool(resource));
  }

  // Get actions and ingredients
  const actions = getC2PAActions(resource);
  const ingredients = getC2PAIngredients(resource);

  // Check validation
  if (!isC2PAValid(resource)) {
    console.log("Errors:", getValidationErrors(resource));
  }
}
```

### 5.7 Type Converters

```typescript
import {
  convertC2PAToEAA,
  actorToEntity,
  c2paActionToEAAAction,
  createAttributionsFromC2PA,
  ingredientToResource,
} from "@provenancekit/media";

// Full conversion from C2PA to EAA types
const { resource, actions, attributions, entities } = convertC2PAToEAA(c2paData, {
  resourceId: "custom-id",
  filePath: "./photo.jpg",
});

// Individual conversions
const entity = actorToEntity({ type: "human", name: "Alice" });
const { action, entities } = c2paActionToEAAAction(c2paAction, contentRef);
const attributions = createAttributionsFromC2PA(c2pa, contentRef);
```

### 5.8 Supported Formats

| Format | MIME Type |
|--------|-----------|
| JPEG | image/jpeg |
| PNG | image/png |
| HEIC | image/heic |
| HEIF | image/heif |
| AVIF | image/avif |
| WebP | image/webp |
| MP4 | video/mp4 |
| MOV | video/quicktime |
| MP3 | audio/mpeg |
| M4A | audio/mp4 |
| PDF | application/pdf |

### 5.9 Dependencies

```json
{
  "@contentauth/c2pa-node": "^0.5.0",  // Optional peer dependency
  "zod": "^3.23.8"
}
```

**Note:** `@contentauth/c2pa-node` is an optional peer dependency. The package gracefully degrades when it's not available, allowing users to use the type conversion and extension helpers without native C2PA reading/writing.

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

## Phase 2: Privacy Package ✅ COMPLETE

| Task | Status |
|------|--------|
| Research ZK proof systems (Groth16, PLONK, STARKs) | ✅ Complete |
| Evaluate TypeScript ZK libraries | ✅ Complete |
| Research commitment schemes for provenance | ✅ Complete |
| Evaluate Lit Protocol for token-gating | ✅ Complete |
| Research selective disclosure (BBS+, SD-JWT) | ✅ Complete |
| Document findings and recommendations | ✅ Complete |
| Implement encryption primitives | ✅ Complete |
| Implement encrypted file storage | ✅ Complete |
| Implement access control helpers | ✅ Complete |
| Implement selective disclosure | ✅ Complete |
| Implement Pedersen commitments | ✅ Complete |

**Implemented Features (187 tests passing):**
- Encryption: XChaCha20-Poly1305, AES-GCM, key derivation (password, wallet)
- Encrypted Storage: `EncryptedFileStorage` wrapper for IPFS/Arweave
- Access Control: Token-gating conditions, Lit Protocol format conversion
- Selective Disclosure: SD-JWT-like pattern for provenance claims
- Commitments: Pedersen scheme for private contribution weights

## Phase 3: Payment Infrastructure ✅ COMPLETE

| Task | Status |
|------|--------|
| Design IPaymentAdapter interface | ✅ Complete |
| Implement DirectTransfer adapter | ✅ Complete |
| Implement Superfluid adapter | ✅ Complete |
| Implement 0xSplits adapter | ✅ Complete |
| Implement x402 adapter + middleware | 📋 Deferred (API layer) |
| Integration tests on testnet | 📋 Pending |

## Phase 4: Domain Packages

| Package | Status |
|---------|--------|
| @provenancekit/git | ✅ Complete (71 tests) |
| @provenancekit/media (C2PA) | ✅ Complete (157 tests) |

## Phase 5: Platform Layer

| Package | Status |
|---------|--------|
| provenancekit-api (apps/) | ✅ Complete |
| @provenancekit/sdk | ✅ Complete |
| provenancekit-app (apps/) | 📋 Planned |

### provenancekit-api ✅ COMPLETE

**Location:** `apps/provenancekit-api/`

The API has been completely rewritten to use the new core packages as the foundation while maintaining SDK compatibility.

**Architecture:**
- **Framework:** Hono + @hono/node-server
- **Database:** Supabase (PostgreSQL + pgvector)
- **File Storage:** Pinata (IPFS)
- **Embeddings:** Xenova/transformers (768-dim CLIP/CLAP)

**Core Packages Integrated:**
- `@provenancekit/storage` - Supabase + Pinata adapters
- `@provenancekit/extensions` - Distribution calculator
- `@provenancekit/media` - C2PA reading for images

**SDK-Compatible Endpoints (Maintained):**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Health check |
| `/entity` | POST | Create entity |
| `/activity` | POST | Upload file with provenance |
| `/bundle/:cid` | GET | Get provenance bundle |
| `/provenance/:cid` | GET | Get provenance chain |
| `/graph/:cid` | GET | Get provenance graph |
| `/similar/:cid` | GET | Find similar resources |
| `/search/file` | POST | Search by file upload |
| `/search/text` | POST | Search by text |
| `/session` | POST | Create session |
| `/session/:id` | GET | Get session bundle |
| `/session/:id/message` | POST | Add message |
| `/session/:id/close` | POST | Close session |

**New Endpoints (Using Extension Packages):**

| Endpoint | Method | Description | Package |
|----------|--------|-------------|---------|
| `/distribution/:cid` | GET | Calculate payment distribution | extensions |
| `/distribution/preview` | POST | Preview distribution for multiple resources | extensions |
| `/media/formats` | GET | List supported C2PA formats | media |
| `/media/read` | POST | Extract C2PA manifest from file | media |
| `/media/verify` | POST | Verify C2PA manifest | media |
| `/media/import` | POST | Import C2PA provenance as EAA records | media |
| `/media/ai-check/:cid` | GET | Check if resource was AI-generated | media |

**Key Files:**
- `src/config.ts` - Zod-validated environment config
- `src/context.ts` - Initialize Supabase + Pinata from @provenancekit/storage
- `src/index.ts` - Hono app entry with routes
- `src/services/*.ts` - Business logic using storage interfaces
- `src/handlers/*.ts` - Route handlers
- `src/embedding/service.ts` - Xenova embedding generation

**Migration Pattern:**
```typescript
// Before (Direct Drizzle)
await db.insert(entity).values({ entityId, role, name });

// After (@provenancekit/storage)
await dbStorage.upsertEntity({ id: entityId, role, name });
```

### @provenancekit/sdk ✅ COMPLETE

**Location:** `packages/provenancekit-sdk/`

The SDK has been reworked to support all new API endpoints while maintaining backwards compatibility.

**New Methods Added:**

| Method | Description |
|--------|-------------|
| `bundle(cid)` | Get full provenance bundle for a resource |
| `provenance(cid)` | Get provenance chain (alias for bundle) |
| `similar(cid, topK)` | Find similar resources |
| `searchText(query, opts)` | Search by text query |
| `distribution(cid)` | Calculate payment distribution |
| `distributionPreview(cids, combine)` | Preview distribution for multiple resources |
| `mediaFormats()` | List supported C2PA formats |
| `mediaRead(file)` | Read C2PA manifest from file |
| `mediaVerify(file)` | Verify C2PA manifest |
| `mediaImport(file, opts)` | Import C2PA as EAA records |
| `aiCheck(cid)` | Check if resource was AI-generated |

**New Types Added:**

- `ProvenanceBundle` - Full bundle with resource, actions, entities, attributions
- `Attribution` - Attribution record with weights
- `Distribution`, `DistributionShare` - Payment distribution types
- `C2PAManifest`, `C2PAAction`, `C2PAIngredient` - C2PA types
- `MediaReadResult`, `MediaVerifyResult`, `MediaImportResult` - Media operation results
- `AICheckResult` - AI detection result
- `SupportedFormat` - Media format info
- `TextSearchResult` - Text search results

**Usage Example:**

```typescript
import { ProvenanceKit } from "@provenancekit/sdk";

const pk = new ProvenanceKit({ baseUrl: "http://localhost:3001" });

// Upload file with provenance
const result = await pk.file(imageBuffer, {
  entity: { role: "human", name: "Alice" },
  resourceType: "image",
});

// Get provenance bundle
const bundle = await pk.bundle(result.cid);

// Calculate payment distribution
const distribution = await pk.distribution(result.cid);

// Check C2PA manifest
const c2pa = await pk.mediaRead(imageBuffer);

// Check if AI-generated
const aiCheck = await pk.aiCheck(result.cid);
```

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

# PART 5: NEXT STEPS — CRITICAL EVALUATION & REMEDIATION

Based on a comprehensive audit of the entire codebase against this plan and the broader vision, these are the prioritized next steps organized by severity.

## Priority 0: Critical Bugs (Data Loss / Security)

These must be fixed before any production use.

### 0.1 Encryption Key Discarded — Data Loss Bug

**File:** `apps/provenancekit-api/src/services/activity.service.ts:191-200`

When `encrypt=true`, a key is generated and used to encrypt before IPFS upload, but the key is never returned to the caller or stored anywhere. The encrypted data on IPFS is permanently unrecoverable.

**Fix:**
- Return the encryption key (or a key reference) in the activity response
- Or store it in a key management system (e.g., `IKeyManager` from privacy package)
- The privacy package already has `KeyRing` — wire it into the API context
- Add the key reference to the `ext:storage@1.0.0` extension on the resource

### 0.2 Smart Contract External Self-Call

**File:** `packages/provenancekit-contracts/contracts/ProvenanceRegistry.sol:305`

```solidity
// BUG: this.recordAction() is an external call — changes msg.sender to the contract itself
actionId = this.recordAction(actionType, inputs, outputs);
```

This means `msg.sender` inside `recordAction` becomes the contract address instead of the original caller. All `performedBy` fields will be wrong.

**Fix:** Remove `this.` to make it an internal call:
```solidity
actionId = recordAction(actionType, inputs, outputs);
```

### 0.3 Unprotected Attribution Recording

**File:** `packages/provenancekit-contracts/contracts/ProvenanceRegistry.sol`

`recordAttributionFor()` has no access control — anyone can create arbitrary attributions for any resource/action. This undermines the integrity of the provenance graph.

**Fix:** Add access control — only the action performer or resource creator should be able to record attributions, or require a governance/owner role.

---

## Priority 1: Architectural Gaps

These affect the framework's viability as a generalizable, database-agnostic system.

### 1.1 No Database Schema / Migration Story

The storage abstraction (`IProvenanceStorage`) is excellent, but there is no way for consumers to create the required tables/collections. The Supabase adapter assumes tables (`pk_entity`, `pk_resource`, `pk_action`, etc.) already exist.

**Action items:**
- Add an `initialize()` implementation to each DB adapter that creates the schema
- Or provide SQL migration files / setup scripts per adapter
- Document the expected schema clearly
- Consider a `createSchema()` or `migrate()` method on the interface

### 1.2 Fake Transaction Support

**File:** `packages/provenancekit-storage/src/adapters/db/supabase.ts`

`ITransactionalStorage.transaction()` is implemented but just runs the function directly — no actual transaction semantics. If a multi-step operation partially fails, the database is left in an inconsistent state.

**Action items:**
- Either implement real transactions using Supabase RPC / PostgreSQL functions
- Or remove `ITransactionalStorage` from the Supabase adapter's implements list and document the limitation
- The PostgreSQL adapter should use actual `BEGIN/COMMIT/ROLLBACK`

### 1.3 Session Handler Bypasses Storage Abstraction

**File:** `apps/provenancekit-api/src/handlers/session.ts`

This handler queries Supabase directly (`supabase.from("pk_action").select("*")`) instead of using `IProvenanceStorage`. This defeats the purpose of the storage abstraction and will break if the backend changes.

**Action items:**
- Add `listActions(filter)` and `listResources(filter)` with extension-based filtering to `IProvenanceStorage`
- Or add a `findByExtensions(table, filter)` method
- Rewrite the session handler to use the storage interface exclusively

### 1.4 No API Authentication / Authorization

The API has zero auth — no API keys, no JWT verification, no rate limiting. Any caller can create entities, upload files, and read all provenance data.

**Action items:**
- Add API key or Bearer token authentication middleware
- Add per-project isolation (projectId already exists in extensions but isn't enforced)
- Add rate limiting
- Consider RBAC: who can create vs. read vs. administer

---

## Priority 2: Code Quality & Correctness

### 2.1 Hand-Rolled ECDSA in ProvenanceVerifiable

**File:** `packages/provenancekit-contracts/contracts/core/ProvenanceVerifiable.sol`

Uses raw `ecrecover` without signature malleability protection. This is a known vulnerability class — signatures can be replayed with the alternate `s` value.

**Fix:** Replace with OpenZeppelin's `ECDSA.recover()` which includes malleability checks.

### 2.2 SDK Legacy / Stale Fields

**File:** `packages/provenancekit-sdk/src/client.ts`

- `entity.wallet` field — not part of EAA types, leftover from an earlier design
- `file()` accepts a `dedup` parameter that's never sent to the API
- `tool()` method uses `resourceType: "tool"` which was removed from the core type system

**Fix:** Clean up the SDK to match the current EAA types and API contract. Remove dead code paths.

### 2.3 Extension Keys Not Namespaced

**File:** `apps/provenancekit-api/src/services/activity.service.ts`

`sessionId` and `projectId` are stored as bare keys in the `extensions` object instead of using the `ext:namespace@version` pattern that the entire extension system is built around.

**Fix:** Define an `ext:session@1.0.0` extension schema and use `setExtension()` from eaa-types. This ensures consistency and allows validation.

### 2.4 Zero Tests in Payments Package

The payments package has 3 adapter implementations but no tests. The distribution calculator is well-tested in extensions, but the adapter layer (viem interactions, error handling, dust calculation) is untested.

**Action items:**
- Add unit tests with mocked viem clients for each adapter
- Add integration tests against a local testnet (Hardhat/Anvil)
- Test edge cases: zero amounts, single recipient, max recipients, native ETH vs ERC-20

---

## Priority 3: Polish & Completeness

### 3.1 Remove provenancekit-openai Package

Per prior decision, this package is being removed. Clean it out of the monorepo.

### 3.2 Improve Error Handling Consistency

The API uses `ProvenanceKitError` in some handlers but not all. Standardize error handling across all endpoints.

### 3.3 Add API Documentation

No OpenAPI/Swagger docs exist. Consider adding `@hono/zod-openapi` for auto-generated API documentation.

### 3.4 Package Publishing Setup

None of the packages have been published to npm yet. Set up:
- Package.json `publishConfig` for each package
- CI/CD for automated publishing
- Changelogs / versioning strategy (changesets recommended for monorepos)

---

## Revised Phase Plan

### Phase 6: Hardening & Bug Fixes (NEXT)

| Task | Priority | Effort |
|------|----------|--------|
| Fix encryption key loss in activity service | P0 | Small |
| Fix `this.recordAction()` external call in Registry | P0 | Tiny |
| Add access control to `recordAttributionFor()` | P0 | Small |
| Implement real transactions or remove claim | P1 | Medium |
| Rewrite session handler to use storage interface | P1 | Small |
| Add API authentication middleware | P1 | Medium |
| Replace hand-rolled ECDSA with OpenZeppelin | P2 | Small |
| Clean up SDK legacy fields | P2 | Small |
| Namespace session/project extension keys | P2 | Small |

### Phase 7: Testing & Schema

| Task | Priority | Effort |
|------|----------|--------|
| Add DB schema creation to adapter `initialize()` | P1 | Medium |
| Write payment adapter tests | P2 | Medium |
| Integration tests for API endpoints | P2 | Medium |
| Testnet integration tests for contracts | P2 | Large |

### Phase 8: Production Readiness

| Task | Priority | Effort |
|------|----------|--------|
| Remove provenancekit-openai | P3 | Tiny |
| Add OpenAPI documentation | P3 | Medium |
| Package publishing setup (npm) | P3 | Medium |
| Standardize error handling | P3 | Small |
| x402 adapter implementation | P3 | Medium |

### Phase 9: Platform Layer (provenancekit-app)

| Task | Priority | Effort |
|------|----------|--------|
| Design app architecture | — | Medium |
| Implement with all hardening fixes in place | — | Large |

---

*This document is updated as implementation progresses. Last updated: 2026-02-11*
