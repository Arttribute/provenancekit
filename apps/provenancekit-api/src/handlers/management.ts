/**
 * Management API — control plane for the ProvenanceKit dashboard.
 *
 * All routes require management authentication (see middleware/management-auth.ts):
 *   Authorization: Bearer <MANAGEMENT_API_KEY>
 *   X-User-Id:     <userId>    (opaque — today Privy DID, tomorrow any auth provider)
 *
 * Security model:
 *   - MANAGEMENT_API_KEY ensures only the app server can call these endpoints
 *   - The app verifies the user (via Privy or any auth) before forwarding their ID
 *   - All business logic validates org membership before every operation
 *
 * Endpoints:
 *   Users
 *     GET  /management/users/me                → get user record
 *     PUT  /management/users/me                → upsert user (call on login)
 *
 *   Organizations
 *     GET  /management/orgs                    → list orgs for current user
 *     POST /management/orgs                    → create org
 *     GET  /management/orgs/:slug              → get org (membership required)
 *     PUT  /management/orgs/:slug              → update org (admin+)
 *     DELETE /management/orgs/:slug            → delete org (owner only)
 *
 *   Members
 *     GET  /management/orgs/:slug/members      → list members
 *     POST /management/orgs/:slug/members      → add member (admin+)
 *     DELETE /management/orgs/:slug/members/:uid → remove member (admin+)
 *
 *   Projects
 *     GET  /management/orgs/:slug/projects     → list projects
 *     POST /management/orgs/:slug/projects     → create project
 *     GET  /management/projects/:id            → get project
 *     PUT  /management/projects/:id            → update project (developer+)
 *     DELETE /management/projects/:id          → delete project (admin+)
 *
 *   API Keys
 *     GET  /management/projects/:id/api-keys   → list keys (hashes excluded)
 *     POST /management/projects/:id/api-keys   → create key (plaintext returned once)
 *     DELETE /management/api-keys/:keyId       → revoke key
 *
 *   Usage
 *     GET  /management/projects/:id/usage      → summary + daily breakdown (30 days)
 *
 *   Auth utilities (no X-User-Id required)
 *     POST /management/auth/validate-key       → validate pk_live_ key, return context
 */

import { Hono } from "hono";
import { z } from "zod";
import { eq, and, inArray, desc, count, gte, sql } from "drizzle-orm";
import { createHash, randomBytes } from "crypto";
import { getDb } from "../db/index.js";
import { getContext } from "../context.js";
import {
  appUsers,
  appOrganizations,
  appOrgMembers,
  appProjects,
  appApiKeys,
  appUsageRecords,
} from "../db/schema.js";
import { getMgmtUserId } from "../middleware/management-auth.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function db() {
  const d = getDb();
  if (!d) throw new Error("Database not configured");
  return d;
}

/** Generate a new pk_live_ API key. Returns plaintext (shown once) + hash + prefix. */
function generateApiKey() {
  const raw = randomBytes(32).toString("hex");
  const key = `pk_live_${raw}`;
  const keyHash = createHash("sha256").update(key).digest("hex");
  const prefix = key.slice(0, 16); // "pk_live_" + 8 hex chars
  return { key, keyHash, prefix };
}

/** Role hierarchy — higher number = more privileges. */
const ROLE_RANK: Record<string, number> = {
  owner: 3,
  admin: 2,
  developer: 1,
  viewer: 0,
};

function hasRole(userRole: string, required: string): boolean {
  return (ROLE_RANK[userRole] ?? -1) >= (ROLE_RANK[required] ?? 0);
}

/**
 * Resolve an org by slug and verify the current user is a member.
 * Returns { org, membership } or null if not found / not a member.
 */
async function resolveOrgMembership(slug: string, userId: string) {
  const database = db();
  const [org] = await database
    .select()
    .from(appOrganizations)
    .where(eq(appOrganizations.slug, slug))
    .limit(1);
  if (!org) return null;

  const [member] = await database
    .select()
    .from(appOrgMembers)
    .where(and(eq(appOrgMembers.orgId, org.id), eq(appOrgMembers.userId, userId)))
    .limit(1);
  if (!member) return null;

  return { org, membership: member };
}

/**
 * Resolve a project by ID and verify the current user has org membership.
 * Returns { project, membership } or null.
 */
