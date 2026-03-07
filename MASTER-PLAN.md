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
| **VIS-2** | **On-chain provenance as source of truth**; databases are materialised views | ✅ SDK `IChainAdapter` + `createViemAdapter`; `file()` records on-chain when adapter set; indexer syncs chain → storage |
| **VIS-3** | **Storage-agnostic** — pluggable DB and IPFS backends | ✅ Memory + Postgres + MongoDB + Supabase (all implemented); 6 IPFS adapters (Pinata, Infura, Web3.Storage, Arweave, LocalIPFS, Memory) |
| **VIS-4** | **Protocol, not SaaS** — federated nodes, custom chain deployment | ⚠️ Indexer implemented (66 tests); no CLI deploy tooling yet |
| **VIS-5** | **Multi-chain / L2 support** — Base, Arbitrum, Optimism, custom EVM | ⚠️ Chain presets in contracts; no deploy tooling |
| **VIS-6** | **Automatic payment distribution** from provenance graph | ✅ Distribution calculator + payment adapters + `ext:x402@1.0.0` (53 tests); API integration pending |
| **VIS-7** | **Git / code provenance** — track commits, diffs, AI vs human | ✅ Done — 71 tests passing |
| **VIS-8** | **C2PA interoperability** | ✅ Done — 157 tests passing |
| **VIS-9** | **Multi-media provenance** — text, image, audio, video, code | ✅ Resource types cover all; media + git packages extend this |
| **VIS-10** | EAA + API + SDK as core; app/ui/examples as platform | ✅ Architecture matches. Two full examples (chat + canvas) |
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
| **CAP-1** | **Excellent** | Full EAA graph with entity, action, resource, attribution. 377 extension tests, 93 storage tests. |
| **CAP-2** | **Excellent** | Action inputs/outputs create derivative chains. C2PA ingredients track media lineage. canvas example shows remix provenance in practice. |
| **CAP-3** | **Excellent** | `ext:ai@1.0.0` captures provider, model, version, parameters, autonomy level, session. C2PA `aiDisclosure` for media. Machine-readable. |
| **CAP-4** | **Good** | `model` and `dataset` are valid resource types. `transform` action type supports training. `ext:ml:train` documented as the domain-specific action type. Pattern works natively but is undocumented. |
| **CAP-5** | **Excellent** | `ext:license@1.0.0` with SPDX and CC presets, commercial terms, attribution requirements. AI training opt-out field (`aiTraining`) + `hasAITrainingReservation()` added. |
| **CAP-6** | **Good** | `ext:authorization@1.0.0` added — general-purpose authorisation status (pending/authorized/revoked) with delegatedBy, scope, conditions, expiresAt. 44 tests. |
| **CAP-7** | **Good** | The EAA graph fully supports recording human-authored resources as action inputs. **Gap:** this pattern is undocumented; developers have no guidance on how to use it for copyright evidencing. |
| **CAP-8** | **Excellent** | Blockchain anchoring (`ext:onchain@1.0.0`), cryptographic content addressing (IPFS CIDs), OpenZeppelin ECDSA in contracts. Indexer (66 tests). SDK `IChainAdapter` + `createViemAdapter` (13 tests) — `file()` records on-chain when adapter configured. |
| **CAP-9** | **Excellent** | SD-JWT-like selective disclosure, Pedersen commitments, Lit Protocol access conditions, encrypted IPFS/Arweave storage. 187 tests. |
| **CAP-10** | **Good** | C2PA integration (157 tests), W3C PROV alignment in EAA types, SPDX license identifiers. **Gap:** formal interoperability evaluation against technical standards deferred. |
| **CAP-11** | **Good** | Full event graph with timestamps, blockchain anchoring, chain-of-custody reconstruction. Auth extension enables enforcement data completeness. |

---

## 0.4 Honest Assessment: What Has Been Done Well, What Needs Work

