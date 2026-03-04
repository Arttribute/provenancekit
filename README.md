# ProvenanceKit

Universal provenance framework for Human-AI created works. Track authorship, record derivatives, distribute revenue, and anchor everything on-chain.

[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)

---

## What is ProvenanceKit?

ProvenanceKit is a protocol and SDK for recording **who made what, how, and with what AI assistance** — in a way that is tamper-evident, interoperable, and legally meaningful.

At the core is the **EAA model**: every provenance record is a graph of **Entities** (humans, AI agents, organisations), **Actions** (create, transform, aggregate, verify), and **Attributions** (who contributed to what, in what role). The model is deliberately minimal — no payments, weights, or domain opinions at the base layer. Those live in typed **extensions** (`ext:namespace@version`) that can be attached to any record.

On-chain smart contracts (Solidity, Base/Arbitrum/Optimism) serve as the **source of truth**. Off-chain databases are materialised views. The indexer bridges them. Any developer can run their own node.

**Key capabilities:**

- Record human + AI creative contributions with cryptographic proof
- Track derivative chains (remixes, transformations, training data)
- Distribute revenue fairly based on the provenance graph (0xSplits)
- Embed C2PA manifests in media for EU AI Act Art. 50 compliance
- Privacy-preserving selective disclosure via SD-JWT-like proofs
- Git commit attribution with AI co-author detection

---

## Architecture

```
                    ┌─────────────────────┐
                    │   PLATFORM LAYER    │  ← Fully opinionated
                    │  provenancekit-app  │     Management dashboard
                    │  provenancekit-api  │     REST API
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              │         EXTENSION LAYER         │  ← Pluggable, opinionated
              │  ext:contrib  ext:x402  ext:ai  │
              │  provenancekit-payments         │
              │  provenancekit-git   ext:c2pa   │
              └────────────────┬────────────────┘
                               │
    ┌──────────────────────────┼──────────────────────────┐
    │                    BASE LAYER                       │  ← Pure protocol
    │  eaa-types    provenancekit-contracts               │
    │  provenancekit-storage    provenancekit-indexer     │
    └─────────────────────────────────────────────────────┘
```

---

## Packages

| Package | Path | Description |
|---------|------|-------------|
| `@provenancekit/eaa-types` | [packages/eaa-types](packages/eaa-types) | Core EAA type system (Entity, Action, Attribution) |
| `@provenancekit/contracts` | [packages/provenancekit-contracts](packages/provenancekit-contracts) | Solidity smart contracts (Foundry) |
| `@provenancekit/storage` | [packages/provenancekit-storage](packages/provenancekit-storage) | Storage adapters (Supabase, MongoDB, memory, IPFS) |
| `@provenancekit/indexer` | [packages/provenancekit-indexer](packages/provenancekit-indexer) | Blockchain → storage sync (viem) |
| `@provenancekit/extensions` | [packages/provenancekit-extensions](packages/provenancekit-extensions) | 15 typed extensions (AI, license, x402, auth, …) |
| `@provenancekit/payments` | [packages/provenancekit-payments](packages/provenancekit-payments) | Payment adapters (DirectTransfer, 0xSplits, Superfluid) |
| `@provenancekit/privacy` | [packages/provenancekit-privacy](packages/provenancekit-privacy) | Encryption, selective disclosure, Pedersen commitments |
| `@provenancekit/git` | [packages/provenancekit-git](packages/provenancekit-git) | Git blame → provenance, AI co-author detection |
| `@provenancekit/media` | [packages/provenancekit-media](packages/provenancekit-media) | C2PA media provenance (read/write manifests) |
| `@provenancekit/sdk` | [packages/provenancekit-sdk](packages/provenancekit-sdk) | TypeScript SDK + viem chain adapter |
| `@provenancekit/ui` | [packages/provenancekit-ui](packages/provenancekit-ui) | React component library (ProvenanceGraph, badges, …) |

---

## Applications

| App | Path | Port | Description |
|-----|------|------|-------------|
| `provenancekit-api` | [apps/provenancekit-api](apps/provenancekit-api) | 3001 | REST API — the primary server |
| `provenancekit-app` | [apps/provenancekit-app](apps/provenancekit-app) | 3000 | Management dashboard (Next.js 15) |

## Example Applications

| Example | Path | Port | Description |
|---------|------|------|-------------|
| `example-chat` | [examples/chat](examples/chat) | 3002 | Multi-provider AI chat with provenance tracking |
| `example-canvas` | [examples/canvas](examples/canvas) | 3003 | Social content platform with on-chain revenue splits |

---

## Getting Started

### Prerequisites

| Tool | Version | Required for |
|------|---------|--------------|
| Node.js | ≥ 20 | All apps |
| pnpm | ≥ 10 | Monorepo package manager |
| PostgreSQL | ≥ 14 | `provenancekit-app` (dashboard DB) |
| MongoDB | ≥ 6 | `examples/chat` and `examples/canvas` |
| Foundry | latest | Smart contract development only |

### 1. Install dependencies

```bash
# From the monorepo root
pnpm install
```

### 2. Build all packages

```bash
pnpm build
```

### 3. Configure environment variables

Each app has a `.env.example`. Copy and fill it in:

