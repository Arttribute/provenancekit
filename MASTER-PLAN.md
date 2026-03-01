# ProvenanceKit Master Implementation Plan

## Executive Summary

ProvenanceKit is a universal provenance protocol for Human-AI created works. The goal is a minimal, elegant, and composable system that provides:

- **Attribution tracking** — who created what, and what contributions were made
- **Payment distribution** — fair revenue sharing based on provenance
- **Privacy-preserving proofs** — prove something happened without revealing details
- **Derivative tracking** — follow the chain of works that build on each other

**Design Principles:**
- Keep things simple, minimal, and composable
- EAA types are a pure meta-pattern — no opinions about economics, governance, or domain-specific concerns at the base layer
- Provide strong defaults with flexibility for customisation
- Enable building on top — specific implementations (payments, x402, licensing workflows) are opinionated extension patterns built above the base
- Use established standards where possible (W3C PROV, SPDX, C2PA, etc.)
- On-chain provenance as source of truth; databases are materialised views for efficient querying

---

# PART 0: LEGAL & VISION REQUIREMENTS ANALYSIS

This section documents normative requirements extracted from a doctrinal analysis of applicable legal frameworks and from the original project vision. It provides the evidentiary basis for the phase plan below.

**Scope of legal analysis:** Berne Convention; US Copyright Act (17 U.S.C. §§ 102, 107, 201, 302); EU Directive 2001/29/EC (InfoSoc); EU Directive 2019/790 (DSM); CJEU originality doctrine (*Infopaq*, *Painer*, *Football Dataco*); *Thaler v. Perlmutter* (D.C. Cir. 2025); USCO 2025 Report on Copyrightability and AI; USCO 2024 Report on Digital Replicas; NO FAKES Act (H.R. 9551, 118th Congress); EU AI Act 2024/1689 (Arts. 50, 53; Recitals 105, 107, 108, 133, 134); GDPR 2016/679 (Arts. 9, 17); EU Digital Services Act; *Campbell v. Acuff-Rose* (1994); *Feist Publications v. Rural Telephone* (1991).

> **Note:** A formal structural interoperability evaluation against W3C PROV-O, C2PA specification, SD-JWT RFC 9901, and related technical standards is deferred to a later phase and will inform future interoperability planning.

---

## 0.1 Vision Requirements

| ID | Requirement | Current Status |
|----|-------------|----------------|
| **VIS-1** | EAA types as a **pure, minimal meta-pattern** — no payments, weights, or domain opinions at base | ✅ Done |
| **VIS-2** | **On-chain provenance as source of truth**; databases are materialised views | ⚠️ Contracts exist and are sound; blockchain recording in SDK not wired to contracts |
| **VIS-3** | **Storage-agnostic** — pluggable DB and IPFS backends | ⚠️ Interfaces done; Memory + Postgres adapters work; MongoDB + Supabase are stubs |
| **VIS-4** | **Protocol, not SaaS** — federated nodes, custom chain deployment | ⚠️ Indexer is a stub; no CLI deploy tooling |
| **VIS-5** | **Multi-chain / L2 support** — Base, Arbitrum, Optimism, custom EVM | ⚠️ Chain presets in contracts; no deploy tooling |
| **VIS-6** | **Automatic payment distribution** from provenance graph | ⚠️ Distribution calculator done; payment adapters have test coverage; x402 deferred |
| **VIS-7** | **Git / code provenance** — track commits, diffs, AI vs human | ✅ Done — 71 tests passing |
| **VIS-8** | **C2PA interoperability** | ✅ Done — 157 tests passing |
| **VIS-9** | **Multi-media provenance** — text, image, audio, video, code | ✅ Resource types cover all; media + git packages extend this |
| **VIS-10** | EAA + API + SDK as core; app/ui/openai as examples | ✅ Architecture matches |
| **VIS-11** | **EIP / open standard** proposal | ❌ Not started |
| **VIS-12** | **ISCN compatibility** bridge | ❌ Not started |

---

## 0.2 Legal Requirements — General/Supportive Framing

The legal analysis reveals a consistent set of **capabilities** a provenance system must support to be legally useful. These are stated as system capabilities rather than prescriptive data fields — the goal is for ProvenanceKit to provide the foundation on which developers, legal practitioners, and downstream systems can build legally compliant applications.