### Excellent
- EAA type system as a pure, extensible meta-pattern
- Extension architecture (`ext:namespace@version`) — legally sound, technically flexible, 15 extensions all tested
- Privacy primitives — selective disclosure, commitments, encryption (best-in-class; @noble audited cryptography)
- C2PA media integration — direct compliance with EU AI Act Art. 50 for media content
- AI tool/output tracking — `ext:ai@1.0.0` is comprehensive and machine-readable
- Smart contracts — clean architecture, 27/27 tests passing, OpenZeppelin ECDSA, no P0 bugs
- Storage layer — ALL four DB adapters fully implemented (memory 436L, postgres 950L, mongodb 559L, supabase 1142L); 6 IPFS adapters
- Release pipeline — changesets + auto-patch + CI; all packages have `publishConfig`; infrastructure ready for npm
- Example applications — chat and canvas are real, complete, production-grade apps with good READMEs

### Good (Addressable Gaps)
- API test coverage — 31 integration tests cover provenance routes; management endpoints, auth edge cases, error consistency are untested
- Documentation — started well (quickstart, architecture, guides, contracts, api-reference) but missing payments, privacy, git, media, patterns, SDK reference, UI reference, self-hosting guide
- provenancekit-app — full production dashboard but 0 tests

### Gaps (Priority Work)
- **No OpenAPI spec** — API reference is a markdown table; no machine-readable schema (Phase C.1)
- **Packages published to npm** ✅ — all 11 packages live; CI/CD auto-publishes on push to main
- **No multi-chain deploy CLI** — VIS-4, VIS-5 not achievable without manual Foundry usage
- **API rate limiting** ✅ — implemented (sliding window, configurable, HTTP 429)
- **No EIP / protocol standardisation** — VIS-11
- **No UI tests / Storybook** — component library untested

---

# PART 1: EXTENSION LAYER

## Package 1: @provenancekit/extensions ✅ COMPLETE
**Status:** Implemented and tested (377 tests passing)

### 1.1 Implemented Extensions

| Extension | Namespace | Attaches To | Purpose |
|-----------|-----------|-------------|---------|
| **Contrib** | `ext:contrib@1.0.0` | Attribution | Track contribution weights for revenue distribution |
| **License** | `ext:license@1.0.0` | Resource, Attribution | Specify usage rights (SPDX identifiers, CC licenses, aiTraining opt-out) |
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
| **x402** | `ext:x402@1.0.0` | Resource, Action, Attribution | HTTP 402 payment requirements, proof, and revenue splits |
| **Authorization** | `ext:authorization@1.0.0` | Action, Resource | General-purpose authorisation status (authorized/revoked/pending) |

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

### 1.3 Undocumented Patterns (Documentation Gap — Priority)
The following patterns are supported by the type system but need explicit documentation:
- **Model-as-resource**: A model is a resource (type: `model`); training is an action (type: `transform` or `ext:ml:train`); datasets are resources (type: `dataset`). The training action records dataset CIDs as inputs and model CID as output.
- **Human-input-as-resource**: A human records their authored text/image as a resource and includes its CID as an input to an AI action. The provenance graph evidences human creative contribution.
- **Authorization + License pairing**: Combining `ext:authorization@1.0.0` with `ext:license@1.0.0` to record that a specific use was explicitly permitted.

---

## Package 2: @provenancekit/payments ✅ COMPLETE
**Status:** Implemented with 3 adapters (Direct, 0xSplits, Superfluid) — 43 tests passing

### 2.1 Implemented Adapters

| Adapter | Purpose | Model | Chains |
|---------|---------|-------|--------|
| **DirectTransferAdapter** | One-time ETH/ERC-20 transfers | one-time | All EVM |
| **SplitsAdapter** | 0xSplits automatic revenue splitting | split-contract | ETH, Polygon, Arbitrum, Optimism, Base, Gnosis |
| **SuperfluidAdapter** | Real-time token streaming | streaming | ETH, Polygon, Arbitrum, Optimism, Base, Avalanche, BSC, Gnosis |

---

## Package 3: @provenancekit/privacy ✅ CORE COMPLETE
**Status:** Phases 1-5 implemented (187 tests passing); Phase 6 (ZK proofs) optional/advanced

**Phase 1: Encryption Primitives ✅** — AES-256-GCM, PBKDF2, HKDF, KeyRing
**Phase 2: Encrypted File Storage ✅** — EncryptedFileStorage wrapper
**Phase 3: Access Control ✅** — Lit Protocol format, IAccessControlProvider
**Phase 4: Selective Disclosure ✅** — SD-JWT-like, createPresentation/verifyPresentation
**Phase 5: Commitment Schemes ✅** — Pedersen commitments, homomorphic ops, contract integration
**Phase 6: ZK Proofs 📋 OPTIONAL** — Circom circuits, snarkjs, Groth16 verifier

