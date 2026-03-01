# ProvenanceKit Dashboard

Multi-tenant management dashboard for ProvenanceKit — the universal provenance protocol for Human-AI created works. Think Vercel + Stripe Dashboard + Anthropic Console, but for provenance.

## What it does

- **Organizations & projects** — Create orgs, invite team members (owner/admin/developer/viewer roles), and manage multiple provenance namespaces as projects.
- **API key management** — Generate `pk_live_*` keys per project with read/write/admin permissions. Keys are hashed (SHA-256); plaintext shown exactly once.
- **Resource explorer** — Browse and inspect every provenance record (EAA resources, actions, attributions) stored in a project's backing database.
- **Provenance graph** — Visualize the full attribution chain for any content CID using `@provenancekit/ui`.
- **Payment dashboard** — Configure 0xSplits revenue distribution and Superfluid streams for monetized content.
- **Analytics** — API call volume, resource counts, active streams.
- **MCP server** — AI agents can perform all management operations via JSON-RPC 2.0 at `POST /api/mcp`. Authenticated with an admin-scoped API key.

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Auth | NextAuth v5 (GitHub, Google, Resend magic link) |
| Database | PostgreSQL + Drizzle ORM |
| Styling | Tailwind CSS v4 + shadcn/ui |
| State | TanStack Query v5 |
| Forms | React Hook Form + Zod |
| Provenance | @provenancekit/sdk + @provenancekit/ui |

## Project structure

```
apps/provenancekit-app/
├── app/
│   ├── (auth)/login/           # GitHub, Google, magic link login
│   ├── (dashboard)/
│   │   ├── dashboard/          # Overview: orgs, recent activity
│   │   ├── [orgSlug]/          # Org-scoped pages
│   │   │   ├── settings/       # Org name, slug, danger zone
│   │   │   ├── members/        # Invite + manage members
│   │   │   └── [projectSlug]/  # Project-scoped pages
│   │   │       ├── api-keys/   # List, create, revoke keys
│   │   │       ├── resources/  # EAA resource explorer
│   │   │       ├── provenance/ # Provenance graph explorer
│   │   │       ├── analytics/  # Usage stats
│   │   │       └── settings/   # Storage, IPFS, chain config
│   └── api/
│       ├── auth/[...nextauth]/ # NextAuth handler
│       ├── mcp/                # MCP server (JSON-RPC 2.0)
│       ├── orgs/               # Org CRUD
│       └── projects/[id]/      # Project + API key CRUD
├── components/
│   ├── layout/                 # Sidebar, top-nav, org/project switcher
│   ├── api-keys/               # Key list, create form, reveal-once dialog
│   ├── org/                    # Member table, invite form
│   └── ui/                     # shadcn/ui primitives
├── lib/
│   ├── auth.ts                 # NextAuth v5 config
│   ├── db/
│   │   ├── schema.ts           # Drizzle schema (all tables)
│   │   └── client.ts           # PostgreSQL pool
│   ├── api-keys.ts             # Key generation + SHA-256 hashing
│   ├── permissions.ts          # Role-based access helpers
│   └── queries.ts              # Server-side Drizzle queries
└── types/
    ├── index.ts
    └── next-auth.d.ts          # Session type augmentation
```

## MCP server

AI agents (Claude Code, Cursor, etc.) can manage the dashboard programmatically via the MCP endpoint at `POST /api/mcp`.

**Authentication:** pass an admin API key as a Bearer token.

**Available tools:**

| Tool | Description |
|------|-------------|
| `list_organizations` | List all orgs the key has access to |
| `list_projects` | List projects in an org |
| `list_api_keys` | List API keys for a project (no secrets) |
| `create_api_key` | Create a new key (returns plaintext once) |
| `get_usage_summary` | API call counts for a project |
| `create_organization` | Create a new org |
| `create_project` | Create a new project with storage config |

Example request:
```json
POST /api/mcp
Authorization: Bearer pk_live_<your-admin-key>
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "list_projects",
    "arguments": { "orgSlug": "acme" }
  }
}
```

## Setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Required variables:

```env
# NextAuth
NEXTAUTH_SECRET=<generate with: openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3000

# OAuth providers (at least one required)
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Email (Resend — for magic links)
RESEND_API_KEY=
EMAIL_FROM=noreply@yourdomain.com

# PostgreSQL
DATABASE_URL=postgresql://user:pass@localhost:5432/provenancekit_app

# ProvenanceKit API (internal)
PROVENANCEKIT_API_URL=http://localhost:8787
```

### 3. Run database migrations

```bash
pnpm db:push        # push schema to DB (dev)
# or
pnpm db:migrate     # run migrations (prod)
```

### 4. Start

```bash
pnpm dev            # http://localhost:3000
```

## Database schema

Key tables (see `lib/db/schema.ts` for the full schema):

- **`users`** — NextAuth users (email, OAuth accounts)
- **`organizations`** — Tenants; each has a slug, plan, owner
- **`organization_members`** — Role assignments (owner/admin/developer/viewer)
- **`projects`** — Provenance namespaces; hold storage + IPFS + chain config
- **`api_keys`** — Hashed keys with permission scopes and expiry
- **`usage_records`** — Per-request logs for billing + analytics
- **`audit_logs`** — Every mutating action with actor + metadata

## Deployment

Deployable to any Node.js host (Vercel, Railway, Fly.io). Requires:
- PostgreSQL instance (Supabase, Neon, PlanetScale Postgres)
- OAuth app credentials (GitHub and/or Google)
- Resend account for magic link emails