async function resolveProjectMembership(projectId: string, userId: string) {
  const database = db();
  const [project] = await database
    .select()
    .from(appProjects)
    .where(eq(appProjects.id, projectId))
    .limit(1);
  if (!project) return null;

  const [member] = await database
    .select()
    .from(appOrgMembers)
    .where(and(eq(appOrgMembers.orgId, project.orgId), eq(appOrgMembers.userId, userId)))
    .limit(1);
  if (!member) return null;

  return { project, membership: member };
}

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const UpsertUserSchema = z.object({
  email:  z.string().email().optional().nullable(),
  name:   z.string().max(128).optional().nullable(),
  avatar: z.string().url().optional().nullable(),
  wallet: z.string().optional().nullable(),
});

const CreateOrgSchema = z.object({
  name: z.string().min(2).max(64),
  slug: z.string().min(2).max(40).regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens"),
});

const UpdateOrgSchema = z.object({
  name: z.string().min(2).max(64).optional(),
});

const AddMemberSchema = z.object({
  userId: z.string().min(1),                                // opaque user identifier
  role: z.enum(["admin", "developer", "viewer"]).default("developer"),
});

const CreateProjectSchema = z.object({
  name:            z.string().min(1).max(64),
  slug:            z.string().min(1).max(40).regex(/^[a-z0-9-]+$/),
  description:     z.string().max(500).optional().nullable(),

  // Advisory label — describes what DB adapter a self-hosted provenancekit-api
  // is using for EAA provenance records. Has no effect on the hosted API.
  storageType:     z.enum(["memory", "postgres", "mongodb", "supabase", "ipfs", "custom"]).optional(),

  // Per-project IPFS / file storage config.
  // When set, the ProvenanceKit API uses these credentials for file uploads
  // belonging to this project (rather than platform-level defaults).
  ipfsProvider:    z.string().optional().nullable(),
  ipfsApiKey:      z.string().optional().nullable(),
  ipfsGateway:     z.string().url().optional().nullable().or(z.literal("")),

  // Self-hosted API URL. If set, the SDK and dashboard use this endpoint
  // instead of the hosted api.provenancekit.com.
  apiUrl:          z.string().url().optional().nullable().or(z.literal("")),

  // On-chain config — used for ProvenanceRegistry recording.
  chainId:         z.number().int().optional().nullable(),
  contractAddress: z.string().optional().nullable(),
  rpcUrl:          z.string().url().optional().nullable().or(z.literal("")),

  // Privacy
  // When true, ext:license@1.0.0 / hasAITrainingReservation: true is attached
  // to every resource uploaded via this project's API key.
  aiTrainingOptOut: z.boolean().optional(),
});

const UpdateProjectSchema = CreateProjectSchema.partial();

const CreateKeySchema = z.object({
  name:          z.string().min(1).max(64),
  permissions:   z.enum(["read", "write", "admin"]).default("read"),
  expiresInDays: z.number().int().min(1).max(365).optional().nullable(),
});

// ---------------------------------------------------------------------------
// Manual zod validation (matching the pattern used elsewhere in this API)
// ---------------------------------------------------------------------------