---

## Package 4: @provenancekit/git ✅ COMPLETE
**Status:** Implemented and tested (71 tests passing)

- Git blame analysis, contribution weight calculation
- AI co-author detection (Copilot, Claude, ChatGPT, Cursor, Aider)
- GitHub integration via @octokit/rest (PRs, reviews, commits)
- `ext:git@1.0.0` extension schema
- Git hook generators for post-commit provenance recording

---

## Package 5: @provenancekit/media ✅ COMPLETE
**Status:** Implemented and tested (157 tests passing)

- Read/write C2PA manifests from images/videos
- X.509 certificate signing
- Bidirectional C2PA ↔ EAA type conversion
- AI disclosure detection
- `ext:c2pa@1.0.0` extension schema
- Supported: JPEG, PNG, HEIC, HEIF, AVIF, WebP, MP4, MOV, MP3, M4A, PDF

---

# PART 2: BASE LAYER

## @provenancekit/eaa-types ✅ COMPLETE
**Status:** v0.0.2; fully implemented (TypeScript compile-time validated)

- Entity (human, ai, organization) with extensible roles
- Action (create, transform, aggregate, verify) with extensible types
- Resource (text, image, audio, video, code, dataset, model, other)
- Attribution (creator, contributor, source)
- ProvenanceBundle, ContentReference, ExtensionRegistry

---

## @provenancekit/contracts ✅ COMPLETE
**Status:** v0.0.1; 27/27 tests passing (Foundry/Forge)

**Architecture:** ProvenanceCore → ProvenanceVerifiable → ProvenanceRegistry

- `recordAction()` event-driven, minimal on-chain storage
- ECDSA proof recording (malleability-safe via OpenZeppelin)
- Hash commitment for ZK-friendly delayed reveal
- Full registry: entities, resources, attributions, ownership
- `recordActionAndRegisterOutputs()` — gas-efficient convenience function

**Design note:** `recordAttribution()` allows any address to self-attribute to any CID — intentional permissive self-attestation. Trust is established in the off-chain provenance graph.

---

## @provenancekit/storage ✅ FULLY COMPLETE
**Status:** v0.0.1; 93/93 tests passing

**All adapters — actual status:**

| Adapter | Lines | Status |
|---------|-------|--------|
| MemoryDbStorage | 436L | ✅ Complete, 25 tests |
| PostgresStorage | 950L | ✅ Complete |
| MongoDbStorage | 559L | ✅ Complete, 40 mock tests |
| SupabaseStorage | 1142L | ✅ Complete (not a stub — fully implemented with vector search support) |
| MemoryFileStorage | — | ✅ Complete, 28 tests |
| PinataStorage | — | ✅ Complete |
| InfuraStorage | — | ✅ Complete |
| LocalIPFSStorage | — | ✅ Complete |
| Web3StorageAdapter | — | ✅ Complete |
| ArweaveStorage | — | ✅ Complete |

**Gap:** No `initialize()` on DB adapters — they assume tables/collections exist. No formal migration files. ITransactionalStorage not fully implemented in Postgres (function runs directly, no real BEGIN/COMMIT/ROLLBACK).

---

## @provenancekit/indexer ✅ IMPLEMENTED / ⚠️ NOT WIRED TO SDK
**Status:** Fully implemented; 66 tests passing

- `ProvenanceIndexer` class — pluggable viem `PublicClient` + `IProvenanceStorage`
- Historical sync + real-time polling + retry with exponential backoff
- Pure transform functions for all 5 event types
- 49 pure transform tests + 17 ProvenanceIndexer class tests

**Gap:** Indexer works standalone; not exposed via SDK or API as a first-class feature. Consumers must start it manually.

---

# PART 3: PLATFORM LAYER

## provenancekit-api ✅ SUBSTANTIALLY COMPLETE
**Status:** Running; 31 integration tests passing (provenance routes)

**Framework:** Hono + @hono/node-server
**Storage:** Configurable (Supabase/Postgres default)
**Files:** Pinata IPFS

**Two API namespaces:**
- `/v1/*` — provenance recording (pk_live_ keys, end-user traffic)
- `/management/*` — control plane (MANAGEMENT_API_KEY + X-User-Id, server-to-server)

