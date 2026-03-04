/**
 * ProvenanceKit Dashboard — MCP Server (JSON-RPC 2.0 / Streamable HTTP)
 *
 * Implements the Model Context Protocol specification (2025-03-26) using
 * plain JSON-RPC 2.0 over HTTP POST. This is the Web Fetch API compatible
 * implementation for Next.js App Router.
 *
 * Endpoint: POST /api/mcp
 * Auth:     Authorization: Bearer pk_live_<admin-key>
 *
 * Compatible with Claude Code, Cursor, Copilot, and any MCP 2025-03-26 client.
 *
 * Tools exposed:
 *   list_organizations  — list orgs the key owner belongs to
 *   list_projects       — list projects in an org
 *   list_api_keys       — list API keys for a project
 *   create_api_key      — create a new API key (returns plaintext once)
 *   get_usage_summary   — API usage stats (last 30 days)
 *   create_organization — create a new org
 *   create_project      — create a project inside an org
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, and, gte, count, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  apiKeys,
  organizations,
  organizationMembers,
  projects,
  usageRecords,
} from "@/lib/db/schema";
import { hashApiKey, generateApiKey } from "@/lib/api-keys";
import { slugify } from "@/lib/utils";

// ─── MCP Protocol types ───────────────────────────────────────────────────────

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id?: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

const MCP_PROTOCOL_VERSION = "2025-03-26";

// ─── Auth helper ─────────────────────────────────────────────────────────────

interface AuthContext {
  userId: string;
  orgId: string;
  keyPermissions: string;
}

async function authenticate(
  req: NextRequest
): Promise<{ ctx: AuthContext } | { error: string; status: number }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: "Missing Authorization header", status: 401 };
  }
  const token = authHeader.slice(7);
  const tokenHash = hashApiKey(token);

  const [key] = await db
    .select({
      id: apiKeys.id,
      projectId: apiKeys.projectId,
      permissions: apiKeys.permissions,
      revokedAt: apiKeys.revokedAt,
      expiresAt: apiKeys.expiresAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, tokenHash))
    .limit(1);

  if (!key) return { error: "Invalid API key", status: 401 };
  if (key.revokedAt) return { error: "API key has been revoked", status: 401 };
  if (key.expiresAt && key.expiresAt < new Date()) {
    return { error: "API key has expired", status: 401 };
  }
  if (key.permissions !== "admin") {
    return {
      error: "MCP access requires an admin-permissions API key",
      status: 403,
    };
  }

  const [project] = await db
    .select({ orgId: projects.orgId })
    .from(projects)
    .where(eq(projects.id, key.projectId))
    .limit(1);
  if (!project) return { error: "Project not found", status: 404 };

  const [ownerMember] = await db
    .select({ userId: organizationMembers.userId })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.orgId, project.orgId),
        eq(organizationMembers.role, "owner")
      )
    )
    .limit(1);

  return {
    ctx: {
      userId: ownerMember?.userId ?? "",
      orgId: project.orgId,
      keyPermissions: key.permissions,
    },
  };
}

// ─── Tool definitions (JSON Schema for MCP tools/list) ───────────────────────

const TOOLS = [
  {
    name: "list_organizations",
    description: "List all organizations the authenticated user belongs to",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "list_projects",
    description: "List all projects in an organization",
    inputSchema: {
      type: "object",
      properties: {
        orgSlug: {
          type: "string",
          description: "Organization slug",
        },
      },
      required: ["orgSlug"],
    },
  },
  {
    name: "list_api_keys",
    description:
      "List API keys for a project (shows prefix and metadata, never the secret)",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "Project UUID" },
      },
      required: ["projectId"],
    },
  },
  {
    name: "create_api_key",
    description:
      "Create a new API key for a project. Returns the plaintext key once — store it immediately.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "Project UUID" },
        name: { type: "string", description: "Human-readable key name" },
        permissions: {
          type: "string",
          enum: ["read", "write", "admin"],
          description: "Key permissions",
        },
        expiresInDays: {
          type: "number",
          description: "Optional: expiry in days (1–365)",
        },
      },
      required: ["projectId", "name", "permissions"],
    },
  },
  {
    name: "get_usage_summary",
    description: "Get API usage summary for a project over the last 30 days",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "Project UUID" },
      },
      required: ["projectId"],
    },
  },
  {
    name: "create_organization",
    description: "Create a new organization",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Organization display name" },
        slug: {
          type: "string",
          description: "URL slug (auto-generated if omitted)",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "create_project",
    description: "Create a new project within an organization",
    inputSchema: {
      type: "object",
      properties: {
        orgSlug: { type: "string", description: "Organization slug" },
        name: { type: "string", description: "Project name" },
        description: { type: "string", description: "Project description" },
        storageType: {
          type: "string",
          enum: ["memory", "postgres", "mongodb", "supabase"],
          description: "Storage backend",
        },
      },
      required: ["orgSlug", "name"],
    },
  },
] as const;

// ─── Tool handlers ────────────────────────────────────────────────────────────

type ToolResult = { content: Array<{ type: "text"; text: string }>; isError?: boolean };

async function callTool(
  name: string,
  input: Record<string, unknown>,
  ctx: AuthContext
): Promise<ToolResult> {
  const text = (obj: unknown) => JSON.stringify(obj, null, 2);
  const ok = (obj: unknown): ToolResult => ({
    content: [{ type: "text", text: text(obj) }],
  });
  const err = (msg: string): ToolResult => ({
    content: [{ type: "text", text: msg }],
    isError: true,
  });

  switch (name) {
    case "list_organizations": {
      const rows = await db
        .select({
          id: organizations.id,
          name: organizations.name,
          slug: organizations.slug,
          plan: organizations.plan,
          role: organizationMembers.role,
        })
        .from(organizationMembers)
        .innerJoin(
          organizations,
          eq(organizationMembers.orgId, organizations.id)
        )
        .where(eq(organizationMembers.userId, ctx.userId));
      return ok(rows);
    }

    case "list_projects": {
      const orgSlug = input.orgSlug as string;
      const [org] = await db
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.slug, orgSlug))
        .limit(1);
      if (!org) return err(`Organization '${orgSlug}' not found`);
      const rows = await db
        .select()
        .from(projects)
        .where(eq(projects.orgId, org.id));
      return ok(rows);
    }

    case "list_api_keys": {
      const projectId = input.projectId as string;
      const rows = await db
        .select({
          id: apiKeys.id,
          name: apiKeys.name,
          prefix: apiKeys.prefix,
          permissions: apiKeys.permissions,
          createdAt: apiKeys.createdAt,
          expiresAt: apiKeys.expiresAt,
          lastUsedAt: apiKeys.lastUsedAt,
          revokedAt: apiKeys.revokedAt,
        })
        .from(apiKeys)
        .where(eq(apiKeys.projectId, projectId));
      return ok(rows);
    }

    case "create_api_key": {
      const parsed = z
        .object({
          projectId: z.string().uuid(),
          name: z.string().min(1).max(64),
          permissions: z.enum(["read", "write", "admin"]),
          expiresInDays: z.number().int().min(1).max(365).optional(),
        })
        .safeParse(input);
      if (!parsed.success) return err(JSON.stringify(parsed.error.flatten()));

      const { projectId, name, permissions, expiresInDays } = parsed.data;
      const { key, keyHash, prefix } = generateApiKey();
      const expiresAt = expiresInDays
        ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
        : null;

      const [created] = await db
        .insert(apiKeys)
        .values({ projectId, name, keyHash, prefix, permissions, expiresAt })
        .returning({ id: apiKeys.id });

      return ok({
        id: created.id,
        key, // plaintext — shown once
        prefix,
        name,
        permissions,
        expiresAt,
        warning: "Store this key securely — it will not be shown again.",
      });
    }

    case "get_usage_summary": {
      const projectId = input.projectId as string;
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const [total] = await db
        .select({ count: count() })
        .from(usageRecords)
        .where(
          and(
            eq(usageRecords.projectId, projectId),
            gte(usageRecords.timestamp, thirtyDaysAgo)
          )
        );

      const [successes] = await db
        .select({ count: count() })
        .from(usageRecords)
        .where(
          and(
            eq(usageRecords.projectId, projectId),
            gte(usageRecords.timestamp, thirtyDaysAgo),
            sql`${usageRecords.statusCode} >= 200 AND ${usageRecords.statusCode} < 300`
          )
        );

      const totalCount = total?.count ?? 0;
      const successCount = successes?.count ?? 0;

      return ok({
        period: "30d",
        totalCalls: totalCount,
        successRate:
          totalCount > 0
            ? ((successCount / totalCount) * 100).toFixed(1) + "%"
            : "N/A",
      });
    }

    case "create_organization": {
      const name = input.name as string;
      const slug = (input.slug as string | undefined) ?? slugify(name);

      const [existing] = await db
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.slug, slug))
        .limit(1);

      if (existing) return err(`Slug '${slug}' is already taken`);

      const [org] = await db
        .insert(organizations)
        .values({ name, slug, ownerId: ctx.userId })
        .returning();

      await db
        .insert(organizationMembers)
        .values({ orgId: org.id, userId: ctx.userId, role: "owner" });

      return ok(org);
    }

    case "create_project": {
      const parsed = z
        .object({
          orgSlug: z.string(),
          name: z.string().min(1).max(64),
          description: z.string().max(256).optional(),
          storageType: z
            .enum(["memory", "postgres", "mongodb", "supabase"])
            .default("memory"),
        })
        .safeParse(input);
      if (!parsed.success) return err(JSON.stringify(parsed.error.flatten()));

      const { orgSlug, name, description, storageType } = parsed.data;
      const [org] = await db
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.slug, orgSlug))
        .limit(1);

      if (!org) return err(`Organization '${orgSlug}' not found`);

      const [project] = await db
        .insert(projects)
        .values({ orgId: org.id, name, slug: slugify(name), description, storageType })
        .returning();

      return ok(project);
    }

    default:
      return err(`Unknown tool: ${name}`);
  }
}

// ─── JSON-RPC dispatcher ──────────────────────────────────────────────────────

function rpcError(
  id: string | number | null | undefined,
  code: number,
  message: string
): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

function rpcResult(
  id: string | number | null | undefined,
  result: unknown
): JsonRpcResponse {
  return { jsonrpc: "2.0", id, result };
}

async function handleRpc(
  req: JsonRpcRequest,
  ctx: AuthContext
): Promise<JsonRpcResponse | null> {
  const { id, method, params = {} } = req;

  switch (method) {
    // MCP lifecycle
    case "initialize":
      return rpcResult(id, {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: "provenancekit-dashboard", version: "1.0.0" },
      });

    case "notifications/initialized":
      return null; // notification — no response

    case "ping":
      return rpcResult(id, {});

    // Tool discovery
    case "tools/list":
      return rpcResult(id, { tools: TOOLS });

    // Tool execution
    case "tools/call": {
      const toolName = params.name as string;
      const toolInput = (params.arguments ?? {}) as Record<string, unknown>;
      const result = await callTool(toolName, toolInput, ctx);
      return rpcResult(id, result);
    }

    default:
      return rpcError(id, -32601, `Method not found: ${method}`);
  }
}

// ─── Route handlers ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Validate origin to prevent DNS rebinding (MCP spec requirement)
  const origin = req.headers.get("origin");
  if (origin && !origin.includes("localhost") && !origin.includes("127.0.0.1")) {
    const allowedOrigins = process.env.NEXTAUTH_URL
      ? [process.env.NEXTAUTH_URL]
      : [];
    if (allowedOrigins.length > 0 && !allowedOrigins.includes(origin)) {
      return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
    }
  }

  const authResult = await authenticate(req);
  if ("error" in authResult) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    );
  }
  const { ctx } = authResult;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      rpcError(null, -32700, "Parse error"),
      { status: 400 }
    );
  }

  // Handle batch requests
  if (Array.isArray(body)) {
    const responses = await Promise.all(
      body.map((req) => handleRpc(req as JsonRpcRequest, ctx))
    );
    const filtered = responses.filter(Boolean);
    return NextResponse.json(filtered);
  }

  const response = await handleRpc(body as JsonRpcRequest, ctx);
  if (response === null) {
    // Notification — no response body, 204
    return new NextResponse(null, { status: 204 });
  }

  return NextResponse.json(response);
}

// GET endpoint returns server capabilities (for MCP discovery)
export async function GET() {
  return NextResponse.json({
    name: "ProvenanceKit Dashboard MCP Server",
    version: "1.0.0",
    protocolVersion: MCP_PROTOCOL_VERSION,
    description:
      "Manage ProvenanceKit organizations, projects, and API keys via AI agents",
    transport: "streamable-http",
    endpoint: "/api/mcp",
    auth: "Authorization: Bearer <admin-api-key>",
  });
}