function parseBody<T>(schema: z.ZodSchema<T>, body: unknown): { data: T } | { error: Record<string, unknown> } {
  const result = schema.safeParse(body);
  if (!result.success) return { error: result.error.flatten().fieldErrors };
  return { data: result.data };
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const management = new Hono();

// ─── Users ────────────────────────────────────────────────────────────────────

/** GET /management/users/me — return the current user record */
management.get("/users/me", async (c) => {
  const userId = getMgmtUserId(c);
  const [user] = await db()
    .select()
    .from(appUsers)
    .where(eq(appUsers.privyDid, userId))
    .limit(1);
  if (!user) return c.json({ error: "User not found" }, 404);
  return c.json(user);
});

/**
 * PUT /management/users/me
 * Upsert the current user record. Call this on every login to keep profile in sync.
 */
management.put("/users/me", async (c) => {
  const userId = getMgmtUserId(c);
  const body = await c.req.json().catch(() => null);
  const parsed = parseBody(UpsertUserSchema, body);
  if ("error" in parsed) return c.json({ error: parsed.error }, 400);

  const database = db();
  const now = new Date();

  const [existing] = await database
    .select()
    .from(appUsers)
    .where(eq(appUsers.privyDid, userId))
    .limit(1);

  if (existing) {
    const [updated] = await database
      .update(appUsers)
      .set({ ...parsed.data, updatedAt: now })
      .where(eq(appUsers.privyDid, userId))
      .returning();
    return c.json(updated);
  }

  const [created] = await database
    .insert(appUsers)
    .values({ privyDid: userId, ...parsed.data, createdAt: now, updatedAt: now })
    .returning();
  return c.json(created, 201);
});

// ─── Organizations ────────────────────────────────────────────────────────────

/** GET /management/orgs — list all orgs for the current user */
management.get("/orgs", async (c) => {
  const userId = getMgmtUserId(c);
  const database = db();

  const memberships = await database
    .select()
    .from(appOrgMembers)
    .where(eq(appOrgMembers.userId, userId));

  if (memberships.length === 0) return c.json([]);

  const orgIds = memberships.map((m) => m.orgId);
  const orgs = await database
    .select()
    .from(appOrganizations)
    .where(inArray(appOrganizations.id, orgIds))
    .orderBy(appOrganizations.name);

  return c.json(
    orgs.map((org) => ({
      ...org,
      role: memberships.find((m) => m.orgId === org.id)?.role ?? "viewer",
    }))
  );
});

/** POST /management/orgs — create a new org */
management.post("/orgs", async (c) => {
  const userId = getMgmtUserId(c);
  const body = await c.req.json().catch(() => null);
  const parsed = parseBody(CreateOrgSchema, body);
  if ("error" in parsed) return c.json({ error: parsed.error }, 400);

  const { name, slug } = parsed.data;
  const database = db();

  const [existing] = await database
    .select({ id: appOrganizations.id })
    .from(appOrganizations)
    .where(eq(appOrganizations.slug, slug))
    .limit(1);
  if (existing) return c.json({ error: "Slug already taken" }, 409);

  const [org] = await database
    .insert(appOrganizations)
    .values({ name, slug, ownerId: userId })
    .returning();

  await database.insert(appOrgMembers).values({
    orgId: org.id,
    userId,
    role: "owner",
  });

  return c.json({ ...org, role: "owner" }, 201);
});

/** GET /management/orgs/:slug — get an org (membership required) */
management.get("/orgs/:slug", async (c) => {
  const userId = getMgmtUserId(c);
  const { slug } = c.req.param();

  const resolved = await resolveOrgMembership(slug, userId);
  if (!resolved) return c.json({ error: "Not found" }, 404);

  return c.json({ ...resolved.org, role: resolved.membership.role });
});

/** PUT /management/orgs/:slug — update org (admin+) */
management.put("/orgs/:slug", async (c) => {
  const userId = getMgmtUserId(c);
  const { slug } = c.req.param();
  const body = await c.req.json().catch(() => null);
  const parsed = parseBody(UpdateOrgSchema, body);
  if ("error" in parsed) return c.json({ error: parsed.error }, 400);

  const resolved = await resolveOrgMembership(slug, userId);
  if (!resolved) return c.json({ error: "Not found" }, 404);
  if (!hasRole(resolved.membership.role, "admin")) return c.json({ error: "Forbidden" }, 403);

  const [updated] = await db()
    .update(appOrganizations)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(appOrganizations.id, resolved.org.id))
    .returning();

  return c.json({ ...updated, role: resolved.membership.role });
});

/** DELETE /management/orgs/:slug — delete org (owner only) */
management.delete("/orgs/:slug", async (c) => {
  const userId = getMgmtUserId(c);
  const { slug } = c.req.param();

  const resolved = await resolveOrgMembership(slug, userId);
  if (!resolved) return c.json({ error: "Not found" }, 404);
  if (resolved.membership.role !== "owner") return c.json({ error: "Forbidden" }, 403);

  await db().delete(appOrganizations).where(eq(appOrganizations.id, resolved.org.id));
  return c.json({ deleted: true });
});

// ─── Members ──────────────────────────────────────────────────────────────────

/** GET /management/orgs/:slug/members — list org members */
management.get("/orgs/:slug/members", async (c) => {
  const userId = getMgmtUserId(c);
  const { slug } = c.req.param();

  const resolved = await resolveOrgMembership(slug, userId);
  if (!resolved) return c.json({ error: "Not found" }, 404);

  const members = await db()
    .select()
    .from(appOrgMembers)
    .where(eq(appOrgMembers.orgId, resolved.org.id));

  return c.json(members);
});

