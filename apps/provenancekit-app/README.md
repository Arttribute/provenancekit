# ProvenanceKit Dashboard

The web interface for managing your ProvenanceKit projects. Create organizations, issue API keys, inspect provenance records, and configure how your content is stored and tracked.

## Getting started

### 1. Install dependencies (from monorepo root)

```bash
pnpm install
```

### 2. Set up environment variables

```bash
cp .env.example .env.local
```

You need a PostgreSQL database, at least one OAuth provider (GitHub or Google), and optionally Resend for magic-link email login.

### 3. Push the database schema

```bash
pnpm db:push
```

### 4. Run the development server

```bash
pnpm dev
# http://localhost:3000
```

## What you can do

**Organizations** — Group your projects under a team. Invite collaborators with fine-grained roles (owner, admin, developer, viewer).

**Projects** — Each project is a provenance namespace with its own storage backend, IPFS config, and blockchain settings. Configure these under Project → Settings.

**API keys** — Generate scoped API keys (`pk_live_*`) for your apps to call the ProvenanceKit API. The full key is shown exactly once — copy it to your app's environment variables.

**Resource explorer** — Browse every provenance record (entities, actions, resources, attributions) stored in a project.

**Provenance graph** — Visualize the full attribution chain for any content CID.

**Analytics** — Track API call volume and resource counts per project.

## Using the MCP server

AI agents (Claude, Cursor, etc.) can manage your dashboard programmatically. Add the MCP server to your agent config with an admin API key:

```json
{
  "mcpServers": {
    "provenancekit": {
      "url": "http://localhost:3000/api/mcp",
      "headers": { "Authorization": "Bearer pk_live_your_admin_key" }
    }
  }
}
```

Available agent actions: list orgs/projects/keys, create org, create project, create API key, get usage summary.

## Environment variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Random secret for session signing |
| `NEXTAUTH_URL` | App URL (e.g. `http://localhost:3000`) |
| `GITHUB_CLIENT_ID/SECRET` | GitHub OAuth app credentials |
| `GOOGLE_CLIENT_ID/SECRET` | Google OAuth app credentials |
| `RESEND_API_KEY` | For magic-link email login (optional) |
| `EMAIL_FROM` | Sender address for magic-link emails |
| `PROVENANCEKIT_API_URL` | URL of your provenancekit-api instance |

## Scripts

| Command | What it does |
|---------|-------------|
| `pnpm dev` | Start development server |
| `pnpm build` | Production build |
| `pnpm db:push` | Push Drizzle schema to database (dev) |
| `pnpm db:migrate` | Run migrations (production) |
| `pnpm db:studio` | Open Drizzle Studio (DB browser) |