**Management API routes (all implemented):**
- `GET/PUT /management/users/me` — user upsert on login
- `GET/POST /management/orgs` + full org CRUD
- `GET/POST/DELETE /management/orgs/:slug/members`
- `GET/POST /management/orgs/:slug/projects` + project CRUD
- `GET/POST /management/projects/:id/api-keys` + `DELETE /management/api-keys/:keyId`
- `GET /management/projects/:id/usage` — 30-day summary + daily breakdown
- `POST /management/auth/validate-key` — validate pk_live_ key

**V1 API routes (all implemented):**
- Entities, actions, resources, attributions (full CRUD)
- Distribution, bundle, graph, session, search, similar
- Ownership (claim, transfer)
- Media (C2PA extract + embed)
- Activity (convenience endpoint: upload + record + embed)

**Gaps:**
- Management endpoints not integration-tested (only v1 routes are tested)
- Auth edge cases not tested
- No rate limiting (file exists; nothing implemented)
- No OpenAPI spec

---

## @provenancekit/sdk ✅ SUBSTANTIALLY COMPLETE
**Status:** v0.1.0; 47 tests passing

**Implemented:**
- HTTP client methods for all API endpoints
- Ed25519 and ECDSA-secp256k1 signing utilities
- Encrypted vector/embedding operations
- Bundle signing and verification
- **`IChainAdapter` interface** + **`createViemAdapter`** + **`createEIP1193Adapter`** (framework-agnostic, works with MetaMask/Privy/Coinbase/WalletConnect)
- **`file()` on-chain integration** — records action on ProvenanceRegistry when `chain` adapter is set; result.onchain = { txHash, actionId, chainId, chainName }
- Fire-and-forget on-chain recording (non-fatal: off-chain record always stands)

**Legacy fields to clean up (P2):**
- `entity.wallet` — not part of EAA types (v1.ts compat layer still uses it)

---

## provenancekit-app ✅ PRODUCTION DASHBOARD
**Status:** Next.js 15 full management dashboard; Privy auth; 0 tests

**Implements:**
- Privy server auth, cookie session
- Org management (create, settings, members, billing)
- Project management (create, settings, analytics)
- API key management (create, revoke, one-time show)
- Usage analytics (30-day summary + daily breakdown)
- MCP server endpoint
- Typed management-client.ts — thin fetch wrapper over management API

**Gaps:**
- 0 tests
- Billing page is a placeholder
- Privacy page is a placeholder

---

## @provenancekit/ui ✅ COMPLETE
**Status:** Full component library — 35 source files, builds clean (CJS + ESM + type declarations)

**Component Surface:** EntityAvatar, RoleBadge, ProvenanceBadge, ProvenanceBundleView, ProvenanceGraph, ProvenanceTracker, ProvenanceSearch, ProvenanceKitProvider, useProvenanceGraph, useProvenanceBundle, useSessionProvenance, useDistribution, + primitives

**Gaps:**
- 0 tests
- No Storybook / visual tests

---

## Example Applications ✅ BOTH COMPLETE

### examples/chat — AI Chat with Provenance
**Status:** Production-grade; deployed-ready

- Multi-provider AI: OpenAI, Anthropic, Google, custom endpoint (Vercel AI SDK)
- Privy auth + MongoDB user/conversation storage
- Provenance: `recordChatProvenance()` with `ext:ai@1.0.0` on every AI response
- ProvenanceBadge inline with each AI message
- Provenance explorer: list + detail with 3 tabs (overview/graph/session)
- Per-user PK API key config (not hardcoded)
- Port 3002

### examples/canvas — Social Content Platform with On-Chain Splits
**Status:** Production-grade; deployed-ready

- Social posts with media upload (IPFS via Pinata), licensing, AI training preferences
- Remixes tracked as derivative provenance chains
- Revenue splits: ProvenanceKit distribution calculator → 0xSplits on Base
- Privy wallet + social auth (needed for on-chain interaction)
- Earnings dashboard
- Port 3003

---

# PART 4: TEST COVERAGE SUMMARY