/** POST /management/orgs/:slug/members — add a member (admin+) */
management.post("/orgs/:slug/members", async (c) => {
  const userId = getMgmtUserId(c);
  const { slug } = c.req.param();
  const body = await c.req.json().catch(() => null);
  const parsed = parseBody(AddMemberSchema, body);
  if ("error" in parsed) return c.json({ error: parsed.error }, 400);

  const { userId: targetUserId, role } = parsed.data;

  const resolved = await resolveOrgMembership(slug, userId);
  if (!resolved) return c.json({ error: "Not found" }, 404);
  if (!hasRole(resolved.membership.role, "admin")) return c.json({ error: "Forbidden" }, 403);

  const database = db();
  const [existing] = await database
    .select()
    .from(appOrgMembers)
    .where(and(eq(appOrgMembers.orgId, resolved.org.id), eq(appOrgMembers.userId, targetUserId)))
    .limit(1);
  if (existing) return c.json({ error: "Already a member" }, 409);

  const [member] = await database
    .insert(appOrgMembers)
    .values({ orgId: resolved.org.id, userId: targetUserId, role })
    .returning();

  return c.json(member, 201);
});

/** DELETE /management/orgs/:slug/members/:uid — remove a member (admin+ or self) */
management.delete("/orgs/:slug/members/:uid", async (c) => {
  const userId = getMgmtUserId(c);
  const { slug, uid } = c.req.param();

  const resolved = await resolveOrgMembership(slug, userId);
  if (!resolved) return c.json({ error: "Not found" }, 404);

  const canRemove = hasRole(resolved.membership.role, "admin") || userId === uid;
  if (!canRemove) return c.json({ error: "Forbidden" }, 403);

  const [target] = await db()
    .select()
    .from(appOrgMembers)
    .where(and(eq(appOrgMembers.orgId, resolved.org.id), eq(appOrgMembers.userId, uid)))
    .limit(1);
  if (!target) return c.json({ error: "Member not found" }, 404);
  if (target.role === "owner") return c.json({ error: "Cannot remove org owner" }, 400);

  await db()
    .delete(appOrgMembers)
    .where(and(eq(appOrgMembers.orgId, resolved.org.id), eq(appOrgMembers.userId, uid)));

  return c.json({ deleted: true });
});

// ─── Projects ─────────────────────────────────────────────────────────────────

/** GET /management/orgs/:slug/projects — list projects in an org */
management.get("/orgs/:slug/projects", async (c) => {
  const userId = getMgmtUserId(c);
  const { slug } = c.req.param();

  const resolved = await resolveOrgMembership(slug, userId);
  if (!resolved) return c.json({ error: "Not found" }, 404);

  const projects = await db()
    .select()
    .from(appProjects)
    .where(eq(appProjects.orgId, resolved.org.id))
    .orderBy(appProjects.name);

  return c.json(projects.map((p) => ({ ...p, orgSlug: slug })));
});

/** POST /management/orgs/:slug/projects — create a project */
management.post("/orgs/:slug/projects", async (c) => {
  const userId = getMgmtUserId(c);
  const { slug } = c.req.param();
  const body = await c.req.json().catch(() => null);
  const parsed = parseBody(CreateProjectSchema, body);
  if ("error" in parsed) return c.json({ error: parsed.error }, 400);

  const resolved = await resolveOrgMembership(slug, userId);
  if (!resolved) return c.json({ error: "Not found" }, 404);
  if (!hasRole(resolved.membership.role, "developer")) return c.json({ error: "Forbidden" }, 403);

  const database = db();
  const [existing] = await database
    .select({ id: appProjects.id })
    .from(appProjects)
    .where(and(eq(appProjects.orgId, resolved.org.id), eq(appProjects.slug, parsed.data.slug)))
    .limit(1);
  if (existing) return c.json({ error: "Project slug already exists in this org" }, 409);

  const [project] = await database
    .insert(appProjects)
    .values({ orgId: resolved.org.id, ...parsed.data })
    .returning();

  return c.json({ ...project, orgSlug: slug }, 201);
});