```bash
# API server (Supabase + Pinata optional — uses in-memory storage if omitted)
cp apps/provenancekit-api/.env.example apps/provenancekit-api/.env

# Dashboard (requires PostgreSQL)
cp apps/provenancekit-app/.env.example apps/provenancekit-app/.env.local

# Chat example (requires MongoDB + at least one AI API key)
cp examples/chat/.env.example examples/chat/.env.local

# Canvas example (requires MongoDB)
cp examples/canvas/.env.example examples/canvas/.env.local
```

### 4. Run everything locally

```bash
# All four services at once (with colour-coded output)
pnpm dev
```

Or run individual services:

```bash
pnpm dev:api      # REST API         → http://localhost:3001
pnpm dev:app      # Dashboard        → http://localhost:3000
pnpm dev:chat     # Chat example     → http://localhost:3002
pnpm dev:canvas   # Canvas example   → http://localhost:3003
pnpm dev:docs     # Docs (Mintlify)  → http://localhost:3333
```

---

## Minimal Local Setup (no external services)

The API falls back to **in-memory storage** when Supabase and Pinata are not configured. This lets you try the full API surface without any cloud accounts — data is lost on restart.

```bash
# Start the API with default in-memory storage
pnpm dev:api

# Test it
curl http://localhost:3001/
# → ok
```

For the dashboard and examples, you still need:
- PostgreSQL for `provenancekit-app`
- MongoDB for `examples/chat` and `examples/canvas`

A minimal Docker Compose to bring both up:

```yaml
# docker-compose.dev.yml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: provenancekit_app
    ports:
      - "5432:5432"

  mongodb:
    image: mongo:7
    ports:
      - "27017:27017"
```

```bash
docker compose -f docker-compose.dev.yml up -d
```

---

## Development

### Run all tests

```bash
pnpm test
# ~1050 tests across all packages
```

### Individual package tests

```bash
cd packages/provenancekit-extensions && pnpm test   # 377 tests
cd packages/provenancekit-privacy && pnpm test       # 187 tests
cd packages/provenancekit-storage && pnpm test       # 93 tests
cd packages/provenancekit-indexer && pnpm test       # 66 tests
cd packages/provenancekit-media && pnpm test         # 157 tests
cd packages/provenancekit-git && pnpm test           # 71 tests
cd packages/provenancekit-sdk && pnpm test           # 38 tests
```

### TypeScript

```bash
pnpm typecheck
```

### Smart contracts (Foundry)

```bash
cd packages/provenancekit-contracts
forge test
```

---

## SDK Quick Start

```typescript
import { ProvenanceKit } from "@provenancekit/sdk";

const pk = new ProvenanceKit({
  apiKey: "pk_live_...",          // From the dashboard
  baseUrl: "http://localhost:3001",
});

// Record a file with provenance
const result = await pk.file(myFile, {
  entity: { role: "creator", name: "Alice" },
  action: { type: "create" },
});

console.log(result.cid);       // IPFS CID of the uploaded file
console.log(result.actionId);  // Provenance action ID

// On-chain recording (optional — requires viem WalletClient)
import { createViemAdapter } from "@provenancekit/sdk";
const pk = new ProvenanceKit({
  apiKey: "pk_live_...",
  chain: createViemAdapter({ walletClient, publicClient, contractAddress: "0x..." }),
});
// result.onchain → { txHash, actionId, chainId }
```

---

## Extensions

ProvenanceKit ships 15 typed extensions. Any can be attached to any EAA record:

| Extension | Namespace | Purpose |
|-----------|-----------|---------|
| Contribution | `ext:contrib@1.0.0` | Attribution weights for revenue distribution |
| License | `ext:license@1.0.0` | SPDX/CC license terms + AI training opt-out |
| Payment | `ext:payment@1.0.0` | Payment recipients and methods |
| On-chain | `ext:onchain@1.0.0` | Blockchain anchoring proof |
| Storage | `ext:storage@1.0.0` | IPFS/Arweave replication status |
| AI | `ext:ai@1.0.0` | AI tool/agent provenance (provider, model, tokens) |
| Proof | `ext:proof@1.0.0` | Cryptographic action proof |
| Identity | `ext:identity@1.0.0` | Identity verification metadata |
| Witness | `ext:witness@1.0.0` | Server witness attestation |
| Tool Attestation | `ext:tool-attestation@1.0.0` | AI tool receipt levels |
| Verification | `ext:verification@1.0.0` | Claim verification status |
| Ownership Claim | `ext:ownership:claim@1.0.0` | On-chain ownership claim evidence |
| Ownership Transfer | `ext:ownership:transfer@1.0.0` | Ownership transfer records |
| Authorization | `ext:authorization@1.0.0` | General-purpose authorization status |
| x402 | `ext:x402@1.0.0` | HTTP 402 payment requirements/proof/splits |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Types | TypeScript 5, Zod |
| Contracts | Solidity 0.8, Foundry, OpenZeppelin |
| Storage | Supabase (pgvector), MongoDB, IPFS (Pinata/Infura/Arweave) |
| Chain | viem, Base, Arbitrum, Optimism, any EVM |
| Privacy | @noble/ciphers (AES-GCM), SD-JWT, Pedersen commitments |
| Media | C2PA (@contentauth/c2pa-node) |
| API | Hono, @hono/node-server |
| Dashboard | Next.js 15, NextAuth v5, Drizzle ORM |
| Examples | Next.js 15, Privy, Vercel AI SDK |
| Testing | Vitest |

---

## License

ISC — see [LICENSE](LICENSE)