| Package | Tests | Status |
|---------|-------|--------|
| @provenancekit/eaa-types | TypeScript compile-time | ✅ |
| @provenancekit/contracts | 27/27 (Forge) | ✅ |
| @provenancekit/storage | 93/93 (Memory + MongoDB mock) | ✅ |
| @provenancekit/extensions | 377/377 (incl. x402, authorization) | ✅ |
| @provenancekit/privacy | 187/187 | ✅ |
| @provenancekit/payments | 43/43 | ✅ |
| @provenancekit/git | 71/71 | ✅ |
| @provenancekit/media | 157/157 | ✅ |
| @provenancekit/sdk | 47/47 | ✅ |
| @provenancekit/indexer | 66/66 (transforms + indexer) | ✅ |
| @provenancekit/ui | N/A (UI components) | ⚠️ 0 tests |
| provenancekit-api | 31/31 (v1 integration tests) | ⚠️ management routes untested |
| provenancekit-app | 0 | ⚠️ Dashboard |
| **Total (tested packages)** | **1068/1068** | **✅ 100% pass rate** |

---

# PART 5: CURRENT PHASE PLAN

## Phase A: Foundation Hardening — CURRENT PRIORITY

### A.1 First npm Publish
**Status:** ✅ Complete (2026-03-07)
- All 11 packages published to npm under `@provenancekit/*` scope
- CI/CD workflow configured: every push to `main` triggers automatic publish via changesets
- NPM_TOKEN wired in GitHub Actions secrets
- All packages verified on npmjs.com with correct exports

### A.2 API Rate Limiting
**Status:** ✅ Complete (2026-03-07)
- In-memory sliding window rate limiter: `src/middleware/rate-limit.ts`
- Configurable via `RATE_LIMIT_RPM` (default 60) + `RATE_LIMIT_BURST` (default 20) env vars
- Returns `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` headers
- Applied to `/v1/*`, `/activities*`, `/entities*`, `/resources*` routes
- Returns HTTP 429 with `Retry-After` header and `ProvenanceKitError("TooManyRequests")`

### A.3 SDK Legacy Field Cleanup
**Status:** ✅ Complete (2026-03-07)
- `entity.wallet` kept intentionally — serves real purpose for payment routing (entityId → walletAddress for Superfluid/0xSplits)
- Decision: removing would break `@provenancekit/payments` distribution flow

---

## Phase B: Documentation Sprint — HIGHEST LEVERAGE

### B.1 Missing Guide Pages
**Status:** ✅ Complete (2026-03-07)
- [x] `guides/payments.mdx` — Calculate distribution, 0xSplits, Superfluid, DirectTransfer
- [x] `guides/privacy.mdx` — Selective disclosure, encrypted storage, Pedersen commitments, Lit Protocol, AI training opt-out
- [x] `guides/git-provenance.mdx` — Git blame → EAA, AI co-author detection, hook installation
- [x] `guides/media-c2pa.mdx` — C2PA extraction/embedding, EU AI Act Art. 50 compliance
- [x] `guides/self-hosting.mdx` — Docker, env vars, DB setup, Railway/Render/Fly.io, rate limiting
- [x] `guides/on-chain.mdx` — API relayer model, viem adapter, EIP1193 adapter, UX/session keys, payment routing

### B.2 Pattern Pages (Legal Use Cases)
**Status:** ✅ Complete (2026-03-07)
- [x] `patterns/model-training-provenance.mdx` — Dataset → Training → Model EAA pattern, EU AI Act Art. 53
- [x] `patterns/human-creative-input.mdx` — Copyright evidencing via EAA graph, USCO 2025 context
- [x] `patterns/authorization-consent.mdx` — ext:authorization@1.0.0, GDPR consent ledger, withdrawal recording

### B.3 SDK Reference
**Status:** ✅ Complete (2026-03-07)
- [x] `sdk-reference/client.mdx` — All pk.* methods with full TypeScript interfaces
- [x] `sdk-reference/chain-adapters.mdx` — createViemAdapter, createEIP1193Adapter, custom adapter, session keys

### B.4 UI Component Reference (shadcn-style with live previews)
**Status:** ✅ Complete (2026-03-07)
- [x] `ui-reference/overview.mdx` — ProvenanceKitProvider setup, design tokens, headless mode, hooks
- [x] `ui-reference/components.mdx` — Full docs for every component with Preview/Code tabs + embedded iframes
- [x] `apps/provenancekit-ui-preview` — Standalone Next.js preview app (deploy to ui-preview.provenancekit.com)
  - Badge, Graph, Tracker, Bundle, Search, Primitives preview pages
  - Mock data baked in — no API key needed
  - `?dark=1` URL param for dark mode
  - iframeable (ALLOWALL / CSP frame-ancestors *)