/** GET /management/projects/:id — get a project */
management.get("/projects/:id", async (c) => {
  const userId = getMgmtUserId(c);
  const { id } = c.req.param();

  const resolved = await resolveProjectMembership(id, userId);
  if (!resolved) return c.json({ error: "Not found" }, 404);

  const [org] = await db()
    .select({ slug: appOrganizations.slug })
    .from(appOrganizations)
    .where(eq(appOrganizations.id, resolved.project.orgId))
    .limit(1);

  return c.json({ ...resolved.project, orgSlug: org?.slug ?? "" });
});

/** PUT /management/projects/:id — update a project (developer+) */
management.put("/projects/:id", async (c) => {
  const userId = getMgmtUserId(c);
  const { id } = c.req.param();
  const body = await c.req.json().catch(() => null);
  const parsed = parseBody(UpdateProjectSchema, body);
  if ("error" in parsed) return c.json({ error: parsed.error }, 400);

  const resolved = await resolveProjectMembership(id, userId);
  if (!resolved) return c.json({ error: "Not found" }, 404);
  if (!hasRole(resolved.membership.role, "developer")) return c.json({ error: "Forbidden" }, 403);

  const [updated] = await db()
    .update(appProjects)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(appProjects.id, id))
    .returning();

  return c.json(updated);
});

/** DELETE /management/projects/:id — delete a project (admin+) */
management.delete("/projects/:id", async (c) => {
  const userId = getMgmtUserId(c);
  const { id } = c.req.param();

  const resolved = await resolveProjectMembership(id, userId);
  if (!resolved) return c.json({ error: "Not found" }, 404);
  if (!hasRole(resolved.membership.role, "admin")) return c.json({ error: "Forbidden" }, 403);

  await db().delete(appProjects).where(eq(appProjects.id, id));
  return c.json({ deleted: true });
});

// ─── API Keys ─────────────────────────────────────────────────────────────────

/** GET /management/projects/:id/api-keys — list keys (hashes excluded) */
management.get("/projects/:id/api-keys", async (c) => {
  const userId = getMgmtUserId(c);
  const { id } = c.req.param();

  const resolved = await resolveProjectMembership(id, userId);
  if (!resolved) return c.json({ error: "Not found" }, 404);

  const keys = await db()
    .select({
      id: appApiKeys.id,
      name: appApiKeys.name,
      prefix: appApiKeys.prefix,
      permissions: appApiKeys.permissions,
      createdAt: appApiKeys.createdAt,
      expiresAt: appApiKeys.expiresAt,
      lastUsedAt: appApiKeys.lastUsedAt,
      revokedAt: appApiKeys.revokedAt,
    })
    .from(appApiKeys)
    .where(eq(appApiKeys.projectId, id))
    .orderBy(desc(appApiKeys.createdAt));

  return c.json(keys);
});

/** POST /management/projects/:id/api-keys — create a new API key */
management.post("/projects/:id/api-keys", async (c) => {
  const userId = getMgmtUserId(c);
  const { id } = c.req.param();
  const body = await c.req.json().catch(() => null);
  const parsed = parseBody(CreateKeySchema, body);
  if ("error" in parsed) return c.json({ error: parsed.error }, 400);

  const { name, permissions, expiresInDays } = parsed.data;

  const resolved = await resolveProjectMembership(id, userId);
  if (!resolved) return c.json({ error: "Not found" }, 404);
  if (!hasRole(resolved.membership.role, "developer")) return c.json({ error: "Forbidden" }, 403);

  const { key, keyHash, prefix } = generateApiKey();
  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  const [created] = await db()
    .insert(appApiKeys)
    .values({ projectId: id, name, keyHash, prefix, permissions, expiresAt })
    .returning({ id: appApiKeys.id });

  // Return the plaintext key ONCE — it is never stored
  return c.json({ id: created.id, key, prefix, name, permissions }, 201);
});

