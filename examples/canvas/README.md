# Canvas

A social content platform where every post has verified authorship and remixes automatically credit their contributors. Revenue from monetized content is distributed on-chain to everyone in the provenance chain.

## Getting started

### 1. Install dependencies (from monorepo root)

```bash
pnpm install
```

### 2. Set up environment variables

```bash
cp .env.example .env.local
```

### 3. Run the development server

```bash
pnpm dev
# http://localhost:3003
```

## Creating and publishing content

Log in with your wallet or social account. On the **Create** page you can:

- Write a text post
- Choose a license (CC-BY, CC-BY-NC, All rights reserved, etc.)
- Set your AI training preference — whether your content may be used to train AI models
- Mark the post as premium and set a USDC price

Posts created while ProvenanceKit is configured show a green **Verified** badge. The badge links to the full provenance record.

## Remixing

On any post, hit **Remix** to open the composer pre-loaded with the original. Your remix is recorded as a derivative — the provenance chain links back to the original author automatically.

## Earning from your content

Once a post has a provenance record, go to the post and deploy a **Revenue Split**. ProvenanceKit computes how much each contributor in the chain should receive and deploys a 0xSplits contract on Base with those shares. Any payment to the contract is distributed on-chain instantly — no intermediary.

Track your earnings on the **Earnings** page.

## Enabling provenance tracking

1. Create a project in [ProvenanceKit Dashboard](http://localhost:3000)
2. Generate an API key
3. Open Canvas → **Settings → ProvenanceKit** and paste the key and API URL

## Environment variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_PRIVY_APP_ID` | Privy app ID (from privy.io) |
| `PRIVY_APP_SECRET` | Privy app secret |
| `MONGODB_URI` | MongoDB connection string |
| `NEXT_PUBLIC_BASE_RPC_URL` | Base RPC URL (default: Base Sepolia) |
| `NEXT_PUBLIC_CHAIN_ID` | Chain ID — `84532` for Sepolia, `8453` for Mainnet |
| `PINATA_API_KEY` | Pinata API key for IPFS uploads |
| `PINATA_SECRET_API_KEY` | Pinata secret |
| `NEXT_PUBLIC_IPFS_GATEWAY` | IPFS gateway URL for displaying content |