### B.5 Update docs.json Navigation
**Status:** ✅ Complete (2026-03-07)
- All pages added to navigation
- New tabs: "UI Components" (overview + components), updated "SDK Reference" (client + chain-adapters)
- Domain Packages group in Guides (git-provenance, media-c2pa)
- Patterns tab: model-training-provenance + human-creative-input + authorization-consent

---

## Phase C: Developer Experience

### C.1 OpenAPI Specification
**Status:** ⬜ Not done
- Add `@hono/zod-openapi` to provenancekit-api
- Auto-generate OpenAPI schema for all `/v1/*` endpoints
- Publish at `/docs` and `/openapi.json`
- Integrate with Mintlify's OpenAPI rendering for interactive API reference

### C.2 Multi-Chain Deploy CLI
**Status:** ⬜ Not done
- `npx provenancekit deploy --chain base-sepolia --rpc <url> --private-key <pk>`
- Deployment registry: store deployed addresses per chain in `deployments.json`
- Chain configuration helper in SDK: `chainConfig("base")` returns RPC URL, contract address, explorer
- Support: Base, Base Sepolia, Arbitrum, Optimism, Polygon, Ethereum

### C.3 Storybook
**Status:** ⬜ Not done
- Storybook for @provenancekit/ui
- One story per component showing light/dark mode, various prop combos
- Deployable to GitHub Pages or Vercel for visual reference

---

## Phase D: Quality & Reliability

### D.1 API Test Coverage Expansion
**Status:** ⬜ Not done
- Integration tests for all management routes (`/management/*`)
- Auth edge cases: missing key, revoked key, wrong scope
- Error format consistency: all errors return `{ error, code, message }`
- Activity service end-to-end: upload → records → bundle → search

### D.2 provenancekit-app Tests
**Status:** ⬜ Not done
- Test: API routes in app (session, mcp, auth endpoints)
- Test: lib/management-client.ts (mock fetch)
- Test: lib/queries.ts wrappers

### D.3 DB Schema / Migration Story
**Status:** ⬜ Not done
- Add `initialize()` to IProvenanceStorage interface (optional; schema-creation semantics)
- Implement `initialize()` in Postgres and Supabase adapters (SQL DDL)
- Provide migration SQL files as reference
- Document schema expectations clearly

### D.4 Real Transaction Semantics
**Status:** ⬜ Not done
- Either implement real `BEGIN/COMMIT/ROLLBACK` in PostgreSQL adapter
- Or remove `ITransactionalStorage` from Postgres adapter's `implements` list and document clearly

### D.5 Testnet Integration Tests
**Status:** ⬜ Not done
- Deploy ProvenanceRegistry to Base Sepolia (testnet)
- Write integration tests against live testnet
- Test Indexer sync end-to-end (record on-chain → index → query)

---

## Phase E: Protocol Standardisation

### E.1 EIP Proposal
**Status:** ⬜ Not started
- Draft EIP proposing the provenance event schema as an Ethereum standard
- Define: `ActionRecorded`, `ResourceRegistered`, `AttributionRecorded` event signatures
- Define: minimal `IProvenanceProvider` interface
- Submit as EIP draft

### E.2 ISCN Compatibility Bridge
**Status:** ⬜ Not started
- Bidirectional conversion: ProvenanceBundle ↔ ISCN record
- Enable export to LikeCoin's blockchain-native content registry

### E.3 EU Code of Practice Alignment
**Status:** ⬜ Monitoring
- EU Code of Practice on AI content marking expected mid-2026
- When published: evaluate alignment of `ext:ai@1.0.0` and `ext:c2pa@1.0.0`

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
| PostgreSQL / Supabase | Database | Yes (for persistence) |
| Superfluid | Payment streaming | No (optional adapter) |
| Lit Protocol | Token-gated decryption | No (optional) |

---

*Last updated: 2026-03-07. This document reflects the actual current state of the codebase as of this date. Previous version had multiple inaccuracies (Supabase marked as stub when 1142L implemented; SDK test count wrong; app labelled "demo grade" when it is a production dashboard; examples not properly represented).*