/** DELETE /management/api-keys/:keyId — revoke an API key */
management.delete("/api-keys/:keyId", async (c) => {
  const userId = getMgmtUserId(c);
  const { keyId } = c.req.param();
  const database = db();

  const [apiKey] = await database
    .select({ id: appApiKeys.id, projectId: appApiKeys.projectId, revokedAt: appApiKeys.revokedAt })
    .from(appApiKeys)
    .where(eq(appApiKeys.id, keyId))
    .limit(1);

  if (!apiKey) return c.json({ error: "Not found" }, 404);
  if (apiKey.revokedAt) return c.json({ error: "Already revoked" }, 409);

  // Verify the user has access to this key's project
  const resolved = await resolveProjectMembership(apiKey.projectId, userId);
  if (!resolved) return c.json({ error: "Forbidden" }, 403);
  if (!hasRole(resolved.membership.role, "developer")) return c.json({ error: "Forbidden" }, 403);

  await database
    .update(appApiKeys)
    .set({ revokedAt: new Date() })
    .where(eq(appApiKeys.id, keyId));

  return c.json({ revoked: true });
});

// ─── Usage ────────────────────────────────────────────────────────────────────

/**
 * GET /management/projects/:id/usage
 * Returns summary (totalCalls, successRate, period) and daily breakdown for 30 days.
 */
management.get("/projects/:id/usage", async (c) => {
  const userId = getMgmtUserId(c);
  const { id } = c.req.param();

  const resolved = await resolveProjectMembership(id, userId);
  if (!resolved) return c.json({ error: "Not found" }, 404);

  const database = db();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [totalRow] = await database
    .select({ total: count() })
    .from(appUsageRecords)
    .where(and(eq(appUsageRecords.projectId, id), gte(appUsageRecords.timestamp, thirtyDaysAgo)));

  const [successRow] = await database
    .select({ total: count() })
    .from(appUsageRecords)
    .where(
      and(
        eq(appUsageRecords.projectId, id),
        gte(appUsageRecords.timestamp, thirtyDaysAgo),
        sql`${appUsageRecords.statusCode} >= 200 AND ${appUsageRecords.statusCode} < 300`
      )
    );

  const byDay = await database
    .select({
      date: sql<string>`to_char(${appUsageRecords.timestamp}, 'YYYY-MM-DD')`,
      total: count(),
      success: sql<number>`count(*) filter (where ${appUsageRecords.statusCode} >= 200 and ${appUsageRecords.statusCode} < 300)`,
    })
    .from(appUsageRecords)
    .where(and(eq(appUsageRecords.projectId, id), gte(appUsageRecords.timestamp, thirtyDaysAgo)))
    .groupBy(sql`to_char(${appUsageRecords.timestamp}, 'YYYY-MM-DD')`)
    .orderBy(sql`to_char(${appUsageRecords.timestamp}, 'YYYY-MM-DD')`);

  const totalCalls = Number(totalRow?.total ?? 0);
  const successCount = Number(successRow?.total ?? 0);

  return c.json({
    summary: {
      totalCalls,
      successRate: totalCalls > 0 ? (successCount / totalCalls) * 100 : 0,
      period: "month" as const,
    },
    byDay: byDay.map((r) => ({
      date: r.date,
      total: Number(r.total),
      success: Number(r.success),
    })),
  });
});

/**
 * GET /management/projects/:id/logs?limit=50
 * Returns the most recent API calls for a project (up to 100).
 * Used by the dashboard to show a live activity feed.
 */
management.get("/projects/:id/logs", async (c) => {
  const userId = getMgmtUserId(c);
  const { id } = c.req.param();
  const limit = Math.min(Number(c.req.query("limit") ?? "50"), 100);

  const resolved = await resolveProjectMembership(id, userId);
  if (!resolved) return c.json({ error: "Not found" }, 404);

  const database = db();
  const logs = await database
    .select({
      id: appUsageRecords.id,
      endpoint: appUsageRecords.endpoint,
      resourceType: appUsageRecords.resourceType,
      statusCode: appUsageRecords.statusCode,
      timestamp: appUsageRecords.timestamp,
    })
    .from(appUsageRecords)
    .where(eq(appUsageRecords.projectId, id))
    .orderBy(desc(appUsageRecords.timestamp))
    .limit(limit);

  return c.json({ logs });
});

// ─── Auth utilities ───────────────────────────────────────────────────────────

/**
 * POST /management/auth/validate-key
 * Validates a pk_live_ API key and returns the project/org/user context.
 * Used by the dashboard MCP server to authenticate admin requests.
 * Does NOT require X-User-Id header.
 *
 * Request body: { key: "pk_live_..." }
 * Response:
 *   { valid: true, projectId, orgId, userId, permissions }
 *   { valid: false, reason: string }
 */
