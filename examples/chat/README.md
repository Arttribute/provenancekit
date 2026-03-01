# Canvas Chat — AI Chat with Provenance

> **Example app** — demonstrates integrating ProvenanceKit into a production AI chat application.

A ChatGPT-style application where every AI-generated message has its authorship, model, and parameters recorded on-chain via ProvenanceKit. Users can inspect the provenance of any response directly in the chat UI.

## What it demonstrates

- Recording provenance for AI-generated content using `ext:ai@1.0.0`
- Multi-provider support (OpenAI, Anthropic, Google) with a unified provenance schema
- Linking ProvenanceKit records to a real app via user-supplied API keys
- Displaying provenance badges (`ProvenanceBadge`) inline with AI responses
- Provider-agnostic `promptHash` for reproducibility attestation

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Auth | Privy (@privy-io/react-auth) |
| Database | MongoDB |
| AI | Vercel AI SDK (`ai`) + @ai-sdk/openai, @ai-sdk/anthropic, @ai-sdk/google |
| Provenance | @provenancekit/sdk |
| Styling | Tailwind CSS v4 + shadcn/ui |
| State | TanStack Query v5 + `useChat` hook |

## Project structure

```
examples/chat/
├── app/
│   ├── (app)/
│   │   ├── chat/               # Conversation list
│   │   │   └── [id]/           # Single conversation with streaming chat UI
│   │   └── settings/           # ProvenanceKit config + AI provider/model settings
│   └── api/
│       ├── chat/               # Streaming chat completions + provenance recording
│       └── conversations/      # CRUD conversations
├── components/
│   ├── chat/
│   │   ├── conversation-sidebar.tsx
│   │   └── (message list, input — on chat/[id]/page.tsx)
│   └── providers/
│       ├── privy-provider.tsx
│       └── query-provider.tsx
├── lib/
│   ├── mongodb.ts              # MongoDB connection (dev singleton)
│   ├── pk-client.ts            # PKClient factory (per-user config)
│   └── provenance.ts           # recordChatProvenance() + KNOWN_MODELS catalogue
└── types/
    └── index.ts                # ChatUser, Conversation, ChatMessage
```

## ProvenanceKit integration

Every AI response is recorded as a ProvenanceKit action with the `ext:ai@1.0.0` extension:

```typescript
// lib/provenance.ts
await recordChatProvenance({
  pkClient,
  userEntityId,        // ProvenanceKit entity for the user
  userMessageCid,      // IPFS CID of the user's prompt
  assistantMessageCid, // IPFS CID of the AI's response
  provider: "anthropic",
  model: "claude-sonnet-4-6",
  promptHash,          // SHA-256 of the full prompt
  tokens: usage.totalTokens,
});
```

This produces a ProvenanceKit action record of type `"create"` with:
- `performedBy` → the user entity
- `inputs` → `[userMessageCid]`
- `outputs` → `[assistantMessageCid]`
- `extensions["ext:ai@1.0.0"]` → `{ provider, model, promptHash, tokens }`

The resulting `provenanceCid` is stored on the `messages` document in MongoDB and displayed as a badge in the UI.

### Supported providers + models

Configured in `lib/provenance.ts` via the `KNOWN_MODELS` catalogue:

| Provider | Models |
|----------|--------|
| OpenAI | gpt-4o, gpt-4o-mini, o3-mini |
| Anthropic | claude-opus-4-6, claude-sonnet-4-6, claude-haiku-4-5 |
| Google | gemini-2.5-pro, gemini-2.0-flash |
| Custom | any OpenAI-compatible endpoint |

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

# AI providers (add whichever you want to support)
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_AI_API_KEY=

# Custom provider (optional — OpenAI-compatible)
CUSTOM_AI_BASE_URL=
CUSTOM_AI_API_KEY=
```

### 3. Start

```bash
pnpm dev    # http://localhost:3001
```

### 4. Connect ProvenanceKit

1. Create a project in the [ProvenanceKit dashboard](http://localhost:3000)
2. Generate an API key for the project
3. Open Chat → Settings → ProvenanceKit and enter the key + API URL

Once configured, every AI response will be provenance-tracked automatically.

## MongoDB schema

```
users       { privyDid, email, name, pkApiKey, pkApiUrl, createdAt }
conversations { title, userId, provider, model, provenanceCid, createdAt }
messages    { conversationId, role, content, provider, model,
              provenanceCid, actionId, usage, createdAt }
```
