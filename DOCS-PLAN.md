# ProvenanceKit Documentation Plan

*Last updated: 2026-02-28 (AI agent infrastructure section added)*

---

## Critical Codebase Review

Before planning documentation, this section records an honest assessment of what has been built, at what quality level, and where the gaps are. Documentation should reflect reality — not aspirations.

---

### What Has Been Done Excellently ✅

#### 1. EAA Type System (`@provenancekit/eaa-types`)
The Entity-Action-Attribution type system is the intellectual core of the project and it is excellent. The design is minimal, W3C PROV-compatible, content-addressed, and extensible without being opinionated. Key strengths:
- Pure meta-pattern — no economic, governance, or domain opinions baked in
- Namespaced extension system (`ext:namespace@semver`) is elegant and safe
- `Attribution` can target either a `resourceRef` or an `actionId` — this is a subtle but important design decision that supports both resource-level credit and action-level contribution recording
- Content addressing via multiple schemes (CID, Arweave, HTTP, hash) is forward-looking
- Attribution canonical ID generation is well-thought-out

This should be presented as the foundation everything else builds on.

#### 2. Extension Architecture (`@provenancekit/extensions`)
13 extension namespaces covering contribution weights, licensing, payments, on-chain anchoring, storage metadata, AI tool/agent tracking, cryptographic proofs, identity, witness attestation, tool attestation, verification, and ownership. Key strengths:
- Every extension has full Zod schemas + `with*()` / `get*()` / `has*()` helpers — the DX is consistent
- The AI extension (`ext:ai@1.0.0`) is dual-mode (AI as tool, AI as autonomous agent) and machine-readable — this directly satisfies EU AI Act Art. 50(2) traceability requirements
- Distribution calculator uses the Largest Remainder Method (Hamilton's method) — mathematically sound, not just "divide evenly"
- 227 tests passing — well-covered

#### 3. Privacy Package (`@provenancekit/privacy`)
Best-in-class for a provenance system. Five complete modules:
- XChaCha20-Poly1305 and AES-256-GCM encryption via `@noble/ciphers` (Cure53-audited)
- SD-JWT-like selective disclosure — prove provenance claims without revealing all details
- Pedersen commitments with homomorphic operations — ZK-friendly contribution proofs
- Lit Protocol access control integration — token-gated provenance access
- Encrypted file storage wrapper — transparent encrypt-before-upload
- 187 tests passing

This is genuinely sophisticated and not a thin wrapper around a single library.

#### 4. C2PA Media Integration (`@provenancekit/media`)
Full bidirectional C2PA ↔ EAA conversion. Graceful degradation when `c2pa-node` is not installed. AI disclosure detection. X.509 certificate signing. Covers JPEG, PNG, WebP, MP4, MOV, PDF.
- 157 tests passing
- Directly relevant to EU AI Act Art. 50(2) media content requirements
- C2PA is the industry standard (Adobe, Microsoft, Google, Meta, OpenAI) — this interop is strategically important

#### 5. Smart Contracts (`@provenancekit/contracts`)
Clean three-tier architecture: `ProvenanceCore` → `ProvenanceVerifiable` → `ProvenanceRegistry`. Key strengths:
- Event-driven (emit events, minimal storage) — gas-efficient, indexer-friendly
- ECDSA via OpenZeppelin — malleability-safe, audited library
- Commitment scheme for ZK-friendly delayed reveal
- `recordActionAndRegisterOutputs()` — gas-efficient convenience function
- Cross-chain unique action IDs (chainId in hash)
- 27/27 Foundry tests passing
- Deliberate permissive self-attribution design (documented design choice, not a bug)

#### 6. Git Package (`@provenancekit/git`)
Comprehensive code provenance:
- Blame analysis with contribution weight calculation
- AI co-author detection across 30+ tools (Copilot, Claude, ChatGPT, Cursor, Aider, Gemini, etc.)
- Git hook generators
- GitHub integration via Octokit (PRs, reviews, contributors)
- 71 tests passing

This positions ProvenanceKit as the foundation for a "provenance-aware GitHub."

---

### What Has Been Done Well (Good, Addressable Gaps) ⚠️

#### 7. Storage Layer (`@provenancekit/storage`)
The interface design is excellent — `IProvenanceStorage`, `IFileStorage`, `IVectorStorage`, `ISyncableStorage`, `ISubscribableStorage`, `ITransactionalStorage` give clean separation. The optional capability pattern (type guards) is idiomatic TypeScript.

File adapters are all substantive: Pinata, Local IPFS, Infura IPFS, Arweave, Web3Storage.

DB adapters have more variance:
- **MemoryDbStorage**: Complete, 25 tests — the reference implementation
- **PostgresStorage**: Substantively complete (direct pg client, JSONB extensions, vector-ready)
- **MongoDBStorage**: Has significant implementation (~520 lines) — more than the "stub" label in the master plan suggests, but may have untested paths
- **SupabaseStorage**: Has significant implementation (~1000 lines) with pgvector and real-time — similarly may have untested paths

The key gap: adapters assume tables/collections already exist. There is no `initialize()` method that creates the schema. This is a significant DX problem — a new developer cannot just `new PostgresStorage(url)` and start recording; they need to know the schema and create it separately.

#### 8. SDK (`@provenancekit/sdk`)
Feature-rich HTTP client with signing utilities and encrypted vector operations. 25 tests. The signing module (Ed25519, ECDSA-secp256k1, bundle signing, server witness creation) is solid.

Gaps:
- No direct contract interaction — the SDK calls the API, which optionally records on-chain. The blockchain is not a first-class concern in the SDK.
- Legacy fields to clean up: `entity.wallet`, unused `dedup` param, `tool()` method using removed resource type
- No integration tests — only unit tests for crypto operations

#### 9. API (`provenancekit-api`)
Comprehensive Hono-based REST API with 11 route handler groups, 7 services, pluggable auth middleware, embedding generation, and vector search. The `activity.service.ts` convenience endpoint (upload → IPFS → embed → dedup → EAA records) is particularly well-designed.

Gaps:
- **Zero test suite** — a production API with no tests is a significant risk
- No rate limiting (placeholder only)
- No OpenAPI spec generated from code (currently a static file that may drift)
- Blockchain recording path is not deeply tested end-to-end

#### 10. Payment Adapters (`@provenancekit/payments`)
Three real adapters: DirectTransfer, 0xSplits, Superfluid. 43 tests. The distribution calculator and Largest Remainder Method are reused from extensions — consistent design.

Gap: x402 adapter is deferred. Given x402's natural fit (HTTP-native micropayments, AI agent compatibility) and the vision of per-access provenance payments, this is an important missing piece.

---

### What Needs Improvement / Critical Gaps ❌

#### 11. Indexer (`@provenancekit/indexer`)
The implementation (710 lines) is more complete than the master plan's "stub" label suggests — it handles 5 event types, historical sync, real-time polling, batch processing, error recovery, and retry logic. However:
- **Zero tests** — the most critical untested component in the codebase. The indexer is what makes the blockchain the source of truth. Without tests, confidence in its correctness is zero.
- The entire architecture (blockchain = source of truth, database = materialized view) depends on the indexer working correctly and idempotently
- No testnet integration tests verifying actual event sync

#### 12. Blockchain Recording Gap in SDK
The SDK calls the API, which may or may not record on-chain depending on env vars. There is no path where a developer using the SDK directly can guarantee on-chain recording. This undermines the core value proposition:
> "On-chain provenance as source of truth"

Currently this is more aspiration than reality. The path is: SDK → API → (maybe) contract. The contracts are excellent; the wiring to use them is incomplete.

#### 13. Missing `ext:authorization@1.0.0`
No general-purpose authorisation extension exists. This means there is no structured way to record whether a use of a resource was authorised, by whom, and on what basis. This is both a legal gap (EU AI Act, NO FAKES Act, GDPR consent) and a practical gap for enforcement workflows. The ext:license extension covers what terms apply; there is nothing that covers whether the terms were met in a specific use.

#### 14. Missing AI Training Opt-Out in `ext:license@1.0.0`
The license extension has no field for AI training permission status. DSM Article 4(3) requires machine-readable rights reservation for text/data mining. This is a one-field addition to an existing extension, but it's absent.

#### 15. No Multi-Chain Deploy Tooling
The contracts are excellent and support multiple chains architecturally (chainId in action IDs, chain config interfaces). But there is no CLI deploy script, no deployment registry, and no chain configuration helpers in the SDK. A developer who wants to deploy ProvenanceKit to their own L2 has no tooling to do so.

#### 16. Documentation Is Nearly Empty
The Mintlify site is set up with the default template. There is essentially no ProvenanceKit-specific content. All pages are either Mintlify placeholders or basic stubs. This is the most visible gap to anyone evaluating the project.

#### 17. No EIP Proposal / Protocol Standardisation
The ProvenanceRegistry event schema (`ActionRecorded`, `ResourceRegistered`, `AttributionRecorded`) is a natural candidate for an EIP. Without standardisation, other chains and projects cannot interoperate at the contract level. This is a future-state concern but worth noting as a strategic gap.

---

### Summary Assessment

| Area | Rating | Primary Reason |
|------|--------|----------------|
| EAA Type System | Excellent | Pure, minimal, extensible, W3C PROV aligned |
| Extension Architecture | Excellent | 13 namespaces, consistent DX, 227 tests |
| Privacy Package | Excellent | 5 modules, audited libs, 187 tests |
| C2PA Media | Excellent | Full bidirectional conversion, 157 tests |
| Smart Contracts | Excellent | Clean 3-tier, OpenZeppelin ECDSA, 27 tests |
| Git Package | Good | Comprehensive, 71 tests, underdocumented patterns |
| Storage Interfaces | Good | Clean design; DB adapters have untested paths |
| SDK | Good | Feature-rich; blockchain not first-class |
| API | Good | Comprehensive routes; zero test suite |
| Payment Adapters | Good | 3 real adapters; x402 missing |
| Indexer | Partial | Implementation exists; 0 tests |
| Authorization Extension | Gap | Does not exist |
| License AI Training Field | Gap | One missing field with legal significance |
| Multi-Chain Deploy Tooling | Gap | Contracts support it; tooling does not exist |
| Documentation | Gap | Default Mintlify template; no content |
| EIP Proposal | Gap | Not started |

---

## Documentation Plan

### Philosophy

The docs should serve three audiences simultaneously:

1. **Protocol Developers** — people building their own provenance systems on top of ProvenanceKit (think: someone deploying a provenance layer for their L2, or building a domain-specific provenance system for music licensing)
2. **Application Developers** — people integrating ProvenanceKit into their AI applications, creative tools, or platforms using the SDK and API
3. **Evaluators** — technical decision-makers and researchers understanding what ProvenanceKit is and why it matters

Docs should be structured pyramid-down: start with concepts, then show how the layers work, then give practical usage. Every page should make the reader feel like they understand the system better than when they started.

### Documentation Structure

The Mintlify site will have four top-level tabs:

```
[ Introduction ] [ Guides ] [ SDK & API Reference ] [ Protocol ]
```

---

### Tab 1: Introduction

**Purpose:** Orient any reader — technical or not — to what ProvenanceKit is, why it matters, and how it fits together.

#### Pages:

**`/` — What is ProvenanceKit?**
- The problem: Human-AI collaborative works have no provenance standard
- The solution: A universal provenance protocol, not a SaaS
- The three-layer architecture diagram (Base → Extension → Platform)
- Key properties: on-chain truth, content-addressed, storage-agnostic, extensible
- Brief comparison: how it differs from C2PA (media-focused) and W3C PROV (abstract graph)
- Call to action: link to Quickstart and Protocol docs

**`/vision` — Vision & Design Principles**
- Universal provenance framework — like Ethereum for provenance
- "Layer 2" model: deploy your own provenance system on top of the base
- Why on-chain? Immutability, non-repudiation, no central point of failure
- Why content-addressed? Deduplication, verification, decentralization
- Why storage-agnostic? Developer control, no lock-in
- The pyramid: EAA types → Extensions → Platform
- Connection to legal context: EU AI Act, copyright, C2PA ecosystem

**`/architecture` — Architecture Overview**
- Full architecture diagram
- The three layers explained
- Package map: which package does what
- Data flow: content → IPFS → EAA records → API → blockchain → indexer → DB
- Extension system explained: `ext:namespace@version` pattern
- Multi-chain model: how a custom deployment works

**`/eaa-model` — The EAA Model**
- Entity, Action, Resource, Attribution — each explained with examples
- ProvenanceBundle as the graph container
- Content addressing: CIDs, Arweave refs, HTTP refs — why this matters
- Attribution targeting: `resourceRef` vs `actionId` — when to use each
- How extensions attach to any EAA type
- W3C PROV mapping (for readers familiar with the standard)

**`/legal-context` — Legal & Compliance Context** *(optional, for evaluators)*
- Why provenance matters for copyright in the AI era
- EU AI Act transparency requirements (Art. 50, 53)
- C2PA and how ProvenanceKit interoperates
- DSM Art. 4(3) AI training opt-out and `ext:license@1.0.0`
- Human creative input evidencing via the EAA graph

---

### Tab 2: Guides

**Purpose:** Practical, task-oriented documentation for application developers. Get from zero to a working integration as fast as possible.

#### Group: Getting Started

**`/quickstart` — 5-Minute Quickstart**
- Install the SDK: `npm install @provenancekit/sdk`
- Point at a hosted API (or self-host)
- Record your first provenance bundle: create entity → upload file → record action → get attribution
- See the provenance graph
- Next steps

**`/self-hosting` — Self-Hosting the API**
- Prerequisites: Node.js, PostgreSQL (or another supported DB), IPFS (Pinata/Infura or local)
- Environment variables reference
- Running with Docker
- Running in production (process manager, reverse proxy)
- Connecting your own blockchain (env vars for contract address, RPC URL)

**`/authentication` — Authentication**
- API key authentication
- How to generate and rotate keys
- Dev mode (no keys required for local development)
- Implementing a custom auth provider

#### Group: Core Workflows

**`/recording-provenance` — Recording Provenance**
- The three primitives: Entity, Action, Resource
- `POST /entity` → `POST /resource` → `POST /action` → `POST /attribution`
- Using the activity endpoint for convenience: single call for upload + full EAA records
- Session tracking: grouping related actions
- Batch operations

**`/provenance-graph` — Querying the Provenance Graph**
- `GET /graph/:resourceCid` — full graph traversal
- `GET /resource/:cid` — single resource
- `GET /session/:sessionId` — session bundle
- Graph depth and filtering
- Reading lineage: who created what from what

**`/content-addressing` — Content Addressing**
- Why content addressing is the foundation
- Working with IPFS CIDs
- Storing files: Pinata, Infura, Local IPFS, Arweave, Web3Storage
- Configuring your IPFS provider
- Content verification

**`/search` — Search & Deduplication**
- Vector similarity search: finding similar content
- Exact duplicate detection
- Near-duplicate detection via embeddings
- `POST /similar` and `GET /search`
- Encrypted vector search (privacy-preserving similarity)

#### Group: Extensions

**`/extensions/overview` — Extension System Overview**
- `ext:namespace@version` format
- How extensions attach to any EAA type
- Official extensions vs custom extensions
- Extension registry and validation
- `withExtension()`, `getExtension()`, `hasExtension()` utilities

**`/extensions/ai` — AI Extension (`ext:ai@1.0.0`)**
- Dual-mode: AI as Tool vs AI as Agent
- Recording AI tool usage on an Action
- Recording an autonomous AI agent as an Entity
- Multi-agent systems and collaborators
- Autonomy level and session tracking
- EU AI Act compliance angle

**`/extensions/license` — License Extension (`ext:license@1.0.0`)**
- Attaching license terms to Resources and Attributions
- SPDX identifiers and Creative Commons presets
- Commercial use, attribution requirements
- AI training opt-out (DSM Art. 4(3))
- Machine-readable rights reservation

**`/extensions/onchain` — On-Chain Extension (`ext:onchain@1.0.0`)**
- Blockchain anchoring proof
- Recording chain ID, tx hash, block number, contract address
- Attaching to Actions and Resources
- Verifying on-chain records

**`/extensions/contrib` — Contribution Extension (`ext:contrib@1.0.0`)**
- Contribution weights on Attributions
- Basis points system (0–10,000)
- Distribution calculation from attribution graph
- Largest Remainder Method and dust handling
- Feeding into payment distribution

**`/extensions/custom` — Building Custom Extensions**
- Namespace conventions
- Creating a Zod schema
- Registering in the ExtensionRegistry
- Helper function pattern (`with*`, `get*`, `has*`)
- Example: a domain-specific extension for music metadata

#### Group: Payments

**`/payments/overview` — Payment Distribution Overview**
- How provenance drives payments: attribution → contribution weights → payment splits
- The three payment adapters: DirectTransfer, 0xSplits, Superfluid
- Choosing the right adapter for your use case
- x402 micropayments (planned)

**`/payments/distribution` — Calculating Distribution**
- `GET /distribution/:cid` — calculate from provenance graph
- `POST /distribution/preview` — preview without executing
- Understanding the distribution object

**`/payments/adapters` — Payment Adapters**
- DirectTransfer: one-time payments via Viem
- 0xSplits: automatic revenue distribution contracts
- Superfluid: real-time token streaming (continuous royalties)
- Configuring chains and tokens

#### Group: Privacy

**`/privacy/overview` — Privacy Overview**
- Privacy model: what can be public, what can be encrypted, what can be selectively disclosed
- Three privacy modes: public provenance, commitment-only, selective disclosure

**`/privacy/encryption` — Encryption**
- Encrypting file content before IPFS upload
- Key derivation: password-based and wallet signature-based
- `EncryptedFileStorage` wrapper
- Returning and storing encryption keys

**`/privacy/access-control` — Access Control**
- Lit Protocol integration
- Access conditions: ERC-20, ERC-721, ERC-1155, SIWE
- Logic combinators: `allOf()`, `anyOf()`
- Token-gating provenance records

**`/privacy/selective-disclosure` — Selective Disclosure**
- SD-JWT-like presentations
- Creating a disclosure proof
- Verifying a presentation
- Time-limited access proofs

**`/privacy/commitments` — Commitment Schemes**
- Pedersen commitments for contribution weights
- Proving a claim without revealing the value
- Smart contract integration (`commitmentToBytes`, `commitmentHash`)
- ZK-friendly provenance proofs

#### Group: Domain Packages

**`/packages/git` — Git & Code Provenance**
- Installing Git hooks
- What gets recorded on each commit
- AI co-author detection: which tools are detected and how
- Contribution weights from blame analysis
- GitHub integration: PRs, reviews, contributors
- The "provenance-aware GitHub" vision and how to build it

**`/packages/media` — Media Provenance & C2PA**
- Reading C2PA manifests from images
- Embedding C2PA manifests
- Bidirectional C2PA ↔ EAA conversion
- AI disclosure detection
- Supported formats
- Why C2PA interoperability matters

**`/packages/openai` — OpenAI Integration** *(once implemented)*
- Recording ChatCompletion provenance
- Recording DALL-E generation provenance
- Recording Whisper transcription provenance
- Attaching `ext:ai@1.0.0` automatically

#### Group: Patterns

**`/patterns/model-training` — Model Training Provenance**
- Dataset resource → training action → model resource
- Recording who performed the training
- Recording the training infrastructure (`ext:ai@1.0.0`)
- Recording dataset licensing (`ext:license@1.0.0` with AI training field)
- EU AI Act Art. 53(1)(d) disclosure coverage

**`/patterns/human-ai-collaboration` — Human-AI Co-Creation**
- Human-authored content as an input resource
- Recording AI tool use on the action
- How the graph evidences human creative contribution
- Copyright analysis angle: what the provenance graph shows

**`/patterns/remix-chain` — Derivative Works & Remix Chains**
- Using source attribution to link derivative works
- Traversing a remix lineage
- Cascading attribution across generations
- Payment distribution through a remix chain

**`/patterns/code-provenance` — Code Provenance**
- Commit-level provenance with Git hooks
- AI co-authorship attribution
- Pull request and review tracking
- Building a "provenance-aware repo"

**`/patterns/authorization` — Authorization Records** *(after ext:authorization@1.0.0 is built)*
- Recording explicit authorisation status
- Linking to the authorisation instrument
- Revocation and expiry
- Enforcement data completeness

---

### Tab 3: SDK & API Reference

**Purpose:** Complete reference for developers calling the SDK or REST API. Primarily auto-generated where possible.

#### Group: SDK Reference

**`/sdk/installation` — Installation & Configuration**
- `npm install @provenancekit/sdk`
- Constructor options
- Configuring API endpoint, auth, signing

**`/sdk/client` — SDK Client Methods**
- `uploadFile()` — register content with full provenance
- `recordAction()` — track transformations
- `createEntity()` — register agents
- `getProvenance()` — full graph traversal
- `searchByContent()` — vector similarity search
- `claimOwnership()` / `transferOwnership()` — ownership management
- All other methods with parameter docs

**`/sdk/signing` — Signing & Verification**
- Bundle signing
- Action signing (Ed25519 and ECDSA-secp256k1)
- Server witness creation
- Verification utilities

**`/sdk/errors` — Error Handling**
- Error types
- Status code mapping
- Retry strategies

#### Group: API Reference

**`/api/introduction` — API Overview**
- Base URL, authentication
- Request/response format
- Error format
- Rate limiting (when implemented)

**`/api/entities` — Entity Endpoints**
- `POST /entity`
- `GET /entity/:id`

**`/api/resources` — Resource Endpoints**
- `POST /resource`
- `GET /resource/:cid`
- `GET /resource/:cid/ownership`
- `POST /resource/:cid/ownership/claim`
- `POST /resource/:cid/ownership/transfer`

**`/api/actions` — Action Endpoints**
- `POST /action`
- `GET /action/:id`

**`/api/attributions` — Attribution Endpoints**
- `POST /attribution`
- `GET /attributions/:resourceCid`

**`/api/activity` — Activity Endpoint**
- `POST /activity` — full upload-with-provenance convenience endpoint

**`/api/graph` — Graph & Bundle Endpoints**
- `GET /graph/:resourceCid`
- `POST /bundle`
- `GET /session/:sessionId`

**`/api/search` — Search Endpoints**
- `GET /search`
- `POST /similar`

**`/api/distribution` — Distribution Endpoints**
- `GET /distribution/:cid`
- `POST /distribution/preview`

**`/api/media` — Media Endpoints**
- `POST /media/extract-c2pa`
- `POST /media/embed-provenance`

---

### Tab 4: Protocol

**Purpose:** Documentation for protocol developers — people building their own provenance systems on top of the base layer, deploying to custom chains, or contributing to the protocol itself.

#### Group: Protocol Specification

**`/protocol/overview` — Protocol Overview**
- ProvenanceKit as a protocol, not just an SDK
- The "Layer 2 analogy": build your own provenance system on top
- What is standardised (the EAA model, contract events) vs what is pluggable (storage, IPFS, chain)
- How multiple deployments interoperate via content addresses

**`/protocol/contracts` — Smart Contract Architecture**
- Three-tier contract hierarchy: Core → Verifiable → Registry
- ProvenanceCore: event-driven recording, before/after hooks
- ProvenanceVerifiable: ECDSA signatures, commitment scheme, `recordActionWithProof()`
- ProvenanceRegistry: full reference implementation, entity/resource/attribution management
- Event schema: `ActionRecorded`, `ResourceRegistered`, `EntityRegistered`, `AttributionRecorded`
- Permissive self-attribution design (documented choice)
- Building custom contracts on top of the base

**`/protocol/events` — Event Schema**
- Full event signature definitions
- Parameter semantics
- Cross-chain action ID uniqueness (chainId in hash)
- Indexing requirements

**`/protocol/deploying` — Deploying to a Chain**
- Prerequisites: Foundry, RPC access, funded deployer key
- Deployment steps (manual, until CLI tooling is built)
- Chain configuration: adding ProvenanceKit to your chain preset
- Verifying the deployment
- Deployment registry: tracking your deployed contract addresses

**`/protocol/indexer` — The Indexer**
- Role: materialising blockchain events into the storage layer
- Historical sync: how it catches up from genesis
- Real-time watching: polling interval and confirmation counts
- Error recovery: retry logic, recoverable vs fatal errors
- Running as a background process
- Configuring `ISyncableStorage`

**`/protocol/storage` — Storage Architecture**
- `IProvenanceStorage` interface: the contract between the platform and any database
- Supported adapters: Memory (testing), PostgreSQL, MongoDB, Supabase
- `IFileStorage`: IPFS, Arweave, Web3Storage, Local
- Optional capabilities: `IVectorStorage`, `ITransactionalStorage`, `ISyncableStorage`, `ISubscribableStorage`
- Building a custom storage adapter
- Schema expectations for DB adapters (PostgreSQL DDL reference)

**`/protocol/multi-chain` — Multi-Chain Architecture**
- How a federated node works
- Running your own indexer against your own chain
- ChainConfig and network presets: Base, Arbitrum, Optimism, Ethereum
- Cross-chain provenance: content addresses are chain-independent
- Layer 2 deployment model

**`/protocol/interoperability` — Interoperability**
- W3C PROV mapping from EAA types
- C2PA ↔ EAA bidirectional conversion (`@provenancekit/media`)
- SPDX license identifiers in `ext:license@1.0.0`
- Future: ISCN bridge (LikeCoin)
- Future: EIP proposal for the event schema

**`/protocol/eip` — Protocol Standardisation** *(future)*
- The case for an EIP
- Draft event schema
- How to propose `IProvenanceProvider` as a standard interface
- Community engagement

---

### Content Priority Order

Not everything can be written at once. This is the recommended order for maximum impact:

#### Phase 1 — Foundation (Write First)
These pages make the project comprehensible to a new evaluator and allow early adopters to get started.

1. `/` — What is ProvenanceKit
2. `/architecture` — Architecture Overview
3. `/eaa-model` — The EAA Model
4. `/quickstart` — 5-Minute Quickstart
5. `/recording-provenance` — Recording Provenance
6. `/extensions/overview` — Extension System Overview
7. `/extensions/ai` — AI Extension
8. `/protocol/contracts` — Smart Contract Architecture

#### Phase 2 — Practical Usage
These pages serve application developers actively building integrations.

9. `/self-hosting` — Self-Hosting the API
10. `/extensions/license` — License Extension
11. `/extensions/contrib` — Contribution Extension
12. `/packages/git` — Git & Code Provenance
13. `/packages/media` — Media Provenance & C2PA
14. `/patterns/human-ai-collaboration` — Human-AI Co-Creation
15. `/patterns/model-training` — Model Training Provenance
16. `/payments/overview` — Payment Distribution
17. `/privacy/overview` — Privacy Overview

#### Phase 3 — Advanced & Protocol
These pages serve protocol developers and researchers.

18. `/protocol/overview` — Protocol Overview
19. `/protocol/deploying` — Deploying to a Chain
20. `/protocol/indexer` — The Indexer
21. `/protocol/storage` — Storage Architecture
22. `/protocol/interoperability` — Interoperability
23. `/privacy/selective-disclosure` — Selective Disclosure
24. `/privacy/commitments` — Commitment Schemes
25. `/patterns/remix-chain` — Derivative Works

#### Phase 4 — Reference (Partially Auto-Generated)
26. Full SDK method reference
27. Full API endpoint reference (from OpenAPI)
28. `/vision` — Vision & Design Principles
29. `/legal-context` — Legal & Compliance Context

---

### Mintlify Configuration Plan

The `docs.json` needs to be rewritten to reflect the ProvenanceKit structure. Recommended changes:

```json
{
  "name": "ProvenanceKit",
  "theme": "mint",
  "colors": {
    "primary": "#6366F1",
    "light": "#818CF8",
    "dark": "#4F46E5"
  },
  "navigation": {
    "tabs": [
      { "tab": "Introduction", "groups": [...] },
      { "tab": "Guides", "groups": [...] },
      { "tab": "SDK & API", "groups": [...] },
      { "tab": "Protocol", "groups": [...] }
    ]
  }
}
```

The current Mintlify default template pages (Mint docs about Mintlify itself) should all be removed. Logos, favicons, and branding should be updated to ProvenanceKit assets.

---

### Things to Document Honestly (Not Aspirationally)

The documentation must be accurate about what is currently available vs what is planned. Use clear signals:

- `✅ Available` — implemented and tested
- `🚧 Coming Soon` — planned, not yet available
- `📋 Planned` — on the roadmap

Specific items that need honest framing:
- **x402 micropayments** — planned, not implemented; do not document as if it exists
- **MongoDB/Supabase adapters** — implemented but untested paths; call out testing status
- **Indexer** — implemented but not tested; note that testing is in progress
- **Multi-chain deploy CLI** — does not exist yet; manual deployment steps only
- **EIP proposal** — not started; mention as part of the vision
- **Authorization extension** — does not exist yet; note it is planned
- **AI training opt-out field in license** — does not exist yet; on the roadmap

---

### Open Questions Before Writing Begins

Before writing Phase 1 docs, these decisions should be made:

1. **Hosted API URL** — will there be a hosted ProvenanceKit API for developers to test against, or is self-hosting the only option initially?
2. **npm package names** — are packages published at `@provenancekit/*` on npm, or not yet? Quickstart docs depend on this.
3. **Default chain** — is Base Sepolia the recommended testnet? What is the mainnet recommendation?
4. **Contract addresses** — are there canonical deployed contract addresses to reference in docs?
5. **Brand colors / logo** — what color scheme for the Mintlify site?
6. **GitHub org** — is there a public GitHub org/repo for community links?

---

## AI Agent Infrastructure

*Research date: 2026-02-28. Standards sourced from [agentskills.io](https://agentskills.io/specification), [Mintlify blog](https://www.mintlify.com/blog/skill-md), [Anthropic engineering](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills), [llmstxt.org](https://llmstxt.org/).*

AI coding agents (Claude Code, Cursor, GitHub Copilot, VS Code Copilot, OpenAI Codex, Gemini CLI, Windsurf and 15+ others) are now primary consumers of documentation alongside human developers. As of late 2025, any library that wants AI agents to integrate it correctly must publish machine-readable artefacts alongside its human docs. Mintlify, with which ProvenanceKit's docs are built, auto-generates most of this infrastructure — but we still need to provide curated content that guides agents well.

### The Three Artefacts

#### 1. `llms.txt` — AI Sitemap

**What it is:** A file at `/llms.txt` on the docs site that acts as a structured map of the most important documentation URLs, written in Markdown for LLM consumption. Analogous to `robots.txt` but for AI agents. The standard was proposed by Jeremy Howard (Answer.AI) and gained mass adoption in late 2025 when Mintlify rolled it out across all hosted docs sites.

**Mintlify auto-generates it.** We don't write it manually. It is regenerated on every docs deploy. However, the quality of the auto-generated file depends directly on the quality and structure of the underlying docs pages.

**`llms.txt` format:**
```markdown
# ProvenanceKit

> Universal provenance protocol for Human-AI created works.
> Track, verify, and attribute content across any chain, any storage, any AI tool.

## Core Concepts

- [EAA Model](https://docs.provenancekit.com/eaa-model): Entity-Action-Attribution — the foundational data model
- [Architecture](https://docs.provenancekit.com/architecture): Three-layer pyramid and package map

## Getting Started

- [Quickstart](https://docs.provenancekit.com/quickstart): Record your first provenance bundle in 5 minutes
- [Recording Provenance](https://docs.provenancekit.com/recording-provenance): Core workflow

## Extensions

- [Extension Overview](https://docs.provenancekit.com/extensions/overview): ext:namespace@version system
- [AI Extension](https://docs.provenancekit.com/extensions/ai): ext:ai@1.0.0 — track AI tool usage
- [License Extension](https://docs.provenancekit.com/extensions/license): ext:license@1.0.0

## Optional

- [Protocol](https://docs.provenancekit.com/protocol/overview): For protocol developers and custom deployments
- [Legal Context](https://docs.provenancekit.com/legal-context): EU AI Act, copyright, C2PA alignment
```

There is also `llms-full.txt` — a concatenated version of the full text of all docs pages, useful when an agent needs complete context. Mintlify generates this too.

**Implication for writing docs:** Every page must have a clear, specific title and a one-paragraph summary at the top. These are used in the auto-generated `llms.txt` entries. Vague page titles and missing introductions will produce a useless sitemap.

---

#### 2. `skill.md` — Agent Integration Skill

**What it is:** A SKILL.md file following the [Agent Skills open standard](https://agentskills.io/specification) (published by Anthropic, Dec 2025; now adopted by 20+ platforms including Claude Code, Cursor, GitHub Copilot, VS Code, OpenAI Codex, Gemini CLI). A skill is a structured, task-oriented guide that tells AI agents *what the product can do and how to use it*, consolidated for agent consumption rather than human reading.

**How it works:** Skills use progressive disclosure — three tiers:
1. **Metadata** (~100 tokens): YAML frontmatter with `name` and `description` — loaded at startup for every skill, used to decide relevance
2. **Instructions** (<5000 tokens): The full SKILL.md body — loaded when the skill is activated
3. **References** (on demand): Files in `references/`, `scripts/`, `assets/` — loaded only when the agent needs them

**Mintlify auto-generates a skill** at `/.well-known/skills/default/skill.md` and regenerates it on every docs deploy. However, the auto-generated version is based on the full docs and may not be optimally curated for developer integration tasks. **We should provide a hand-crafted `skill.md` in the monorepo root** that Mintlify will use instead of the auto-generated one.

**Installation:** Any developer can install the ProvenanceKit skill into their coding agent with:
```bash
npx skills add https://docs.provenancekit.com
```
This works across all 20+ supported platforms that have adopted the standard.

**Skill file format** (from the [Agent Skills spec](https://agentskills.io/specification)):
```markdown
---
name: provenancekit
description: Record, query, and verify provenance for Human-AI created content.
  Use when a developer needs to track who created what, with what AI tools,
  from what inputs — or when integrating ProvenanceKit SDK/API into an application.
license: MIT
metadata:
  author: provenancekit
  version: "1.0"
compatibility: Designed for Claude Code, Cursor, VS Code Copilot, and similar coding agents
---

## What ProvenanceKit Does

ProvenanceKit is a universal provenance protocol for Human-AI created works.
It records who created what, using which AI tools, from which inputs — on-chain and content-addressed.

Core primitives:
- **Entity** — a person, AI agent, or organization
- **Action** — a creation, transformation, or aggregation step
- **Resource** — content-addressed output (IPFS CID)
- **Attribution** — links entities to actions/resources with roles

## Quick Integration

...step-by-step instructions for the most common tasks...
```

**Deliverable:** A `skill.md` at the monorepo root (Mintlify will pick this up) AND a copy in `apps/provenancekit-docs/skill.md`. This file should be maintained as a first-class artefact — updated whenever the API or SDK changes significantly.

The skill should cover:
- What ProvenanceKit is (2 sentences)
- The EAA model (quick reference)
- Common integration tasks (step-by-step):
  - Record provenance for an AI generation
  - Upload a file with full EAA records
  - Attach the AI extension (`ext:ai@1.0.0`)
  - Query a provenance graph
  - Set up the extension system
- Key gotchas (common mistakes)
- Links to references/ for deeper content per package

---

#### 3. `/mcp` — MCP Server

**What it is:** A [Model Context Protocol](https://www.mintlify.com/docs/ai/model-context-protocol) server endpoint that Mintlify auto-generates at `[docs-url]/mcp`. AI agents can connect to this as an MCP connector to query the documentation in real-time — rather than relying on web search or stale training data.

**Mintlify auto-generates this with zero configuration.** It indexes all docs pages and exposes a search tool. Rate limits: 200 req/hr per user, 1000/hr site-wide.

**How agents connect:** In Claude Code, add as a custom MCP connector using the URL. Same pattern in Cursor, VS Code with MCP support, etc.

**Implication:** The MCP server is only as useful as the docs are complete. When Phase 1 docs are written, agents will be able to query ProvenanceKit documentation accurately for the first time.

---

### Additional Agent Infrastructure

#### Cursor Rules (`.cursor/rules/provenancekit.mdc`)

Provide a Cursor rules file in the monorepo that developers building with ProvenanceKit can reference. This should go at `.cursor/rules/provenancekit.mdc` and cover:
- Import patterns for ProvenanceKit packages
- How to structure EAA records
- Extension usage conventions
- Common mistakes to avoid

This is distinct from the skill.md — it's project-specific context for developers *building on ProvenanceKit*, not for agents *integrating ProvenanceKit into a new project*.

#### `AGENTS.md` at Monorepo Root

An `AGENTS.md` file at the monorepo root (distinct from CLAUDE.md) following emerging conventions for describing a codebase to AI agents. Should include:
- Monorepo structure summary (package map)
- Which packages are stable vs in-progress
- Key architectural decisions
- How to run tests per package
- Extension system quick reference
- Links to skill.md and docs

This helps any AI coding agent (not just Claude Code) orient quickly when working on the ProvenanceKit codebase itself.

---

### Writing Docs for AI Consumption: Style Rules

Based on research into what makes documentation agent-friendly, these rules apply to every page:

1. **Self-contained pages.** Every page must make sense without reading others. AI agents often load single pages, not full doc sets. Include brief context at the top.

2. **One concept per page.** Don't cram multiple packages or concepts into one page. A focused page produces a better `llms.txt` entry and a better search result from the MCP server.

3. **Complete, runnable code examples.** All code examples must be copy-pasteable and complete. No `...` placeholders that leave the agent guessing. Include imports.

4. **Explicit types in examples.** TypeScript examples should show types explicitly. Agents are better at generating correct code when they can see the expected shape.

5. **Gotchas sections.** Every package page should have a "Common Mistakes" or "Gotchas" section. This is one of the most valuable things for agents: knowing what *not* to do.

6. **Clear H2/H3 structure.** Use headings consistently. The auto-generated `llms.txt` and MCP server index extract structure from headings. Flat, heading-free pages are hard to navigate.

7. **Explicit availability status.** Always mark features with `✅ Available`, `🚧 Coming Soon`, or `📋 Planned`. Agents should never generate code for unimplemented features.

8. **Concise blockquote summaries.** Each page should start with a `>` blockquote that summarises what the page is about in one sentence. This appears in `llms.txt` entries.

---

### Revised Content Priority (with Agent Infrastructure)

The priority order from earlier still stands, but add these as parallel work items that should be done *before* Phase 1 human docs are published:

**Pre-Phase 1 (Do First):**
- [ ] Update `docs.json` with ProvenanceKit structure (remove Mintlify template content)
- [ ] Write `skill.md` — the ProvenanceKit agent skill (place at monorepo root + docs root)
- [ ] Write `AGENTS.md` at monorepo root
- [ ] Add `.cursor/rules/provenancekit.mdc` to monorepo

**These do not depend on the full docs being written.** The skill.md in particular can be written immediately based on existing package knowledge, and it will be the highest-ROI agent-facing artefact before the full docs are complete.

---

*This plan should be revisited and updated as implementation progresses. Documentation should be written concurrently with Phase 7–9 implementation work, not after everything is "done."*
