# Canvas Chat

An AI chat application where every message is provenance-tracked. Supports OpenAI, Anthropic, Google, and any OpenAI-compatible model. Connect your ProvenanceKit project and every AI response gets a verified on-chain record.

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
# http://localhost:3002
```

## Connecting your AI provider

Open **Settings** and select which provider and model to use. Add the corresponding API key to `.env.local`:

| Provider | Environment variable |
|----------|---------------------|
| OpenAI | `OPENAI_API_KEY` |
| Anthropic | `ANTHROPIC_API_KEY` |
| Google | `GOOGLE_AI_API_KEY` |
| Custom (OpenAI-compatible) | `CUSTOM_AI_BASE_URL` + `CUSTOM_AI_API_KEY` |

## Enabling provenance tracking

1. Create a project in [ProvenanceKit Dashboard](http://localhost:3000)
2. Generate an API key for that project
3. Open Chat → **Settings → ProvenanceKit** and paste the key and API URL

Once connected, every AI response will have a green **Verified** badge. Click it to see the provenance record — which model was used, a hash of the prompt, and token count.

## Environment variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_PRIVY_APP_ID` | Privy app ID (from privy.io) |
| `PRIVY_APP_SECRET` | Privy app secret |
| `MONGODB_URI` | MongoDB connection string |
| `OPENAI_API_KEY` | Optional — for OpenAI models |
| `ANTHROPIC_API_KEY` | Optional — for Claude models |
| `GOOGLE_AI_API_KEY` | Optional — for Gemini models |
| `CUSTOM_AI_BASE_URL` | Optional — for self-hosted models |
| `CUSTOM_AI_API_KEY` | Optional — for self-hosted models |