| ID | Capability | Legal Basis |
|----|-----------|-------------|
| **CAP-1** | Record **who did what with what inputs and outputs** — the fundamental EAA graph | Copyright authorship; liability attribution |
| **CAP-2** | Record **derivative relationships** — when a work is built from or transforms other works | Derivative work doctrine; fair use analysis |
| **CAP-3** | Record **what AI system was used** in an action, at what autonomy level, producing what output — machine-readable | EU AI Act Art. 50(2), (3); USCO 2025 |
| **CAP-4** | Record that **a model is a resource** produced by a training action that consumed datasets as inputs — natively representable in the EAA graph without special treatment | EU AI Act Art. 53(1)(d) training data disclosure |
| **CAP-5** | Record **license terms** for works, including whether use for AI training is permitted or reserved | DSM Dir. Art. 4(3); EU AI Act Art. 53(1)(c); SPDX/CC |
| **CAP-6** | Record **general-purpose authorisation status** — that a use was or was not authorised, by whom, and under what terms — without being specific to any legal regime | NO FAKES Act § 2(b)(2)(B); GDPR Art. 9 consent |
| **CAP-7** | Support **evidencing human creative input** — a human can record their own authored resource (text, image, prompt document) as an input to an AI action, making the provenance graph evidence of human creative contribution without requiring a dedicated "prompt field" | USCO 2025; *Feist* originality analysis |
| **CAP-8** | Provide **cryptographically tamper-evident records** that can anchor liability and enforce non-repudiation | EU AI Act Art. 50(2); evidentiary reliability |
| **CAP-9** | Support **privacy-preserving selective disclosure** — prove provenance facts without revealing all details | GDPR data minimisation; trade secret protection |
| **CAP-10** | Be **interoperable** with industry provenance standards (C2PA for media, W3C PROV for graph semantics, SPDX for licensing) | EU AI Act Art. 50(2) interoperability requirement |
| **CAP-11** | Provide sufficient **data foundation for enforcement** — content identifiers, timestamps, creation chains, attribution — so that developers and legal practitioners can build takedown notices and enforcement tooling on top | NO FAKES Act § 2(d)(3); DSA platform removal |

