# PLAN: Example Applications

Two standalone apps that demonstrate ProvenanceKit SDK integration in real product contexts.

Both live under `examples/` (added to `pnpm-workspace.yaml`). Each has its own `package.json`, MongoDB database, and Privy auth. They are meant to be deployed independently — they only share ProvenanceKit packages from the monorepo.

---

## examples/chat — AI Chat with Provenance

### Purpose

Show how to integrate ProvenanceKit into an AI chat application. Every AI-generated message gets a provenance record that captures who asked, what model answered, and a hash of the prompt.

### Goals

- Multi-provider AI: OpenAI, Anthropic, Google, custom endpoint
- One unified provenance schema (`ext:ai@1.0.0`) regardless of provider
- Users bring their own ProvenanceKit API key (from provenancekit-app)
- ProvenanceBadge inline with each AI message

### Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 15 (App Router) |
| Auth | Privy (@privy-io/react-auth) |
| Database | MongoDB |
| AI | Vercel AI SDK (`ai`) + @ai-sdk/openai + @ai-sdk/anthropic + @ai-sdk/google |
| Provenance | @provenancekit/sdk |
| Styling | Tailwind v4 + shadcn/ui |

### File Structure

```
examples/chat/
├── app/
│   ├── layout.tsx                     # Privy + QueryProvider
│   ├── page.tsx                       # Landing / login redirect
│   ├── (app)/
│   │   ├── layout.tsx                 # Auth guard
│   │   ├── chat/page.tsx              # Conversation list
│   │   ├── chat/[id]/page.tsx         # Streaming chat UI
│   │   └── settings/page.tsx          # AI provider + PK API key config
│   └── api/
│       ├── chat/route.ts              # streamText + provenance recording
│       └── conversations/route.ts     # CRUD
├── components/
│   ├── chat/conversation-sidebar.tsx
│   └── providers/
├── lib/
│   ├── mongodb.ts
│   ├── pk-client.ts                   # PKClient factory (per user config)
│   └── provenance.ts                  # recordChatProvenance() + KNOWN_MODELS
└── types/index.ts
```

### Provenance Design

```typescript
// Called in api/chat/route.ts → onFinish callback
await recordChatProvenance({
  pkClient,
  userEntityId,        // PK entity for the user
  userMessageCid,      // IPFS CID of prompt
  assistantMessageCid, // IPFS CID of response
  provider: "anthropic",
  model: "claude-sonnet-4-6",
  promptHash,          // SHA-256 of full message array
  tokens: usage.totalTokens,
});
// → records action type="create"
// → inputs: [userMessageCid], outputs: [assistantMessageCid]
// → extensions["ext:ai@1.0.0"]: { provider, model, promptHash, tokens }
// → stores result.resource.cid on the messages document
```

### Multi-Provider Factory

```typescript
// api/chat/route.ts
function getProvider(provider: SupportedProvider, model: string) {
  switch (provider) {
    case "openai":    return createOpenAI({ apiKey: env.OPENAI_API_KEY })(model);
    case "anthropic": return createAnthropic({ apiKey: env.ANTHROPIC_API_KEY })(model);
    case "google":    return createGoogleGenerativeAI({ apiKey: env.GOOGLE_AI_API_KEY })(model);
    default:          return createOpenAI({ apiKey: env.CUSTOM_AI_API_KEY, baseURL: env.CUSTOM_AI_BASE_URL })(model);
  }
}
```

### KNOWN_MODELS Catalogue

Defined in `lib/provenance.ts`. Used for the model picker in Settings and for display names in the chat UI.

| Provider | Model IDs |
|----------|-----------|
| openai | gpt-4o, gpt-4o-mini, o3-mini |
| anthropic | claude-opus-4-6, claude-sonnet-4-6, claude-haiku-4-5 |
| google | gemini-2.5-pro, gemini-2.0-flash |

### MongoDB Schema

```
users         { privyDid, email, name, pkApiKey, pkApiUrl, provider, model, createdAt }
conversations { title, userId, provider, model, provenanceCid, createdAt }
messages      { conversationId, role, content, provider, model,
                provenanceCid, actionId, usage, createdAt }
```

### Environment Variables

```env
NEXT_PUBLIC_PRIVY_APP_ID=
PRIVY_APP_SECRET=
MONGODB_URI=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_AI_API_KEY=
CUSTOM_AI_BASE_URL=          # optional
CUSTOM_AI_API_KEY=            # optional
```

---

## examples/canvas — Social Content Platform

### Purpose

Show how to integrate ProvenanceKit into a content creation platform with on-chain monetization. Posts have verified authorship, remixes chain to originals, and revenue splits to contributors automatically.

### Goals

- Record creation (`ext:license@1.0.0`) and remix (`type="transform"`) provenance
- AI training opt-out field per DSM Art. 4(3) (`aiTraining: "reserved"`)
- Compute revenue distribution from provenance graph → deploy as 0xSplits contract on Base
- Per-user PK API key (each creator configures their own project)

### Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 15 (App Router) |
| Auth | Privy — wallet + social (wallet required for on-chain) |
| Database | MongoDB |
| Provenance | @provenancekit/sdk + @provenancekit/extensions |
| Payments | @provenancekit/payments (0xSplits adapter) |
| Blockchain | Base (Sepolia dev, Mainnet prod) |
| Styling | Tailwind v4 + shadcn/ui |

### File Structure

```
examples/canvas/
├── app/
│   ├── layout.tsx                     # Privy + QueryProvider
│   ├── page.tsx                       # Landing
│   ├── (app)/
│   │   ├── layout.tsx                 # Top nav + auth guard + user upsert
│   │   ├── feed/page.tsx              # Home feed
│   │   ├── explore/page.tsx           # Trending content
│   │   ├── create/page.tsx            # Post composer (text, license, AI training, monetization)
│   │   ├── post/[id]/page.tsx         # Post detail, remix button, splits info
│   │   ├── earnings/page.tsx          # Creator earnings (0xSplits distributions)
│   │   └── settings/page.tsx          # Profile + PK API key
│   └── api/
│       ├── posts/route.ts             # GET feed/explore, POST create
│       ├── posts/[id]/route.ts        # GET/DELETE
│       ├── posts/[id]/like/route.ts   # POST
│       ├── posts/[id]/splits/route.ts # POST deploy splits contract
│       ├── users/route.ts             # POST upsert on login
│       ├── users/[id]/route.ts        # GET/PATCH
│       └── earnings/route.ts          # GET earnings history
├── components/
│   ├── feed/post-card.tsx             # ProvenanceBadge inline
│   ├── payments/splits-display.tsx    # Revenue split bars
│   ├── provenance/provenance-panel.tsx # Slide-up CID + IPFS link
│   └── providers/
├── lib/
│   ├── mongodb.ts
│   ├── provenance.ts                  # CanvasPKClient class
│   └── utils.ts
└── types/index.ts
```

### Provenance Design

```typescript
// CanvasPKClient — lib/provenance.ts

// New post
recordNewPost({ authorEntityId, contentCid, licenseType, aiTraining, paymentWallet })
// → action type="create"
// → ext:license@1.0.0: { type, commercial, aiTraining }
// → ext:payment@1.0.0: { method: "splits", recipient: wallet }

// Remix
recordRemix({ remixerEntityId, originalCid, remixCid, remixNote })
// → action type="transform"
// → inputs: [originalCid], outputs: [remixCid]

// Revenue distribution
getDistribution(provenanceCid)
// → walks provenance graph via PK API
// → returns [{ entityId, wallet, share }] in basis points
// → caller deploys 0xSplits contract with these shares
```

### Post Lifecycle

```
1. Alice creates post → PK records "create" action → provenanceCid on post doc
2. Bob remixes Alice → PK records "transform" (originalCid → remixCid)
3. Bob opens splits → PK computes distribution (e.g. Alice 60%, Bob 30%, platform 10%)
4. 0xSplits contract deployed on Base with those shares
5. Payments to contract auto-split on-chain → both see earnings on /earnings
```

### MongoDB Schema

```
users            { privyDid, wallet, username, bio, provenancekitApiKey,
                   followersCount, postsCount, createdAt }
posts            { authorId, type, content, mediaRefs, originalPostId,
                   remixNote, provenanceCid, splitsContract,
                   isPremium, x402Price, tags, likesCount, remixCount, createdAt }
splits_contracts { postId, contractAddress, chainId,
                   recipients: [{ wallet, share }], deployedAt }
creator_earnings { userId, postId, amount, currency, txHash, type, distributedAt }
```

### Environment Variables

```env
NEXT_PUBLIC_PRIVY_APP_ID=
PRIVY_APP_SECRET=
MONGODB_URI=
NEXT_PUBLIC_BASE_RPC_URL=https://sepolia.base.org
NEXT_PUBLIC_CHAIN_ID=84532
PINATA_API_KEY=
PINATA_SECRET_API_KEY=
NEXT_PUBLIC_IPFS_GATEWAY=https://gateway.pinata.cloud/ipfs/
```

---

## Shared Patterns (both apps)

### Privy user registration
On first login, the app layout calls `POST /api/users` to upsert the user in MongoDB using `privyDid` as the key. Subsequent logins are no-ops (upsert with `$setOnInsert`).

### PK client per user
Each user stores their own ProvenanceKit API key in their user document. `createCanvasPKClient(user)` / `PKClient.fromUser(user)` reads the key and constructs a scoped SDK client. If no key is configured, provenance recording is silently skipped.

### Non-fatal provenance
All `pk.*` calls are wrapped in try/catch. A failed provenance record never blocks post creation or message delivery. Failures are logged as `console.warn("[PK]")`.
