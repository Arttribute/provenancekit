# PLAN: provenancekit-app

Multi-tenant management dashboard — the control plane for ProvenanceKit. Think Vercel + Stripe Dashboard + Anthropic Console for provenance.

## Goals

Give developers and teams a self-hosted web interface to:
- Manage organizations, projects, and team members
- Issue and revoke scoped API keys for their apps
- Inspect every provenance record stored in a project
- Configure storage backends, IPFS providers, and blockchain settings
- Monitor usage and set up billing/plans
- Allow AI agents to perform all of the above via MCP

---

## Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | Next.js 15 (App Router) | File-based routing, server actions, streaming |
| Auth | NextAuth v5 + DrizzleAdapter | GitHub + Google + magic link; session stored in PG |
| Database | PostgreSQL + Drizzle ORM | App state only (not provenance data); strong typing via Drizzle |
| Styling | Tailwind v4 + shadcn/ui | Consistent design system, dark mode |
| State | TanStack Query v5 | Server state, optimistic updates |
| Forms | React Hook Form + Zod | Validated forms throughout |
| Provenance display | @provenancekit/ui | ProvenanceGraph, ProvenanceBadge |
| MCP | JSON-RPC 2.0 (hand-rolled) | SDK uses Node.js HTTP; Next.js App Router uses Web Fetch API — incompatible |

## Conventions

- Root-level Next.js layout (no `src/` directory)
- `@/*` path alias maps to the repo root
- Dynamic params are typed as `Promise<T>` and awaited (Next.js 15)

---

## Database Schema

All app-state tables — not provenance data (that lives in per-project storage).

```
users                  — NextAuth users
accounts               — OAuth account links
sessions               — NextAuth sessions
verificationTokens     — Magic link tokens

organizations          — Tenant entity; slug, plan, ownerId
organization_members   — userId + orgId + role (owner|admin|developer|viewer)
organization_invites   — Pending email invites with token + expiry

projects               — Provenance namespace; storageType, storageUrl, ipfsProvider, chainId
api_keys               — prefix (first 8 chars), keyHash (SHA-256), permissions, expiresAt, revokedAt
usage_records          — Per-request log: endpoint, statusCode, timestamp
billing_plans          — apiCallLimit, teamMemberLimit, storageGBLimit
org_subscriptions      — Stripe customer/sub IDs, status
audit_logs             — Every mutating action: actor, resource, metadata
webhooks               — Per-project webhook URLs + events + secret
```

Full Drizzle schema: `apps/provenancekit-app/lib/db/schema.ts`

---

## File Structure

```
apps/provenancekit-app/
├── app/
│   ├── layout.tsx                         # Root — SessionProvider + QueryProvider
│   ├── page.tsx                           # Redirects /dashboard or /login
│   ├── (auth)/
│   │   ├── layout.tsx                     # Centered card layout
│   │   └── login/page.tsx                 # OAuth buttons + magic link form
│   ├── (dashboard)/
│   │   ├── layout.tsx                     # Sidebar + top-nav (auth guard)
│   │   ├── dashboard/page.tsx             # Activity overview + org list
│   │   └── [orgSlug]/
│   │       ├── layout.tsx                 # Org context (switcher, org nav)
│   │       ├── page.tsx                   # Org overview + project list
│   │       ├── settings/page.tsx          # Rename, danger zone
│   │       ├── members/page.tsx           # Invite + role management
│   │       └── [projectSlug]/
│   │           ├── layout.tsx             # Project context + project nav
│   │           ├── page.tsx               # Project stats
│   │           ├── api-keys/page.tsx      # List keys; create + revoke
│   │           ├── api-keys/new/page.tsx  # Create flow (show plaintext once)
│   │           ├── resources/page.tsx     # EAA resource browser
│   │           ├── provenance/page.tsx    # Provenance graph explorer
│   │           ├── analytics/page.tsx     # Usage charts
│   │           └── settings/page.tsx      # Storage, IPFS, chain config
│   └── api/
│       ├── auth/[...nextauth]/route.ts    # NextAuth handler
│       ├── mcp/route.ts                   # MCP server (JSON-RPC 2.0)
│       ├── orgs/route.ts                  # POST create org
│       ├── orgs/[orgSlug]/route.ts        # GET/PATCH/DELETE
│       ├── orgs/[orgSlug]/projects/route.ts
│       ├── projects/[id]/route.ts
│       ├── projects/[id]/api-keys/route.ts
│       └── api-keys/[id]/revoke/route.ts
├── components/
│   ├── layout/
│   │   ├── sidebar.tsx                    # Context-aware nav (global → org → project)
│   │   ├── top-nav.tsx
│   │   └── org-switcher.tsx
│   ├── api-keys/
│   │   ├── create-api-key-form.tsx
│   │   └── revoke-key-button.tsx
│   ├── org/
│   │   ├── create-org-form.tsx
│   │   └── org-settings-form.tsx
│   ├── project/
│   │   └── create-project-form.tsx
│   ├── settings/
│   │   └── project-settings-form.tsx
│   ├── auth/
│   │   └── login-form.tsx
│   └── ui/                               # shadcn/ui primitives
├── lib/
│   ├── auth.ts                           # NextAuth v5 config
│   ├── db/
│   │   ├── schema.ts
│   │   └── client.ts
│   ├── api-keys.ts                       # generateApiKey, hashApiKey, validateApiKey
│   ├── permissions.ts                    # requireRole, canPerform
│   ├── queries.ts                        # Server-side Drizzle queries
│   └── utils.ts                          # cn, slugify, formatDate, truncateCid
└── types/
    ├── index.ts
    └── next-auth.d.ts                    # session.user.id augmentation
```

---

## API Key Design

```
Format:    pk_live_<64 random hex chars>
Stored:    SHA-256(key) — never plaintext
Display:   prefix (first 8 chars) shown in UI; full key shown exactly once on creation
Scopes:    read | write | admin
Validation: constant-time comparison via crypto.timingSafeEqual
```

---

## MCP Server

Endpoint: `POST /api/mcp`
Auth: `Authorization: Bearer pk_live_<admin-key>`
Protocol: JSON-RPC 2.0, Streamable HTTP (2025-03-26 spec)

Implemented as plain JSON-RPC 2.0 (not using `@modelcontextprotocol/sdk`) because the SDK's
`StreamableHTTPServerTransport` expects Node.js `IncomingMessage`/`ServerResponse`, which is
incompatible with Next.js App Router's Web Fetch API `Request`/`Response`.

Tools:
- `list_organizations` — list orgs accessible to the key
- `list_projects` — list projects in an org
- `list_api_keys` — list keys for a project (no secrets returned)
- `create_api_key` — create key; returns plaintext once
- `get_usage_summary` — API call counts for a project
- `create_organization` — create a new org
- `create_project` — create a project with storage/chain config

---

## Environment Variables

```env
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000

GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

RESEND_API_KEY=
EMAIL_FROM=noreply@yourdomain.com

DATABASE_URL=postgresql://user:pass@localhost:5432/provenancekit_app

PROVENANCEKIT_API_URL=http://localhost:8787
```

---

## Implementation Notes

- Sessions go through NextAuth's JWT strategy by default; switch to DB sessions for multi-device invalidation
- `middleware.ts` uses `auth()` from NextAuth v5 to protect all routes except `/`, `/login`, `/api/auth`, `/api/mcp`
- Org/project slugs are auto-generated from the name using `slugify()` + uniqueness check
- `lib/queries.ts` holds all server-side DB queries — keeps pages thin and testable
- The `api-keys/new` page polls for the newly created key in React state and clears it on navigation away (show-once UX)