**What the system does NOT need to do directly:**
- Capture prompt content in a dedicated field (developers choose how to represent prompts — as text resources, as extension metadata, or not at all)
- Implement DSM Article 4 opt-out workflows (provide the data field; leave the workflow to implementers)
- Build takedown notice generation (provide the data; leave packaging to downstream)
- Store biometric data or identify depicted individuals (keep the system content-focused)
- Enforce GDPR right-to-erasure at the protocol level (the privacy package's encryption and selective disclosure mechanisms provide the tooling; erasure workflows are implementer concerns)

---

## 0.3 Evaluation of Current Codebase Against Requirements

### Rating Scale
- **Excellent** — Fully satisfied with strong implementation and tests
- **Good** — Substantially met with addressable gaps
- **Partial** — Some implementation; significant gaps remain
- **Poor** — Minimal coverage; not purposively designed for this requirement
- **Gap** — No meaningful implementation

| ID | Rating | Notes |
|----|--------|-------|
| **CAP-1** | **Excellent** | Full EAA graph with entity, action, resource, attribution. 227 extension tests, 53 storage tests. |
| **CAP-2** | **Excellent** | Action inputs/outputs create derivative chains. C2PA ingredients track media lineage. |
| **CAP-3** | **Excellent** | `ext:ai@1.0.0` captures provider, model, version, parameters, autonomy level, session. C2PA `aiDisclosure` for media. Machine-readable. |
| **CAP-4** | **Good** | `model` and `dataset` are valid resource types. `transform` action type supports training. `ext:ml:train` documented as the domain-specific action type. Pattern works natively but is undocumented. |
| **CAP-5** | **Good** | `ext:license@1.0.0` with SPDX and CC presets, commercial terms, attribution requirements. **Gap:** no field for AI training opt-out/opt-in status. |
| **CAP-6** | **Gap** | No general-purpose authorisation extension. Authorisation status — was this use permitted, by whom, on what basis — is not recordable in a structured way. |
| **CAP-7** | **Good** | The EAA graph fully supports recording human-authored resources as action inputs. **Gap:** this pattern is undocumented; developers have no guidance on how to use it for copyright evidencing. |
| **CAP-8** | **Good** | Blockchain anchoring (`ext:onchain@1.0.0`), cryptographic content addressing (IPFS CIDs), OpenZeppelin ECDSA in contracts. **Gap:** blockchain recording in the SDK is not wired to the contracts; indexer is a stub. |
| **CAP-9** | **Excellent** | SD-JWT-like selective disclosure, Pedersen commitments, Lit Protocol access conditions, encrypted IPFS/Arweave storage. 187 tests. |
| **CAP-10** | **Good** | C2PA integration (157 tests), W3C PROV alignment in EAA types, SPDX license identifiers. **Gap:** formal interoperability evaluation against technical standards deferred. |
| **CAP-11** | **Good** | Full event graph with timestamps, blockchain anchoring, chain-of-custody reconstruction. **Gap:** authorisation status (CAP-6) is missing, which limits enforcement data completeness. |

---

## 0.4 Summary: What Has Been Done Well, What Needs Work

### Excellent
- EAA type system as a pure, extensible meta-pattern
- Extension architecture (`ext:namespace@version`) — legally sound, technically flexible
- Privacy primitives — selective disclosure, commitments, encryption (best-in-class)
- C2PA media integration — direct compliance with EU AI Act Art. 50 for media content
- AI tool/output tracking — `ext:ai@1.0.0` is comprehensive and machine-readable
- Smart contracts — clean architecture, 27/27 tests passing, OpenZeppelin ECDSA, no P0 bugs

### Good (Addressable Gaps)
- License extension — needs AI training opt-out field
- Model/training provenance pattern — supported but undocumented
- Human creative input pattern — supported but undocumented
- Storage adapters — Memory + Postgres work; MongoDB + Supabase are stubs

### Gaps (Priority Work)
- **No authorisation extension** (`ext:authorization@1.0.0`) — the single most actionable legal gap
- **Blockchain recording not wired in SDK** — the protocol's core value proposition is incomplete
- **Indexer is a stub** — on-chain/off-chain sync doesn't work
- **MongoDB and Supabase adapters are stubs** — significantly limits storage flexibility
- **No DB schema/migration story** — adapters assume tables exist
- **No multi-chain deploy tooling** — VIS-4, VIS-5 not achievable yet
- **No EIP / protocol standardisation** — VIS-11

---

# PART 1: EXTENSION LAYER

## Package 1: @provenancekit/extensions ✅ COMPLETE
**Status:** Implemented and tested (227 tests passing)

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
| **Proof** | `ext:proof@1.0.0` | Action | Cryptographic proof references |
| **Identity** | `ext:identity@1.0.0` | Entity | Identity proof metadata |
| **Witness** | `ext:witness@1.0.0` | Action | Server witness attestation |
| **Tool Attestation** | `ext:tool-attestation@1.0.0` | Action | AI tool receipt/attestation levels |
| **Verification** | `ext:verification@1.0.0` | Action, Resource | Claim verification status tracking |
| **Ownership Claim** | `ext:ownership:claim@1.0.0` | Resource | On-chain ownership claim evidence |
| **Ownership Transfer** | `ext:ownership:transfer@1.0.0` | Resource | Ownership transfer records |

### 1.2 Key Features

**Distribution Calculator:**
- Mathematically fair allocation using Largest Remainder Method (Hamilton's method)
- Handles dust/remainders explicitly for caller control
- Supports resource-level and action-level distributions
- Merge multiple distributions, normalise contributions
- Full validation with detailed error types
- 51 tests passing

**AI Extension (Dual-Mode Design):**
- **AI as Tool**: When human uses AI to accomplish a task (attached to Action)
- **AI as Agent**: When AI operates autonomously (attached to Entity with role: "ai")
- Supports multi-agent systems with collaborators, session tracking, autonomy levels

**Generic Utilities:**
- `withExtension()`, `getExtension()`, `hasExtension()` for custom extensions
- `copyExtensions()`, `withoutExtension()` for manipulation
- `isValidNamespace()` for validation

### 1.3 Known Patterns for Documentation (Phase 10)
The following patterns are supported by the type system but need explicit documentation:
- **Model-as-resource**: A model is a resource (type: `model`); training is an action (type: `transform` or `ext:ml:train`); datasets are resources (type: `dataset`). The training action records dataset CIDs as inputs and model CID as output. This is the natural EAA representation of AI model provenance.
- **Human-input-as-resource**: A human records their authored text, image, or other content as a resource and includes its CID as an input to an AI action. The provenance graph then evidences human creative contribution for copyright analysis — no dedicated "prompt field" needed.

---

## Package 2: @provenancekit/payments ✅ COMPLETE
**Status:** Implemented with 3 adapters (Direct, 0xSplits, Superfluid) — 43 tests passing

**Purpose:** Payment distribution based on provenance data.

### 2.1 Implemented Adapters

| Adapter | Purpose | Model | Chains |
|---------|---------|-------|--------|
| **DirectTransferAdapter** | One-time ETH/ERC-20 transfers | one-time | All EVM |
| **SplitsAdapter** | 0xSplits automatic revenue splitting | split-contract | ETH, Polygon, Arbitrum, Optimism, Base, Gnosis |
| **SuperfluidAdapter** | Real-time token streaming | streaming | ETH, Polygon, Arbitrum, Optimism, Base, Avalanche, BSC, Gnosis |

**Note:** x402 adapter deferred for API layer integration.

### 2.2 Core Interface
```typescript
interface IPaymentAdapter {
  readonly name: string;
  readonly description: string;
  readonly supportedChains: number[];
  readonly model: PaymentModel;

  distribute(params: DistributeParams): Promise<PaymentResult>;
  estimateFees?(params: DistributeParams): Promise<FeeEstimate>;
  supportsToken?(token: Address, chainId: number): Promise<boolean>;
}
```

---

## Package 3: @provenancekit/privacy ✅ CORE COMPLETE
**Status:** Phases 1-5 implemented (187 tests passing); Phase 6 (ZK proofs) optional/advanced

### 3.1 Implemented Features

**Phase 1: Encryption Primitives ✅**
- AES-256-GCM symmetric encryption
- PBKDF2 key derivation from passwords
- HKDF key derivation from wallet signatures
- `IEncryptionProvider` interface; `KeyRing` implementation

**Phase 2: Encrypted File Storage ✅**
- `EncryptedFileStorage` wrapper for any `IFileStorage` backend
- Encrypt-before-upload, decrypt-after-download
- Encryption metadata in `ext:storage@1.0.0`

**Phase 3: Access Control ✅**
- Access condition types (ERC20, ERC721, ERC1155, SIWE)
- Lit Protocol format conversion (`toLitCondition`, `toLitUnifiedConditions`)
- `IAccessControlProvider` interface for pluggable backends

**Phase 4: Selective Disclosure ✅**
- SD-JWT-like selective disclosure for provenance claims
- `createSelectiveDisclosure`, `createPresentation`, `verifyPresentation`
- Expiration support for time-limited access proofs

**Phase 5: Commitment Schemes ✅**
- Pedersen commitments using secp256k1 curve
- Homomorphic operations (`addCommitments`, `subtractCommitments`, `sumCommitments`)
- Contribution weight helpers (`commitContributionWeights`, `verifyWeightSum`)
- Contract integration (`commitmentToBytes`, `commitmentHash`)

**Phase 6: ZK Proofs 📋 OPTIONAL**
- Circom circuits for contribution sum proofs
- Proof generation in browser via snarkjs
- On-chain Groth16/PLONK verifier contracts

---

## Package 4: @provenancekit/git ✅ COMPLETE
**Status:** Implemented and tested (71 tests passing)

### 4.1 Implemented
- Git blame analysis with contribution weight calculation
- AI co-author detection (Copilot, Claude, ChatGPT, Cursor, Aider patterns)
- Commit tracking with metadata (SHA, branch, message, stats)
- GitHub integration via @octokit/rest (PRs, reviews, commits)
- `ext:git@1.0.0` extension schema
- Git hook generators for post-commit provenance recording

---

## Package 5: @provenancekit/media ✅ COMPLETE
**Status:** Implemented and tested (157 tests passing)

### 5.1 Implemented
- Read C2PA manifests from images/videos (graceful degradation without native c2pa-node)
- Write C2PA manifests with X.509 certificate signing
- Bidirectional C2PA ↔ EAA type conversion
- AI disclosure detection (`aiDisclosure.isAIGenerated`, `aiTool` fields)
- `ext:c2pa@1.0.0` extension schema
- Supported formats: JPEG, PNG, HEIC, HEIF, AVIF, WebP, MP4, MOV, MP3, M4A, PDF

---

# PART 2: BASE LAYER

## @provenancekit/eaa-types ✅ COMPLETE
**Package scope:** Renamed from `@arttribute/eaa-types` → `@provenancekit/eaa-types` (2026-02-24). All workspace packages and imports updated.
**Status:** v0.0.2; fully implemented (TypeScript compile-time validated)

**Core Types:**
- Entity (human, ai, organization) with extensible roles
- Action (create, transform, aggregate, verify) with extensible types
- Resource (text, image, audio, video, code, dataset, model, other) with extensible types
- Attribution (creator, contributor, source) with extensible roles
- ProvenanceBundle (full graph container)
- ContentReference (cid, ar, http, hash schemes)
- ExtensionRegistry for managing `ext:namespace@version` extensions

**Domain-specific action types (via extensions, not core):**
- `ext:ml:train` — machine learning training (dataset → model)
- `ext:code:commit` — code commit
- `ext:media:remix` — media remix

**Key design:** Attribution can target either a `resourceRef` OR an `actionId` — supporting both resource-level credit and action-level contribution recording.

---

## @provenancekit/contracts ✅ COMPLETE
**Status:** v0.0.1; 27/27 tests passing (Foundry/Forge)

**Architecture:** ProvenanceCore → ProvenanceVerifiable → ProvenanceRegistry

**ProvenanceCore:**
- Abstract base with `recordAction()` (event-driven, minimal on-chain storage)
- Before/after hooks for customisation
- `_generateActionId()` includes chainId for cross-chain uniqueness

**ProvenanceVerifiable:**
- Extends core with cryptographic proof capabilities
- `recordActionWithProof()` — ECDSA signature verification via OpenZeppelin (malleability-safe)
- `recordActionWithCommitment()` — hash commitment for ZK-friendly delayed reveal
- `revealCommitment()` — verifies reveal matches commitment

**ProvenanceRegistry:**
- Full reference implementation: entities, resources, attributions, ownership
- `registerEntity()`, `registerResource()`, `recordAttribution()`, `recordAttributionFor()` (protected: only resource creator)
- `recordActionAttribution()`, `recordActionAttributionFor()` (requires registered entity)
- `recordOwnershipClaim()`, `transferOwnership()`
- `recordActionAndRegisterOutputs()` — gas-efficient convenience function

**Design note on `recordAttribution()`:** Any address can self-attribute to any CID — this is intentional permissive self-attestation. Trust is conveyed by the off-chain provenance graph, not enforced on-chain. This is a documented design choice.

---

## @provenancekit/storage ✅ INTERFACES COMPLETE / ⚠️ ADAPTERS PARTIAL
**Status:** v0.0.1; 53/53 tests passing (Memory adapters only)

**Interfaces (complete):**
- `IProvenanceStorage` — full CRUD for entities, actions, resources, attributions, sessions, embeddings
- `IFileStorage` — upload, download, content-addressed storage
- `IVectorStorage` — vector embeddings for semantic search
- `ITransactionalStorage` — transaction semantics (interface)
- `ISyncableStorage`, `ISubscribableStorage` — sync and event subscription

**Adapters — actual status:**

| Adapter | Status | Notes |
|---------|--------|-------|
| MemoryDbStorage | ✅ Complete | Full implementation, 25 tests |
| PostgresStorage | ✅ Substantially complete | Direct pg client |
| MongoDbStorage | ⚠️ Stub | Imports only, no implementation |
| SupabaseStorage | ⚠️ Stub | Imports only, no implementation |
| MemoryFileStorage | ✅ Complete | 28 tests |
| PinataStorage | ✅ Complete | IPFS via Pinata |
| InfuraStorage | ✅ Complete | IPFS via Infura |
| LocalIPFSStorage | ✅ Complete | Local IPFS node |
| Web3StorageAdapter | ✅ Complete | Web3.Storage |
| ArweaveStorage | ✅ Complete | Arweave permanent storage |

**Missing:** No `initialize()` / schema creation on DB adapters — they assume tables exist.

---

## @provenancekit/indexer ⚠️ STUB
**Status:** Interfaces defined; no implementation

**Exists:**
- Type definitions for blockchain events
- `IIndexer` interface
- Package structure and dependencies

**Missing:**
- Event listener implementation
- Historical sync (past blocks)
- Real-time watching (new blocks)
- Retry logic
- Any tests

**Impact:** Without the indexer, on-chain/off-chain sync does not work. The blockchain is the source of truth but cannot populate the storage layer.

---

# PART 3: PLATFORM LAYER

## provenancekit-api ✅ SUBSTANTIALLY COMPLETE
**Status:** Running; no test suite

**Framework:** Hono + @hono/node-server
**Storage:** Configurable (Supabase/Postgres default)
**Files:** Pinata IPFS

**Implemented Routes:**
- `GET /` — Health check
- `POST /entity`, `GET /entity/:id` — Entity management
- `POST /action`, `GET /action/:id` — Action recording
- `POST /resource`, `GET /resource/:cid` — Resource management
- `POST /attribution`, `GET /attributions/:resourceCid` — Attribution management
- `GET /distribution/:cid`, `POST /distribution/preview` — Payment distribution
- `GET /resource/:cid/ownership`, `POST /resource/:cid/ownership/claim`, `POST /resource/:cid/ownership/transfer` — Ownership
- `POST /media/extract-c2pa`, `POST /media/embed-provenance` — C2PA media
- `GET /search`, `POST /similar` — Vector similarity search
- `POST /bundle`, `GET /graph/:resourceCid` — Provenance graph
- `GET /session/:sessionId` — Session bundles
- `POST /activity` — Full upload-with-provenance convenience endpoint

**Auth:** API key middleware (`Authorization: Bearer <key>`) with pluggable auth provider interface. Dev mode (no keys configured) passes all requests.

**Key service — activity.service.ts:**
- Validates entity, action, resource
- Uploads file to IPFS (optionally encrypted — key returned in response)
- Generates vector embeddings for semantic search
- Checks exact and near-duplicates
- Creates EAA records with full extension pipeline
- Optional blockchain recording via `BLOCKCHAIN_*` env vars

**Missing:**
- No API test suite
- No rate limiting (placeholder only)
- No OpenAPI documentation
- Blockchain recording not deeply tested end-to-end

---

## @provenancekit/sdk ⚠️ PARTIAL
**Status:** v0.1.0; 25/25 tests passing (signing + vector crypto only)

**Implemented:**
- HTTP client methods for all API endpoints
- Ed25519 and ECDSA-secp256k1 signing utilities
- Encrypted vector/embedding operations (for encrypted similarity search)
- Bundle signing and verification
- Action proof generation and verification
- Server witness attestation

**Not implemented:**
- Direct blockchain recording (SDK calls the API, which may or may not record on-chain depending on API config)
- Direct contract interaction without going through the API

**Legacy fields to clean up (P2):**
- `entity.wallet` — not part of EAA types
- `file()` accepts `dedup` parameter never sent to API
- `tool()` method uses removed `resourceType: "tool"`

---

## provenancekit-app ⚠️ DEMO GRADE
**Status:** Next.js 15 app; functional demo; not production-ready; no tests

**Implements:**
- Chat with OpenAI (GPT-4) with provenance tracking
- DALL-E image generation with C2PA embedding
- Image editing with attribution
- Text-to-Speech and Speech-to-Text with provenance
- Privy authentication
- ReactFlow graph visualisation

**This is an example/demo application** showing end-to-end provenance in an AI assistant. It is not the primary deliverable — it illustrates how developers use the SDK and extensions.

---

## @provenancekit/ui ✅ COMPLETE
**Status:** Full component library — 42 source files, builds clean (CJS + ESM + type declarations). See `PLAN-UI.md` for full implementation detail.

**Framework:** React 19 + Tailwind CSS v4 + Radix UI primitives + tsup
**Build output:** `dist/index.{js,mjs,d.ts}` + `dist/styles.css` (41 KB)

**Component Surface (public exports):**

| Group | Components |
|-------|-----------|
| **Primitives** | `EntityAvatar`, `RoleBadge`, `VerificationIndicator`, `LicenseChip`, `Timestamp`, `CidDisplay`, `ContributionBar` |
| **Badge** | `ProvenanceBadge`, `ProvenancePopover` |
| **Bundle** | `ProvenanceBundleView`, `ActionCard`, `EntityCard`, `ResourceCard`, `AttributionList` |
| **Graph** | `ProvenanceGraph`, `GraphCanvas`, `GraphNode`, `GraphEdge`, `GraphControls`, `GraphLegend` |
| **Extensions** | `AIExtensionView`, `LicenseExtensionView`, `OnchainExtensionView`, `VerificationView`, `ContribExtensionView` |
| **Tracker** | `ProvenanceTracker`, `TrackerActionItem`, `TrackerSessionHeader` |
| **Search** | `ProvenanceSearch`, `SearchResultCard`, `FileUploadZone` |
| **Context / Hooks** | `ProvenanceKitProvider`, `useProvenanceGraph`, `useProvenanceBundle`, `useSessionProvenance`, `useDistribution` |

**Design token system:** `--pk-*` CSS custom properties; light + dark mode via `@media (prefers-color-scheme: dark)`; override with `.dark` class selector.

**Missing (next steps):**
- No Storybook / visual tests
- No unit tests (component logic untested)
- No Storybook stories for docs site

---

## provenancekit-openai — DOES NOT EXIST
The master plan previously referenced this package. It does not exist as a separate package. OpenAI integration lives in `apps/provenancekit-app` directly. If a shared helper package is needed, it should be created at `packages/provenancekit-openai` but this is low priority.

---

# PART 4: TEST COVERAGE SUMMARY

| Package | Tests | Status |
|---------|-------|--------|
| @provenancekit/eaa-types | TypeScript compile-time | ✅ |
| @provenancekit/contracts | 27/27 (Forge) | ✅ |
| @provenancekit/storage | 53/53 (Memory only) | ✅ |
| @provenancekit/extensions | 227/227 | ✅ |
| @provenancekit/privacy | 187/187 | ✅ |
| @provenancekit/payments | 43/43 | ✅ |
| @provenancekit/git | 71/71 | ✅ |
| @provenancekit/media | 157/157 | ✅ |
| @provenancekit/sdk | 25/25 | ✅ |
| @provenancekit/indexer | 0 | ⚠️ Stub |
| @provenancekit/ui | N/A (UI components) | ⚠️ 0 tests; component logic untested |
| provenancekit-api | 0 | ⚠️ No tests |
| provenancekit-app | 0 | ⚠️ Demo |
| **Total (tested packages)** | **790/790** | **✅ 100%** |

---

# PART 5: REVISED PHASE PLAN

## Phase 6: Bug Fixes & Hardening — ✅ COMPLETE

All previously identified P0 and P1 bugs have been resolved in the current codebase:

| Item | Was | Now |
|------|-----|-----|
| External self-call in ProvenanceRegistry | `this.recordAction()` bug | ✅ Fixed: internal call at line 357 |
| Unprotected `recordAttributionFor()` | Anyone could fabricate attributions | ✅ Fixed: resource creator check at line 276 |
| Encryption key discarded | Key generated but never returned | ✅ Fixed: returned as base64 in ActivityResult |
| Hand-rolled ECDSA | No malleability protection | ✅ Fixed: OpenZeppelin ECDSA.recover() |
| Storage abstraction bypasses | 3 API paths queried DB directly | ✅ Fixed: all go through IProvenanceStorage |
| No API authentication | Zero auth | ✅ Fixed: pluggable auth middleware with API key support |
| Extension keys not namespaced | bare `sessionId` / `projectId` | ✅ Fixed: `ext:session@1.0.0` used |

**Remaining design note (not a bug):** `recordAttribution()` allows any address to self-attribute to any CID. This is intentional — self-attestation is permissive by design; trust is established in the off-chain provenance graph.

---

## Phase 7: Legal Compliance Extensions

This phase adds the extension and documentation work required to satisfy the capability requirements identified in Part 0. All additions follow the project's "supportive, not prescriptive" principle — they provide the data structures developers need; they do not mandate specific workflows.

### 7.1 `ext:authorization@1.0.0` — General-Purpose Authorisation Record

**Gap addressed:** CAP-6 (currently rated Gap)

A single, general-purpose extension for recording whether a use was authorised and on what basis. This intentionally avoids specificity about the type of authorisation (copyright licence, consent, editorial approval, etc.) so that developers can apply it to any scenario.

```typescript
// ext:authorization@1.0.0
// Attaches to: Action, Resource
interface AuthorizationExtension {
  // Was this use explicitly authorised?
  status: "authorized" | "unauthorized" | "pending" | "revoked";

  // Who authorised it (entity ID or address)
  authorizedBy?: string;

  // When was authorisation granted (ISO 8601)
  authorizedAt?: string;

  // When does it expire (ISO 8601)
  expiresAt?: string;

  // Free-form reference to the authorisation instrument
  // e.g. licence agreement ID, consent form reference, contract hash
  reference?: string;

  // Human-readable scope description
  scope?: string;

  // Cryptographic proof of authorisation (signature, on-chain tx hash, etc.)
  proof?: string;
}
```

**Implementation tasks:**
- [ ] Add Zod schema to `packages/provenancekit-extensions/src/authorization.ts`
- [ ] Add `withAuthorization()`, `getAuthorization()`, `hasAuthorization()` helpers
- [ ] Export from `packages/provenancekit-extensions/src/index.ts`
- [ ] Write tests (target: ~20 tests)

### 7.2 `ext:license@1.0.0` Enhancement — AI Training Opt-Out

**Gap addressed:** CAP-5 (currently rated Good, minor gap)

Add a single field to the existing license extension to record whether AI training use is permitted or reserved. This supports DSM Article 4(3) machine-readable rights reservation and EU AI Act Article 53(1)(c) without prescribing a specific compliance workflow.

```typescript
// Addition to ext:license@1.0.0
{
  // ... existing fields ...

  // Whether use of this work for AI training is permitted
  // "permitted" — use for AI training is allowed under this licence
  // "reserved"  — right holder reserves this right (DSM Art. 4(3) opt-out)
  // "unspecified" — no explicit position (default)
  aiTraining?: "permitted" | "reserved" | "unspecified";
}
```

**Implementation tasks:**
- [ ] Add `aiTraining` field to the Zod schema in `packages/provenancekit-extensions/src/license.ts`
- [ ] Add helper: `hasAITrainingReservation(resource)` — returns true if `aiTraining === "reserved"`
- [ ] Update existing license preset helpers (CC0 etc.) with sensible defaults where applicable
- [ ] Add tests for new field

### 7.3 Documentation: Provenance Patterns for Legal Use Cases

**Gap addressed:** CAP-4 (model/training undocumented), CAP-7 (human input pattern undocumented)

Create `docs/patterns/` with the following pattern documents:

**Pattern: Model Training Provenance**
```
Dataset (resource: type="dataset")
  → Training Action (type="transform" or "ext:ml:train")
  → Model (resource: type="model")

Attribution on the Action records who performed the training.
ext:ai@1.0.0 on the Action records the training infrastructure used.
ext:license@1.0.0 on the Dataset records training data permissions.
```

**Pattern: Human Creative Input Evidencing**
```
Human creates authored text/image/other content
  → Records it as a Resource (type="text"|"image"|etc.)
  → Uses it as an input CID in an AI Action
  → The AI Action produces an output Resource

The provenance graph now shows:
  - Human-authored resource as input
  - AI system used
  - Output produced from both

For copyright analysis: the human's authored input, the degree of creative
control exercised (further modification of AI output), and the overall
workflow are all evidenced in the provenance graph.
```

**Implementation tasks:**
- [ ] Create `docs/patterns/model-training-provenance.md`
- [ ] Create `docs/patterns/human-creative-input.md`
- [ ] Create `docs/patterns/authorization-and-consent.md`
- [ ] Update README with links to patterns

---

## Phase 8: Core Infrastructure Gaps

These items address the incomplete parts of the base and platform layers.

### 8.1 Complete MongoDB and Supabase Storage Adapters

**Currently:** Both adapters are stubs (imports only)

**Tasks:**
- [ ] Implement `MongoDbStorage` fully (mirror MemoryDbStorage structure against MongoDB Atlas client)
- [ ] Implement `SupabaseStorage` fully (use Supabase JS client with pgvector for vectors)
- [ ] Add tests for both adapters (target: similar coverage to Postgres adapter)
- [ ] Document which adapters support `IVectorStorage` (vector search requires pgvector or MongoDB Atlas Vector Search)

### 8.2 DB Schema / Migration Story

**Currently:** All adapters assume tables/collections already exist

**Tasks:**
- [ ] Add `initialize()` method to `IProvenanceStorage` interface (optional, schema-creation semantics)
- [ ] Implement `initialize()` in each DB adapter (SQL DDL for Postgres/Supabase, collection setup for MongoDB)
- [ ] Provide SQL migration files for PostgreSQL schema as reference
- [ ] Document schema expectations clearly in each adapter's README

### 8.3 Real Transaction Semantics

**Currently:** `ITransactionalStorage.transaction()` runs the function directly with no rollback

**Tasks:**
- [ ] Either implement real `BEGIN/COMMIT/ROLLBACK` in PostgreSQL adapter using a pg client transaction
- [ ] Or remove `ITransactionalStorage` from the Postgres/Supabase adapter's `implements` list and document the limitation clearly
- [ ] Do not claim transaction support that doesn't exist

### 8.4 Implement the Blockchain Indexer

**Currently:** Stub — interfaces defined, no implementation

**Tasks:**
- [ ] Implement historical sync: read past `ActionRecorded`, `ResourceRegistered`, `AttributionRecorded`, `OwnershipTransferred` events from contract deployment block
- [ ] Implement real-time watching: subscribe to new events via WebSocket RPC
- [ ] Transform events into EAA types and write to storage via `IProvenanceStorage`
- [ ] Automatically attach `ext:onchain@1.0.0` to transformed events
- [ ] Add retry logic with exponential backoff for RPC failures
- [ ] Write tests using a local Anvil fork
- [ ] Document supported chain presets

### 8.5 Wire Blockchain Recording in the SDK

**Currently:** SDK calls the API; the API optionally records on-chain via env vars. SDK has no direct contract interaction.

**Tasks:**
- [ ] Add optional `blockchainRecorder` to SDK constructor
- [ ] When configured, SDK calls contract directly after recording to the API
- [ ] Or: ensure the API's blockchain recording path is well-tested and documented as the intended path
- [ ] Document the two modes: API-mediated recording vs. direct SDK-to-contract recording

### 8.6 SDK Legacy Field Cleanup

- [ ] Remove `entity.wallet` field (not part of EAA types)
- [ ] Remove `dedup` parameter from `file()` (never sent to API)
- [ ] Fix or remove `tool()` method (uses removed `resourceType: "tool"`)

---

## Phase 9: Testing & Quality

### 9.1 API Integration Tests
- [ ] Write integration tests for all API routes using a test database (Memory adapter)
- [ ] Test auth middleware (with and without keys)
- [ ] Test error cases and error response format
- [ ] Test activity service end-to-end (upload → records → bundle)

### 9.2 Testnet Integration Tests for Contracts
- [ ] Deploy ProvenanceRegistry to Base Sepolia
- [ ] Write integration tests against live testnet
- [ ] Test with Indexer to verify sync

### 9.3 Payment Adapter Testnet Tests
- [ ] Test DirectTransferAdapter on Base Sepolia
- [ ] Test with native ETH and ERC-20 tokens
- [ ] Test edge cases: zero amounts, single recipient, max recipients

### 9.4 Error Handling Standardisation
- [ ] Standardise all API error responses to use `ProvenanceKitError`
- [ ] Ensure all handlers have consistent try/catch patterns

---

## Phase 10: Production Readiness

### 10.1 OpenAPI Documentation
- [ ] Add `@hono/zod-openapi` for auto-generated API documentation
- [ ] Document all endpoints with request/response schemas
- [ ] Publish at `/docs` endpoint

### 10.2 Package Publishing Setup
- [ ] Add `publishConfig` to each package's `package.json`
- [ ] Set up changesets for versioning in monorepo
- [ ] CI/CD for automated publishing on merge to main

### 10.3 Multi-chain Deployment Tooling
- [ ] CLI deploy script: `npx provenancekit deploy --chain base --rpc <url> --key <pk>`
- [ ] Deployment registry: track deployed contract addresses per chain
- [ ] Chain configuration helper in SDK for common networks (Base, Arbitrum, Optimism, Polygon, Ethereum)

### 10.4 x402 Adapter
- [ ] Implement x402 payment middleware for API
- [ ] Wire x402 with distribution calculator: incoming payment → split to contributors
- [ ] Document x402 integration pattern

### 10.5 Remove or Create provenancekit-openai
- [ ] Decide: remove the reference from documentation, or create as a proper shared helper package
- [ ] If creating: implement `recordChatCompletion()`, `recordImageGeneration()`, etc. as thin EAA wrappers over OpenAI SDK calls

---

## Phase 11: Protocol Standardisation

### 11.1 EIP Proposal
- [ ] Draft EIP proposing the provenance event schema as an Ethereum standard
- [ ] Define: `ActionRecorded`, `ResourceRegistered`, `AttributionRecorded` event signatures
- [ ] Define: minimal `IProvenanceProvider` interface as the standard interface
- [ ] Submit as EIP draft and engage community feedback

### 11.2 ISCN Compatibility Bridge
- [ ] Implement bidirectional conversion: ProvenanceBundle ↔ ISCN record
- [ ] Enable export of provenance data to LikeCoin's blockchain-native content registry
- [ ] Useful for publishers and media organisations already using ISCN

### 11.3 EU Code of Practice Alignment
- [ ] Monitor EU Code of Practice on AI content marking (expected mid-2026)
- [ ] When published, evaluate alignment of `ext:ai@1.0.0` and `ext:c2pa@1.0.0` against the technical standards
- [ ] Update extensions as needed to maintain interoperability

---

## Phase 12: Platform Layer (provenancekit-app)

The app is currently a demo. Production readiness requires:
- [ ] Replace demo OpenAI calls with proper SDK integration through provenancekit-api
- [ ] Real user management (currently Privy auth is present but not deeply integrated)
- [ ] Error handling and recovery
- [ ] Performance testing
- [ ] Deployment configuration (Docker, cloud)

---

# PART 6: EXTERNAL DEPENDENCIES

## NPM Dependencies (Current)

| Package | Key Deps |
|---------|----------|
| @provenancekit/payments | @superfluid-finance/sdk-core, @0xsplits/splits-sdk, viem |
| @provenancekit/privacy | @noble/ciphers, @noble/curves, @noble/hashes (all 6x audited by Cure53) |
| @provenancekit/git | simple-git, @octokit/rest |
| @provenancekit/media | @contentauth/c2pa-node (optional peer dep), zod |
| @provenancekit/sdk | @noble/ed25519 |

## External Services

| Service | Purpose | Required? |
|---------|---------|-----------|
| RPC Provider (Alchemy/Infura) | Blockchain access | Yes (for chain features) |
| Pinata / web3.storage / Infura | IPFS pinning | Yes (for file storage) |
| PostgreSQL | Database | Yes (for persistence) |
| Superfluid | Payment streaming | No (optional adapter) |
| Lit Protocol | Token-gated decryption | No (optional) |

---

*Last updated: 2026-03-01. This document reflects the actual current state of the codebase as of this date.*