management.post("/auth/validate-key", async (c) => {
  const body = await c.req.json().catch(() => null);
  const key = body?.key as string | undefined;

  if (!key?.startsWith("pk_live_")) {
    return c.json({ valid: false, reason: "Not a pk_live_ key" }, 400);
  }

  const database = db();
  const keyHash = createHash("sha256").update(key).digest("hex");

  const [apiKey] = await database
    .select({
      id: appApiKeys.id,
      projectId: appApiKeys.projectId,
      permissions: appApiKeys.permissions,
      expiresAt: appApiKeys.expiresAt,
      revokedAt: appApiKeys.revokedAt,
    })
    .from(appApiKeys)
    .where(eq(appApiKeys.keyHash, keyHash))
    .limit(1);

  if (!apiKey) return c.json({ valid: false, reason: "Invalid key" });
  if (apiKey.revokedAt) return c.json({ valid: false, reason: "Key revoked" });
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    return c.json({ valid: false, reason: "Key expired" });
  }

  // Update lastUsedAt fire-and-forget
  database
    .update(appApiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(appApiKeys.id, apiKey.id))
    .catch(() => {});

  const [project] = await database
    .select({ id: appProjects.id, orgId: appProjects.orgId })
    .from(appProjects)
    .where(eq(appProjects.id, apiKey.projectId))
    .limit(1);

  const [owner] = project
    ? await database
        .select({ userId: appOrgMembers.userId })
        .from(appOrgMembers)
        .where(and(eq(appOrgMembers.orgId, project.orgId), eq(appOrgMembers.role, "owner")))
        .limit(1)
    : [];

  return c.json({
    valid: true,
    projectId: apiKey.projectId,
    orgId: project?.orgId ?? null,
    userId: owner?.userId ?? null,
    permissions: apiKey.permissions,
  });
});

// ─── Network ──────────────────────────────────────────────────────────────────

/**
 * GET /management/network
 *
 * Returns the blockchain network this API instance is configured to record on.
 * Used by the dashboard to show the active network indicator.
 *
 * No X-User-Id required (system-level information, management key auth is sufficient).
 *
 * Response:
 *   { configured: false }                          — no blockchain configured
 *   { configured: true, chainId, chainName, contractAddress, isTestnet, explorerUrl }
 */
management.get("/network", (c) => {
  let ctx;
  try {
    ctx = getContext();
  } catch {
    // Context not initialized — API running without blockchain
    return c.json({ configured: false });
  }

  if (!ctx.blockchain) {
    return c.json({ configured: false });
  }

  const { chainId, chainName, contractAddress } = ctx.blockchain;

  // Derive testnet status and explorer URL from known chain IDs
  const KNOWN_CHAINS: Record<number, { isTestnet: boolean; explorerUrl: string }> = {
    1:        { isTestnet: false, explorerUrl: "https://etherscan.io" },
    11155111: { isTestnet: true,  explorerUrl: "https://sepolia.etherscan.io" },
    8453:     { isTestnet: false, explorerUrl: "https://basescan.org" },
    84532:    { isTestnet: true,  explorerUrl: "https://sepolia.basescan.org" },
    137:      { isTestnet: false, explorerUrl: "https://polygonscan.com" },
    80002:    { isTestnet: true,  explorerUrl: "https://amoy.polygonscan.com" },
    42161:    { isTestnet: false, explorerUrl: "https://arbiscan.io" },
    421614:   { isTestnet: true,  explorerUrl: "https://sepolia.arbiscan.io" },
    10:       { isTestnet: false, explorerUrl: "https://optimistic.etherscan.io" },
    11155420: { isTestnet: true,  explorerUrl: "https://sepolia-optimism.etherscan.io" },
    100:      { isTestnet: false, explorerUrl: "https://gnosisscan.io" },
    56:       { isTestnet: false, explorerUrl: "https://bscscan.com" },
    43114:    { isTestnet: false, explorerUrl: "https://snowtrace.io" },
  };

  const known = KNOWN_CHAINS[chainId];

  return c.json({
    configured: true,
    chainId,
    chainName,
    contractAddress,
    isTestnet: known?.isTestnet ?? false,
    explorerUrl: known?.explorerUrl ?? null,
  });
});

export default management;
