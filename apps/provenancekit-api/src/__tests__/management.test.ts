/**
 * Management API — Integration Tests
 *
 * Tests all /management/* control plane routes using an in-memory PGlite
 * database. No external services (Supabase, Postgres) required.
 *
 * Strategy:
 * - @electric-sql/pglite provides in-memory PostgreSQL (real SQL semantics)
 * - vi.mock("../db/index.js") replaces getDb() with a PGlite-backed drizzle instance
 * - MANAGEMENT_API_KEY is set in process.env for each test
 * - createApp({ authProviders: [] }) disables pk_live_ key auth
 * - Tables are truncated between tests for clean isolation
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "../db/schema.js";

// ─── Mock Setup ───────────────────────────────────────────────────────────────

// vi.hoisted runs before module evaluation so factories can reference the mock
const { mockGetDb } = vi.hoisted(() => ({ mockGetDb: vi.fn() }));

// Replace the real Postgres-backed getDb() with our PGlite instance
vi.mock("../db/index.js", () => ({ getDb: mockGetDb }));

// Prevent main() from binding a real HTTP port in the test process
vi.mock("@hono/node-server", () => ({ serve: vi.fn() }));

// Provenance storage context — not used by management routes, but createApp needs it
vi.mock("../context.js", () => ({
  getContext: vi.fn().mockReturnValue({
    dbStorage: null,
    fileStorage: null,
    encryptedStorage: null,
    ipfsGateway: null,
    supabase: null,
    generateKey: () => new Uint8Array(32),
    serverSigningKey: undefined,
    serverPublicKey: undefined,
    blockchain: undefined,
    attestationProvider: undefined,
  }),
  initializeContext: vi.fn().mockResolvedValue({}),
  closeContext: vi.fn().mockResolvedValue(undefined),
}));

// Prevent Xenova transformer model downloads
vi.mock("../embedding/service.js", () => ({
  EmbeddingService: vi.fn().mockImplementation(() => ({
    vector: vi.fn().mockResolvedValue(new Array(512).fill(0)),
    store: vi.fn().mockResolvedValue(undefined),
    storeEncrypted: vi.fn().mockResolvedValue(undefined),
    warmup: vi.fn(),
  })),
}));

// Import createApp after mocks are registered
const { createApp } = await import("../index.js");

// ─── In-Memory Database Setup ─────────────────────────────────────────────────

/**
 * Combined DDL for all management tables (mirrors migrations 0000 + 0001).
 * Written as a single CREATE TABLE block so we can stand up a clean schema
 * in PGlite without running the Drizzle migration runner.
 */
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS app_users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  privy_did   text NOT NULL,
  email       text,
  wallet      text,
  name        text,
  avatar      text,
  created_at  timestamp DEFAULT now() NOT NULL,
  updated_at  timestamp DEFAULT now() NOT NULL,
  CONSTRAINT app_users_privy_did_unique UNIQUE(privy_did)
);

CREATE TABLE IF NOT EXISTS app_organizations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  name        text NOT NULL,
  slug        text NOT NULL,
  plan        text DEFAULT 'free' NOT NULL,
  owner_id    text NOT NULL,
  created_at  timestamp DEFAULT now() NOT NULL,
  updated_at  timestamp DEFAULT now() NOT NULL,
  CONSTRAINT app_organizations_slug_unique UNIQUE(slug)
);

CREATE TABLE IF NOT EXISTS app_org_members (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  org_id    uuid NOT NULL REFERENCES app_organizations(id) ON DELETE CASCADE,
  user_id   text NOT NULL,
  role      text DEFAULT 'developer' NOT NULL,
  joined_at timestamp DEFAULT now() NOT NULL,
  CONSTRAINT uq_org_member UNIQUE(org_id, user_id)
);

CREATE TABLE IF NOT EXISTS app_projects (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  org_id            uuid NOT NULL REFERENCES app_organizations(id) ON DELETE CASCADE,
  name              text NOT NULL,
  slug              text NOT NULL,
  description       text,
  storage_type      text DEFAULT 'supabase',
  ipfs_provider     text DEFAULT 'pinata',
  ipfs_api_key      text,
  ipfs_gateway      text,
  api_url           text,
  chain_id          integer,
  contract_address  text,
  rpc_url           text,
  ai_training_opt_out boolean DEFAULT false NOT NULL,
  created_at        timestamp DEFAULT now() NOT NULL,
  updated_at        timestamp DEFAULT now() NOT NULL,
  CONSTRAINT uq_project_slug UNIQUE(org_id, slug)
);

CREATE TABLE IF NOT EXISTS app_api_keys (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  project_id  uuid NOT NULL REFERENCES app_projects(id) ON DELETE CASCADE,
  name        text NOT NULL,
  key_hash    text NOT NULL,
  prefix      text NOT NULL,
  permissions text DEFAULT 'read' NOT NULL,
  expires_at  timestamp,
  last_used_at timestamp,
  revoked_at  timestamp,
  created_at  timestamp DEFAULT now() NOT NULL,
  CONSTRAINT app_api_keys_key_hash_unique UNIQUE(key_hash)
);

