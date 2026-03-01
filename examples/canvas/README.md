# Canvas — Social Content Platform with On-chain Provenance

> **Example app** — demonstrates integrating ProvenanceKit into a production social content platform with on-chain monetization.

A Twitter/Instagram-style platform where every post has its authorship recorded on-chain, remixes chain back to their originals, and revenue from monetized content is automatically split between all contributors in the provenance graph via 0xSplits on Base.

## What it demonstrates

- Recording provenance for human-created content (`ext:license@1.0.0` + AI training opt-out)
- Remix attribution — `recordRemix()` chains a new post to its original on-chain
- Revenue distribution computed from the provenance graph → deployed as a 0xSplits contract
- Per-user ProvenanceKit API key configuration (each creator brings their own PK project)
- Provenance badge (`ProvenancePanel`) inline with posts

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Auth | Privy — wallet + social login (critical for on-chain features) |
| Database | MongoDB |
| Provenance | @provenancekit/sdk + @provenancekit/extensions |
| Payments | @provenancekit/payments (0xSplits) |
| Blockchain | Base (Sepolia for dev, Mainnet for prod) |
| Styling | Tailwind CSS v4 + shadcn/ui |
| State | TanStack Query v5 |

## Project structure

```
examples/canvas/
├── app/
│   ├── (app)/
│   │   ├── feed/               # Home feed (followed creators + own posts)
│   │   ├── explore/            # Trending / recent public posts
│   │   ├── create/             # Post composer (text, license, AI training, monetization)
│   │   ├── post/[id]/          # Post detail with remix, provenance panel, splits info
│   │   ├── earnings/           # Creator earnings dashboard (0xSplits distributions)
│   │   └── settings/           # Profile + ProvenanceKit API key config
│   └── api/
│       ├── posts/              # GET feed/explore, POST create post
│       │   └── [id]/
│       │       ├── route.ts    # GET/DELETE post
│       │       ├── like/       # POST increment likes
│       │       └── splits/     # POST deploy 0xSplits for post
│       ├── users/              # POST upsert on login, PATCH profile/PK config
│       │   └── [id]/
│       └── earnings/           # GET creator earnings history
├── components/
│   ├── feed/
│   │   └── post-card.tsx       # Post card with ProvenanceBadge
│   ├── payments/
│   │   └── splits-display.tsx  # Revenue split visualization
│   ├── provenance/
│   │   └── provenance-panel.tsx # Slide-up provenance detail modal
│   └── providers/
│       ├── privy-provider.tsx
│       └── query-provider.tsx
├── lib/
│   ├── mongodb.ts              # MongoDB connection
│   ├── provenance.ts           # CanvasPKClient — recordNewPost, recordRemix, getDistribution
│   └── utils.ts
└── types/
    └── index.ts                # CanvasUser, Post, SplitsContract, CreatorEarning
```

## ProvenanceKit integration

### New post

```typescript
// lib/provenance.ts — CanvasPKClient.recordNewPost()
const result = await client.recordAction({
  type: "create",
  performedBy: authorEntityId,
  outputs: [{ ref: contentCid, scheme: "cid" }],
  extensions: {
    "ext:license@1.0.0": withLicense({
      type: "CC-BY-4.0",
      commercial: true,
      aiTraining: "reserved",   // DSM Art. 4(3) opt-out
    }),
    "ext:payment@1.0.0": withPayment({
      method: "splits",
      recipient: user.wallet,
    }),
  },
});
post.provenanceCid = result.resource.cid;
```

### Remix

```typescript
// CanvasPKClient.recordRemix()
const result = await client.recordAction({
  type: "transform",
  performedBy: remixerEntityId,
  inputs:  [{ ref: originalProvenanceCid, scheme: "cid" }],
  outputs: [{ ref: remixCid, scheme: "cid" }],
});
```

### Revenue distribution

```typescript
// CanvasPKClient.getDistribution(provenanceCid)
// → walks the provenance graph via the PK API
// → returns [{ entityId, wallet, share }] in basis points (10000 = 100%)
// → deploy a 0xSplits contract with these shares
// → any on-chain payment to the contract auto-splits between all contributors
```

## Post lifecycle

```
1. Alice writes a post → PK records "create" action → provenanceCid stored on post
2. Bob remixes Alice's post → PK records "transform" action (originalCid → remixCid)
3. Bob deploys a splits contract → PK computes distribution (e.g. Alice 60%, Bob 30%, platform 10%)
4. Viewer pays to unlock Bob's premium post → 0xSplits distributes on-chain automatically
5. Alice and Bob see earnings on /earnings dashboard
```

## Setup

### 1. Install

```bash
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

```env
# Privy
NEXT_PUBLIC_PRIVY_APP_ID=
PRIVY_APP_SECRET=

# MongoDB
MONGODB_URI=mongodb+srv://...

# Base blockchain (Base Sepolia for dev)
NEXT_PUBLIC_BASE_RPC_URL=https://sepolia.base.org
NEXT_PUBLIC_CHAIN_ID=84532

# IPFS (Pinata)
PINATA_API_KEY=
PINATA_SECRET_API_KEY=
NEXT_PUBLIC_IPFS_GATEWAY=https://gateway.pinata.cloud/ipfs/
```

### 3. Start

```bash
pnpm dev    # http://localhost:3002
```

### 4. Connect ProvenanceKit

Each creator configures their own ProvenanceKit project in **Settings → ProvenanceKit**:
1. Create a project at [app.provenancekit.org](http://localhost:3000)
2. Generate an API key
3. Paste the key + API URL in Canvas settings

Posts created while a PK key is configured will have on-chain provenance and the green **Verified** badge.

## MongoDB schema

```
users           { privyDid, wallet, username, bio, provenancekitApiKey,
                  followersCount, postsCount, createdAt }
posts           { authorId, type, content, mediaRefs, originalPostId,
                  provenanceCid, splitsContract, isPremium, x402Price,
                  tags, likesCount, remixCount, createdAt }
splits_contracts { postId, contractAddress, chainId,
                   recipients: [{ wallet, share }], deployedAt }
creator_earnings { userId, postId, amount, currency, txHash, type,
                   distributedAt }
```
