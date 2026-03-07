# Canvas

A social content platform where every post has verified authorship and remixes automatically credit their contributors. Revenue from monetized content is distributed on-chain to everyone in the provenance chain.

Built as a reference integration showing how a **platform operator** uses ProvenanceKit — one API key covers the whole platform; individual users don't need their own keys.

## Getting started

### 1. Install dependencies (from monorepo root)

```bash
pnpm install
```

### 2. Create a ProvenanceKit project

1. Sign in at [app.provenancekit.com](https://app.provenancekit.com)
2. Create a new project → copy the **API key** (`pk_live_...`)
3. Paste it as `PROVENANCEKIT_API_KEY` in your `.env.local`

This is a **platform key** — a single key for all of Canvas. Users are entities within your project identified by their Privy DID.

### 3. Set up environment variables

```bash
cp .env.example .env.local
# Fill in: PRIVY keys, MONGODB_URI, PROVENANCEKIT_API_KEY, PINATA_JWT
```

### 4. Run the development server

```bash
pnpm dev
# http://localhost:3003
```

## Features

### Creating content

Log in with your wallet or social account. On the **Create** page you can:

- Write a text, image, video, audio, or blog post
- Upload media (stored on IPFS via Pinata)
- Choose a license (CC-BY, CC-BY-NC, All Rights Reserved, etc.)
- Set your AI training preference
- Mark the post as premium with a USDC price

Posts created while ProvenanceKit is configured show a **Verified** badge linking to the full provenance record.

### Remixing

Hit **Remix** on any post. Your remix is recorded as a derivative — the provenance chain links back to the original author automatically. Both posts show in each other's provenance graph.

### Revenue splits

Once a post has a provenance record, open it and click **Deploy Revenue Split**. ProvenanceKit computes each contributor's share from the provenance graph and stores a 0xSplits config on Base. Any payment to the split address is distributed on-chain — no intermediary.

Track cumulative earnings on the **Earnings** page.

### Provenance panel

Every post with a provenance CID shows a panel with:
- **Bundle** tab — full EAA provenance record (entity, action, attribution)
- **Distribution** tab — how revenue is split across the provenance chain

## Architecture

```
User login (Privy)
  └─ Privy DID = PK entity ID (stable across sessions)

POST /api/posts
  └─ CanvasPKClient.recordNewPost()  →  ProvenanceKit API
       └─ ext:license@1.0.0 + ext:payment@1.0.0 recorded
       └─ provenanceCid saved to MongoDB post doc

Client reads (provenance panel, splits display)
  └─ /api/pk/bundle/[cid]      (server proxy — keeps API key secret)
  └─ /api/pk/graph/[cid]
  └─ /api/pk/distribution/[cid]
```

## Environment variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_PRIVY_APP_ID` | Privy app ID (from privy.io) |
| `PRIVY_APP_SECRET` | Privy app secret |
| `MONGODB_URI` | MongoDB connection string |
| `PROVENANCEKIT_API_KEY` | Platform API key from app.provenancekit.com |
| `PROVENANCEKIT_API_URL` | ProvenanceKit API URL (default: https://api.provenancekit.com) |
| `NEXT_PUBLIC_BASE_RPC_URL` | Base RPC URL (default: Base Sepolia) |
| `NEXT_PUBLIC_CHAIN_ID` | Chain ID — `84532` for Sepolia, `8453` for Mainnet |
| `PINATA_JWT` | Pinata JWT for IPFS media uploads |
| `NEXT_PUBLIC_IPFS_GATEWAY` | IPFS gateway hostname for displaying content |