CREATE TABLE IF NOT EXISTS app_usage_records (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  project_id    uuid NOT NULL,
  api_key_id    uuid,
  endpoint      text NOT NULL,
  resource_type text,
  status_code   integer,
  timestamp     timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS pk_api_entity_flags (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  entity_id   text NOT NULL,
  flag        text NOT NULL,
  reason      text,
  flagged_by  text,
  created_at  timestamp DEFAULT now() NOT NULL,
  expires_at  timestamp,
  CONSTRAINT pk_api_entity_flags_entity_id_unique UNIQUE(entity_id)
);
`;

// Single PGlite instance shared across all tests (fast; reset via TRUNCATE)
let pglite: PGlite;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let testDb: ReturnType<typeof drizzle<typeof schema>>;

beforeAll(async () => {
  pglite = new PGlite();
  testDb = drizzle(pglite, { schema }) as ReturnType<typeof drizzle<typeof schema>>;
  await pglite.exec(SCHEMA_SQL);
  // Wire mock to always return the PGlite drizzle instance
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockGetDb.mockReturnValue(testDb as any);
});

beforeEach(async () => {
  // Truncate in reverse FK order for clean test isolation
  await pglite.exec(`
    TRUNCATE app_api_keys,
             app_usage_records,
             app_projects,
             app_org_members,
             app_organizations,
             app_users,
             pk_api_entity_flags
    RESTART IDENTITY CASCADE
  `);
  // Restore management key before each test (some auth tests delete it)
  process.env.MANAGEMENT_API_KEY = "test-management-secret";
});

// ─── Request Helpers ──────────────────────────────────────────────────────────

const MGMT_KEY = "test-management-secret";

function mgmtHeaders(userId = "user:alice"): HeadersInit {
  return {
    Authorization: `Bearer ${MGMT_KEY}`,
    "X-User-Id": userId,
    "Content-Type": "application/json",
  };
}

// Headers without X-User-Id (for system-level endpoints)
const SYSTEM_HEADERS: HeadersInit = {
  Authorization: `Bearer ${MGMT_KEY}`,
  "Content-Type": "application/json",
};

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe("Management API", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    app = createApp({ authProviders: [] });
  });

  // ─── Authentication ────────────────────────────────────────────────────────

  describe("Authentication", () => {
    it("returns 401 when Authorization header is missing", async () => {
      const res = await app.request("/management/users/me", {
        headers: { "X-User-Id": "user:alice" },
      });
      expect(res.status).toBe(401);
    });

    it("returns 401 when management key is wrong", async () => {
      const res = await app.request("/management/users/me", {
        headers: { Authorization: "Bearer wrong-secret", "X-User-Id": "user:alice" },
      });
      expect(res.status).toBe(401);
    });

    it("returns 503 when MANAGEMENT_API_KEY env is not configured", async () => {
      delete process.env.MANAGEMENT_API_KEY;
      const res = await app.request("/management/users/me", {
        headers: { Authorization: "Bearer any-key", "X-User-Id": "user:alice" },
      });
      expect(res.status).toBe(503);
    });

    it("accepts correct Bearer token", async () => {
      const res = await app.request("/management/users/me", {
        headers: mgmtHeaders(),
      });
      // 404 is expected (user not in DB yet) — the point is it passed auth
      expect([200, 404]).toContain(res.status);
    });
  });

  // ─── Users ────────────────────────────────────────────────────────────────

  describe("Users", () => {
    it("PUT /management/users/me creates a new user (201)", async () => {
      const res = await app.request("/management/users/me", {
        method: "PUT",
        headers: mgmtHeaders(),
        body: JSON.stringify({ name: "Alice", email: "alice@example.com" }),
      });
      expect(res.status).toBe(201);
      const body = await res.json() as Record<string, unknown>;
      expect(body.privyDid).toBe("user:alice");
      expect(body.name).toBe("Alice");
      expect(body.email).toBe("alice@example.com");
    });

    it("PUT /management/users/me updates an existing user (200)", async () => {
      await app.request("/management/users/me", {
        method: "PUT",
        headers: mgmtHeaders(),
        body: JSON.stringify({ name: "Alice" }),
      });
      const res = await app.request("/management/users/me", {
        method: "PUT",
        headers: mgmtHeaders(),
        body: JSON.stringify({ name: "Alice Updated", email: "alice@example.com" }),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as Record<string, unknown>;
      expect(body.name).toBe("Alice Updated");
    });

    it("PUT /management/users/me accepts null for optional fields", async () => {
      const res = await app.request("/management/users/me", {
        method: "PUT",
        headers: mgmtHeaders(),
        body: JSON.stringify({ name: null, email: null, avatar: null }),
      });
      expect(res.status).toBe(201);
    });

    it("PUT /management/users/me returns 400 on invalid email", async () => {
      const res = await app.request("/management/users/me", {
        method: "PUT",
        headers: mgmtHeaders(),
        body: JSON.stringify({ email: "not-an-email" }),
      });
      expect(res.status).toBe(400);
    });

    it("GET /management/users/me returns the current user", async () => {
      await app.request("/management/users/me", {
        method: "PUT",
        headers: mgmtHeaders(),
        body: JSON.stringify({ name: "Alice" }),
      });
      const res = await app.request("/management/users/me", {
        headers: mgmtHeaders(),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as Record<string, unknown>;
      expect(body.privyDid).toBe("user:alice");
    });

    it("GET /management/users/me returns 404 when user does not exist", async () => {
      const res = await app.request("/management/users/me", {
        headers: mgmtHeaders("user:nonexistent"),
      });
      expect(res.status).toBe(404);
    });
  });

  // ─── Organizations ────────────────────────────────────────────────────────

  describe("Organizations", () => {
    it("POST /management/orgs creates org and makes creator the owner", async () => {
      const res = await app.request("/management/orgs", {
        method: "POST",
        headers: mgmtHeaders(),
        body: JSON.stringify({ name: "Acme Corp", slug: "acme" }),
      });
      expect(res.status).toBe(201);
      const body = await res.json() as Record<string, unknown>;
      expect(body.name).toBe("Acme Corp");
      expect(body.slug).toBe("acme");
      expect(body.role).toBe("owner");
    });

    it("POST /management/orgs returns 409 on slug conflict", async () => {
      await app.request("/management/orgs", {
        method: "POST",
        headers: mgmtHeaders(),
        body: JSON.stringify({ name: "Acme", slug: "acme" }),
      });
      const res = await app.request("/management/orgs", {
        method: "POST",
        headers: mgmtHeaders(),
        body: JSON.stringify({ name: "Acme 2", slug: "acme" }),
      });
      expect(res.status).toBe(409);
    });

    it("POST /management/orgs returns 400 for slug with uppercase letters", async () => {
      const res = await app.request("/management/orgs", {
        method: "POST",
        headers: mgmtHeaders(),
        body: JSON.stringify({ name: "Acme", slug: "ACME" }),
      });
      expect(res.status).toBe(400);
    });

    it("POST /management/orgs returns 400 for slug with spaces", async () => {
      const res = await app.request("/management/orgs", {
        method: "POST",
        headers: mgmtHeaders(),
        body: JSON.stringify({ name: "Acme", slug: "my org" }),
      });
      expect(res.status).toBe(400);
    });

    it("GET /management/orgs lists all orgs for the current user", async () => {
      await app.request("/management/orgs", {
        method: "POST",
        headers: mgmtHeaders(),
        body: JSON.stringify({ name: "Org 1", slug: "org-1" }),
      });
      await app.request("/management/orgs", {
        method: "POST",
        headers: mgmtHeaders(),
        body: JSON.stringify({ name: "Org 2", slug: "org-2" }),
      });
      const res = await app.request("/management/orgs", { headers: mgmtHeaders() });
      expect(res.status).toBe(200);
      const body = await res.json() as unknown[];
      expect(body.length).toBe(2);
    });

    it("GET /management/orgs returns empty array for user with no orgs", async () => {
      const res = await app.request("/management/orgs", {
        headers: mgmtHeaders("user:nobody"),
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual([]);
    });

    it("GET /management/orgs does not expose orgs the user is not a member of", async () => {
      // Alice creates org
      await app.request("/management/orgs", {
        method: "POST",
        headers: mgmtHeaders("user:alice"),
        body: JSON.stringify({ name: "Alice Org", slug: "alice-org" }),
      });
      // Bob queries — should see empty
      const res = await app.request("/management/orgs", { headers: mgmtHeaders("user:bob") });
      expect(await res.json()).toEqual([]);
    });

    it("GET /management/orgs/:slug returns org with role for member", async () => {
      await app.request("/management/orgs", {
        method: "POST",
        headers: mgmtHeaders(),
        body: JSON.stringify({ name: "Acme", slug: "acme" }),
      });
      const res = await app.request("/management/orgs/acme", { headers: mgmtHeaders() });
      expect(res.status).toBe(200);
      const body = await res.json() as Record<string, unknown>;
      expect(body.slug).toBe("acme");
      expect(body.role).toBe("owner");
    });

    it("GET /management/orgs/:slug returns 404 for non-member", async () => {
      await app.request("/management/orgs", {
        method: "POST",
        headers: mgmtHeaders("user:alice"),
        body: JSON.stringify({ name: "Acme", slug: "acme" }),
      });
      const res = await app.request("/management/orgs/acme", {
        headers: mgmtHeaders("user:stranger"),
      });
      expect(res.status).toBe(404);
    });

    it("PUT /management/orgs/:slug updates the org name (admin+)", async () => {
      await app.request("/management/orgs", {
        method: "POST",
        headers: mgmtHeaders(),
        body: JSON.stringify({ name: "Acme", slug: "acme" }),
      });
      const res = await app.request("/management/orgs/acme", {
        method: "PUT",
        headers: mgmtHeaders(),
        body: JSON.stringify({ name: "Acme Updated" }),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as Record<string, unknown>;
      expect(body.name).toBe("Acme Updated");
    });

    it("PUT /management/orgs/:slug returns 403 for viewer role", async () => {
      await app.request("/management/orgs", {
        method: "POST",
        headers: mgmtHeaders("user:alice"),
        body: JSON.stringify({ name: "Acme", slug: "acme" }),
      });
      await app.request("/management/orgs/acme/members", {
        method: "POST",
        headers: mgmtHeaders("user:alice"),
        body: JSON.stringify({ userId: "user:viewer", role: "viewer" }),
      });
      const res = await app.request("/management/orgs/acme", {
        method: "PUT",
        headers: mgmtHeaders("user:viewer"),
        body: JSON.stringify({ name: "Hijacked" }),
      });
      expect(res.status).toBe(403);
    });

    it("DELETE /management/orgs/:slug deletes org (owner only)", async () => {
      await app.request("/management/orgs", {
        method: "POST",
        headers: mgmtHeaders(),
        body: JSON.stringify({ name: "Acme", slug: "acme" }),
      });
      const res = await app.request("/management/orgs/acme", {
        method: "DELETE",
        headers: mgmtHeaders(),
      });
      expect(res.status).toBe(200);
      expect((await res.json() as Record<string, unknown>).deleted).toBe(true);
    });

    it("DELETE /management/orgs/:slug returns 403 for admin (not owner)", async () => {
      await app.request("/management/orgs", {
        method: "POST",
        headers: mgmtHeaders("user:alice"),
        body: JSON.stringify({ name: "Acme", slug: "acme" }),
      });
      await app.request("/management/orgs/acme/members", {
        method: "POST",
        headers: mgmtHeaders("user:alice"),
        body: JSON.stringify({ userId: "user:admin", role: "admin" }),
      });
      const res = await app.request("/management/orgs/acme", {
        method: "DELETE",
        headers: mgmtHeaders("user:admin"),
      });
      expect(res.status).toBe(403);
    });
  });

  // ─── Members ──────────────────────────────────────────────────────────────

  describe("Members", () => {
    beforeEach(async () => {
      await app.request("/management/orgs", {
        method: "POST",
        headers: mgmtHeaders("user:alice"),
        body: JSON.stringify({ name: "Acme", slug: "acme" }),
      });
    });

    it("GET /management/orgs/:slug/members lists all members", async () => {
      const res = await app.request("/management/orgs/acme/members", {
        headers: mgmtHeaders("user:alice"),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as unknown[];
      expect(body.length).toBe(1); // creator is the only member
    });

    it("POST /management/orgs/:slug/members adds a new member", async () => {
      const res = await app.request("/management/orgs/acme/members", {
        method: "POST",
        headers: mgmtHeaders("user:alice"),
        body: JSON.stringify({ userId: "user:bob", role: "developer" }),
      });
      expect(res.status).toBe(201);
      const body = await res.json() as Record<string, unknown>;
      expect(body.userId).toBe("user:bob");
      expect(body.role).toBe("developer");
    });

    it("POST /management/orgs/:slug/members defaults role to developer", async () => {
      const res = await app.request("/management/orgs/acme/members", {
        method: "POST",
        headers: mgmtHeaders("user:alice"),
        body: JSON.stringify({ userId: "user:bob" }),
      });
      expect(res.status).toBe(201);
      expect((await res.json() as Record<string, unknown>).role).toBe("developer");
    });

    it("POST /management/orgs/:slug/members returns 409 for duplicate member", async () => {
      await app.request("/management/orgs/acme/members", {
        method: "POST",
        headers: mgmtHeaders("user:alice"),
        body: JSON.stringify({ userId: "user:bob", role: "developer" }),
      });
      const res = await app.request("/management/orgs/acme/members", {
        method: "POST",
        headers: mgmtHeaders("user:alice"),
        body: JSON.stringify({ userId: "user:bob", role: "viewer" }),
      });
      expect(res.status).toBe(409);
    });

    it("POST /management/orgs/:slug/members returns 403 for developer role", async () => {
      await app.request("/management/orgs/acme/members", {
        method: "POST",
        headers: mgmtHeaders("user:alice"),
        body: JSON.stringify({ userId: "user:dev", role: "developer" }),
      });
      const res = await app.request("/management/orgs/acme/members", {
        method: "POST",
        headers: mgmtHeaders("user:dev"),
        body: JSON.stringify({ userId: "user:newbie", role: "viewer" }),
      });
      expect(res.status).toBe(403);
    });

    it("DELETE /management/orgs/:slug/members/:uid removes a member (admin)", async () => {
      await app.request("/management/orgs/acme/members", {
        method: "POST",
        headers: mgmtHeaders("user:alice"),
        body: JSON.stringify({ userId: "user:bob", role: "developer" }),
      });
      const res = await app.request("/management/orgs/acme/members/user:bob", {
        method: "DELETE",
        headers: mgmtHeaders("user:alice"),
      });
      expect(res.status).toBe(200);
      expect((await res.json() as Record<string, unknown>).deleted).toBe(true);
    });

    it("DELETE /management/orgs/:slug/members/:uid allows self-removal", async () => {
      await app.request("/management/orgs/acme/members", {
        method: "POST",
        headers: mgmtHeaders("user:alice"),
        body: JSON.stringify({ userId: "user:bob", role: "developer" }),
      });
      const res = await app.request("/management/orgs/acme/members/user:bob", {
        method: "DELETE",
        headers: mgmtHeaders("user:bob"),
      });
      expect(res.status).toBe(200);
    });

    it("DELETE /management/orgs/:slug/members/:uid returns 403 for unauthorized user", async () => {
      await app.request("/management/orgs/acme/members", {
        method: "POST",
        headers: mgmtHeaders("user:alice"),
        body: JSON.stringify({ userId: "user:bob", role: "developer" }),
      });
      await app.request("/management/orgs/acme/members", {
        method: "POST",
        headers: mgmtHeaders("user:alice"),
        body: JSON.stringify({ userId: "user:charlie", role: "developer" }),
      });
      // Charlie tries to remove Bob — not allowed (developer can only remove self)
      const res = await app.request("/management/orgs/acme/members/user:bob", {
        method: "DELETE",
        headers: mgmtHeaders("user:charlie"),
      });
      expect(res.status).toBe(403);
    });

    it("DELETE /management/orgs/:slug/members/:uid returns 400 when removing the owner", async () => {
      const res = await app.request("/management/orgs/acme/members/user:alice", {
        method: "DELETE",
        headers: mgmtHeaders("user:alice"),
      });
      expect(res.status).toBe(400);
    });
  });

  // ─── Projects ─────────────────────────────────────────────────────────────

  describe("Projects", () => {
    beforeEach(async () => {
      await app.request("/management/orgs", {
        method: "POST",
        headers: mgmtHeaders("user:alice"),
        body: JSON.stringify({ name: "Acme", slug: "acme" }),
      });
    });

    it("POST /management/orgs/:slug/projects creates a project", async () => {
      const res = await app.request("/management/orgs/acme/projects", {
        method: "POST",
        headers: mgmtHeaders("user:alice"),
        body: JSON.stringify({ name: "My App", slug: "my-app" }),
      });
      expect(res.status).toBe(201);
      const body = await res.json() as Record<string, unknown>;
      expect(body.name).toBe("My App");
      expect(body.slug).toBe("my-app");
      expect(body.orgSlug).toBe("acme");
    });

    it("POST /management/orgs/:slug/projects returns 409 for duplicate slug within org", async () => {
      await app.request("/management/orgs/acme/projects", {
        method: "POST",
        headers: mgmtHeaders("user:alice"),
        body: JSON.stringify({ name: "My App", slug: "my-app" }),
      });
      const res = await app.request("/management/orgs/acme/projects", {
        method: "POST",
        headers: mgmtHeaders("user:alice"),
        body: JSON.stringify({ name: "My App 2", slug: "my-app" }),
      });
      expect(res.status).toBe(409);
    });

    it("POST /management/orgs/:slug/projects returns 403 for viewer", async () => {
      await app.request("/management/orgs/acme/members", {
        method: "POST",
        headers: mgmtHeaders("user:alice"),
        body: JSON.stringify({ userId: "user:viewer", role: "viewer" }),
      });
      const res = await app.request("/management/orgs/acme/projects", {
        method: "POST",
        headers: mgmtHeaders("user:viewer"),
        body: JSON.stringify({ name: "Sneak App", slug: "sneak" }),
      });
      expect(res.status).toBe(403);
    });

    it("GET /management/orgs/:slug/projects lists projects", async () => {
      await app.request("/management/orgs/acme/projects", {
        method: "POST",
        headers: mgmtHeaders("user:alice"),
        body: JSON.stringify({ name: "App A", slug: "app-a" }),
      });
      await app.request("/management/orgs/acme/projects", {
        method: "POST",
        headers: mgmtHeaders("user:alice"),
        body: JSON.stringify({ name: "App B", slug: "app-b" }),
      });
      const res = await app.request("/management/orgs/acme/projects", {
        headers: mgmtHeaders("user:alice"),
      });
      expect(res.status).toBe(200);
      expect((await res.json() as unknown[]).length).toBe(2);
    });

    it("GET /management/projects/:id returns a project with orgSlug", async () => {
      const created = await app.request("/management/orgs/acme/projects", {
        method: "POST",
        headers: mgmtHeaders("user:alice"),
        body: JSON.stringify({ name: "My App", slug: "my-app" }),
      });
      const { id } = await created.json() as Record<string, unknown>;

      const res = await app.request(`/management/projects/${id}`, {
        headers: mgmtHeaders("user:alice"),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as Record<string, unknown>;
      expect(body.id).toBe(id);
      expect(body.orgSlug).toBe("acme");
    });

    it("GET /management/projects/:id returns 404 for non-member", async () => {
      const created = await app.request("/management/orgs/acme/projects", {
        method: "POST",
        headers: mgmtHeaders("user:alice"),
        body: JSON.stringify({ name: "My App", slug: "my-app" }),
      });
      const { id } = await created.json() as Record<string, unknown>;

      const res = await app.request(`/management/projects/${id}`, {
        headers: mgmtHeaders("user:bob"),
      });
      expect(res.status).toBe(404);
    });

    it("PUT /management/projects/:id updates a project", async () => {
      const created = await app.request("/management/orgs/acme/projects", {
        method: "POST",
        headers: mgmtHeaders("user:alice"),
        body: JSON.stringify({ name: "My App", slug: "my-app" }),
      });
      const { id } = await created.json() as Record<string, unknown>;

      const res = await app.request(`/management/projects/${id}`, {
        method: "PUT",
        headers: mgmtHeaders("user:alice"),
        body: JSON.stringify({ name: "My App Updated", description: "Now with description" }),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as Record<string, unknown>;
      expect(body.name).toBe("My App Updated");
      expect(body.description).toBe("Now with description");
    });

    it("PUT /management/projects/:id returns 403 for viewer", async () => {
      const created = await app.request("/management/orgs/acme/projects", {
        method: "POST",
        headers: mgmtHeaders("user:alice"),
        body: JSON.stringify({ name: "My App", slug: "my-app" }),
      });
      const { id } = await created.json() as Record<string, unknown>;

      await app.request("/management/orgs/acme/members", {
        method: "POST",
        headers: mgmtHeaders("user:alice"),
        body: JSON.stringify({ userId: "user:viewer", role: "viewer" }),
      });
      const res = await app.request(`/management/projects/${id}`, {
        method: "PUT",
        headers: mgmtHeaders("user:viewer"),
        body: JSON.stringify({ name: "Hijacked" }),
      });
      expect(res.status).toBe(403);
    });

    it("DELETE /management/projects/:id deletes a project (admin+)", async () => {
      const created = await app.request("/management/orgs/acme/projects", {
        method: "POST",
        headers: mgmtHeaders("user:alice"),
        body: JSON.stringify({ name: "My App", slug: "my-app" }),
      });
      const { id } = await created.json() as Record<string, unknown>;

      const res = await app.request(`/management/projects/${id}`, {
        method: "DELETE",
        headers: mgmtHeaders("user:alice"),
      });
      expect(res.status).toBe(200);
      expect((await res.json() as Record<string, unknown>).deleted).toBe(true);

      // Confirm project is gone
      const getRes = await app.request(`/management/projects/${id}`, {
        headers: mgmtHeaders("user:alice"),
      });
      expect(getRes.status).toBe(404);
    });

    it("DELETE /management/projects/:id returns 403 for developer role", async () => {
      const created = await app.request("/management/orgs/acme/projects", {
        method: "POST",
        headers: mgmtHeaders("user:alice"),
        body: JSON.stringify({ name: "My App", slug: "my-app" }),
      });
      const { id } = await created.json() as Record<string, unknown>;

      await app.request("/management/orgs/acme/members", {
        method: "POST",
        headers: mgmtHeaders("user:alice"),
        body: JSON.stringify({ userId: "user:dev", role: "developer" }),
      });
      const res = await app.request(`/management/projects/${id}`, {
        method: "DELETE",
        headers: mgmtHeaders("user:dev"),
      });
      expect(res.status).toBe(403);
    });
  });

  // ─── API Keys ──────────────────────────────────────────────────────────────

  describe("API Keys", () => {
    let projectId: string;

    beforeEach(async () => {
      await app.request("/management/orgs", {
        method: "POST",
        headers: mgmtHeaders("user:alice"),
        body: JSON.stringify({ name: "Acme", slug: "acme" }),
      });
      const proj = await app.request("/management/orgs/acme/projects", {
        method: "POST",
        headers: mgmtHeaders("user:alice"),
        body: JSON.stringify({ name: "My App", slug: "my-app" }),
      });
      projectId = ((await proj.json()) as Record<string, unknown>).id as string;
    });

    it("POST /management/projects/:id/api-keys creates key and returns plaintext once", async () => {
      const res = await app.request(`/management/projects/${projectId}/api-keys`, {
        method: "POST",
        headers: mgmtHeaders("user:alice"),
        body: JSON.stringify({ name: "Prod Key", permissions: "write" }),
      });
      expect(res.status).toBe(201);
      const body = await res.json() as Record<string, unknown>;
      expect(typeof body.key).toBe("string");
      expect((body.key as string).startsWith("pk_live_")).toBe(true);
      expect(body.name).toBe("Prod Key");
      expect(body.permissions).toBe("write");
      expect(body.id).toBeDefined();
      // keyHash must never be returned
      expect(body.keyHash).toBeUndefined();
    });

    it("POST /management/projects/:id/api-keys respects expiresInDays", async () => {
      const res = await app.request(`/management/projects/${projectId}/api-keys`, {
        method: "POST",
        headers: mgmtHeaders("user:alice"),
        body: JSON.stringify({ name: "Short-lived", permissions: "read", expiresInDays: 7 }),
      });
      expect(res.status).toBe(201);
    });

    it("POST /management/projects/:id/api-keys returns 403 for viewer", async () => {
      await app.request("/management/orgs/acme/members", {
        method: "POST",
        headers: mgmtHeaders("user:alice"),
        body: JSON.stringify({ userId: "user:viewer", role: "viewer" }),
      });
      const res = await app.request(`/management/projects/${projectId}/api-keys`, {
        method: "POST",
        headers: mgmtHeaders("user:viewer"),
        body: JSON.stringify({ name: "Sneaky Key", permissions: "read" }),
      });
      expect(res.status).toBe(403);
    });

    it("GET /management/projects/:id/api-keys lists keys without keyHash", async () => {
      await app.request(`/management/projects/${projectId}/api-keys`, {
        method: "POST",
        headers: mgmtHeaders("user:alice"),
        body: JSON.stringify({ name: "Key A", permissions: "read" }),
      });
      await app.request(`/management/projects/${projectId}/api-keys`, {
        method: "POST",
        headers: mgmtHeaders("user:alice"),
        body: JSON.stringify({ name: "Key B", permissions: "write" }),
      });
      const res = await app.request(`/management/projects/${projectId}/api-keys`, {
        headers: mgmtHeaders("user:alice"),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as Record<string, unknown>[];
      expect(body.length).toBe(2);
      // keyHash must never appear in the list
      for (const key of body) {
        expect(key.keyHash).toBeUndefined();
        expect(key.prefix).toBeDefined();
      }
    });

    it("DELETE /management/api-keys/:keyId revokes a key", async () => {
      const created = await app.request(`/management/projects/${projectId}/api-keys`, {
        method: "POST",
        headers: mgmtHeaders("user:alice"),
        body: JSON.stringify({ name: "My Key", permissions: "read" }),
      });
      const { id: keyId } = await created.json() as Record<string, unknown>;

      const res = await app.request(`/management/api-keys/${keyId}`, {
        method: "DELETE",
        headers: mgmtHeaders("user:alice"),
      });
      expect(res.status).toBe(200);
      expect((await res.json() as Record<string, unknown>).revoked).toBe(true);
    });

    it("DELETE /management/api-keys/:keyId returns 409 when already revoked", async () => {
      const created = await app.request(`/management/projects/${projectId}/api-keys`, {
        method: "POST",
        headers: mgmtHeaders("user:alice"),
        body: JSON.stringify({ name: "My Key", permissions: "read" }),
      });
      const { id: keyId } = await created.json() as Record<string, unknown>;

      await app.request(`/management/api-keys/${keyId}`, {
        method: "DELETE",
        headers: mgmtHeaders("user:alice"),
      });
      const res = await app.request(`/management/api-keys/${keyId}`, {
        method: "DELETE",
        headers: mgmtHeaders("user:alice"),
      });
      expect(res.status).toBe(409);
    });

    it("DELETE /management/api-keys/:keyId returns 404 for nonexistent key", async () => {
      const res = await app.request(`/management/api-keys/00000000-0000-0000-0000-000000000000`, {
        method: "DELETE",
        headers: mgmtHeaders("user:alice"),
      });
      expect(res.status).toBe(404);
    });

    it("revoked key does not appear as active in list", async () => {
      const created = await app.request(`/management/projects/${projectId}/api-keys`, {
        method: "POST",
        headers: mgmtHeaders("user:alice"),
        body: JSON.stringify({ name: "My Key", permissions: "read" }),
      });
      const { id: keyId } = await created.json() as Record<string, unknown>;

      await app.request(`/management/api-keys/${keyId}`, {
        method: "DELETE",
        headers: mgmtHeaders("user:alice"),
      });

      const list = await app.request(`/management/projects/${projectId}/api-keys`, {
        headers: mgmtHeaders("user:alice"),
      });
      const body = await list.json() as Record<string, unknown>[];
      const revokedKey = body.find((k) => k.id === keyId);
      expect(revokedKey?.revokedAt).toBeTruthy();
    });
  });

  // ─── Auth: Validate Key ───────────────────────────────────────────────────

  describe("POST /management/auth/validate-key", () => {
    let projectId: string;
    let liveKey: string;
    let keyId: string;

    beforeEach(async () => {
      await app.request("/management/orgs", {
        method: "POST",
        headers: mgmtHeaders("user:alice"),
        body: JSON.stringify({ name: "Acme", slug: "acme" }),
      });
      const proj = await app.request("/management/orgs/acme/projects", {
        method: "POST",
        headers: mgmtHeaders("user:alice"),
        body: JSON.stringify({ name: "My App", slug: "my-app" }),
      });
      projectId = ((await proj.json()) as Record<string, unknown>).id as string;

      const keyRes = await app.request(`/management/projects/${projectId}/api-keys`, {
        method: "POST",
        headers: mgmtHeaders("user:alice"),
        body: JSON.stringify({ name: "Live Key", permissions: "write" }),
      });
      const keyBody = await keyRes.json() as Record<string, unknown>;
      liveKey = keyBody.key as string;
      keyId = keyBody.id as string;
    });

    it("returns { valid: true } with project context for a valid key", async () => {
      const res = await app.request("/management/auth/validate-key", {
        method: "POST",
        headers: SYSTEM_HEADERS,
        body: JSON.stringify({ key: liveKey }),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as Record<string, unknown>;
      expect(body.valid).toBe(true);
      expect(body.projectId).toBe(projectId);
      expect(body.permissions).toBe("write");
    });

    it("returns 400 for a non-pk_live_ key format", async () => {
      const res = await app.request("/management/auth/validate-key", {
        method: "POST",
        headers: SYSTEM_HEADERS,
        body: JSON.stringify({ key: "sk_test_somethingelse" }),
      });
      expect(res.status).toBe(400);
      const body = await res.json() as Record<string, unknown>;
      expect(body.valid).toBe(false);
    });

    it("returns { valid: false } for a non-existent key", async () => {
      const res = await app.request("/management/auth/validate-key", {
        method: "POST",
        headers: SYSTEM_HEADERS,
        body: JSON.stringify({ key: "pk_live_" + "a".repeat(64) }),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as Record<string, unknown>;
      expect(body.valid).toBe(false);
    });

    it("returns { valid: false, reason: 'Key revoked' } for a revoked key", async () => {
      await app.request(`/management/api-keys/${keyId}`, {
        method: "DELETE",
        headers: mgmtHeaders("user:alice"),
      });
      const res = await app.request("/management/auth/validate-key", {
        method: "POST",
        headers: SYSTEM_HEADERS,
        body: JSON.stringify({ key: liveKey }),
      });
      const body = await res.json() as Record<string, unknown>;
      expect(body.valid).toBe(false);
      expect(body.reason).toBe("Key revoked");
    });

    it("does not require X-User-Id header", async () => {
      // validate-key is a system endpoint — should work without user context
      const res = await app.request("/management/auth/validate-key", {
        method: "POST",
        headers: SYSTEM_HEADERS, // no X-User-Id
        body: JSON.stringify({ key: liveKey }),
      });
      expect(res.status).toBe(200);
    });
  });

  // ─── Usage ────────────────────────────────────────────────────────────────

  describe("GET /management/projects/:id/usage", () => {
    it("returns summary and empty daily breakdown for a new project", async () => {
      await app.request("/management/orgs", {
        method: "POST",
        headers: mgmtHeaders("user:alice"),
        body: JSON.stringify({ name: "Acme", slug: "acme" }),
      });
      const proj = await app.request("/management/orgs/acme/projects", {
        method: "POST",
        headers: mgmtHeaders("user:alice"),
        body: JSON.stringify({ name: "My App", slug: "my-app" }),
      });
      const { id } = await proj.json() as Record<string, unknown>;

      const res = await app.request(`/management/projects/${id}/usage`, {
        headers: mgmtHeaders("user:alice"),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as Record<string, unknown>;
      expect(body.summary).toBeDefined();
      expect((body.summary as Record<string, unknown>).totalCalls).toBe(0);
      expect(Array.isArray(body.byDay)).toBe(true);
    });

    it("returns 404 for project the user is not a member of", async () => {
      await app.request("/management/orgs", {
        method: "POST",
        headers: mgmtHeaders("user:alice"),
        body: JSON.stringify({ name: "Acme", slug: "acme" }),
      });
      const proj = await app.request("/management/orgs/acme/projects", {
        method: "POST",
        headers: mgmtHeaders("user:alice"),
        body: JSON.stringify({ name: "My App", slug: "my-app" }),
      });
      const { id } = await proj.json() as Record<string, unknown>;

      const res = await app.request(`/management/projects/${id}/usage`, {
        headers: mgmtHeaders("user:stranger"),
      });
      expect(res.status).toBe(404);
    });
  });

  // ─── Network ──────────────────────────────────────────────────────────────

  describe("GET /management/network", () => {
    it("returns { configured: false } when no blockchain context is configured", async () => {
      const res = await app.request("/management/network", {
        headers: SYSTEM_HEADERS,
      });
      expect(res.status).toBe(200);
      const body = await res.json() as Record<string, unknown>;
      expect(body.configured).toBe(false);
    });
  });
});
