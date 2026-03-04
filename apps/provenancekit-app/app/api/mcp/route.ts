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
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDb } from "@/lib/mongodb";
import { ApiKey, Organization, OrgMember, Project, UsageRecord } from "@/lib/db/collections";
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

  await connectDb();

  const key = await ApiKey.findOne({ keyHash: tokenHash }).lean();
  if (!key) return { error: "Invalid API key", status: 401 };
  if (key.revokedAt) return { error: "API key has been revoked", status: 401 };
  if (key.expiresAt && key.expiresAt < new Date()) {
    return { error: "API key has expired", status: 401 };
  }
  if (key.permissions !== "admin") {
    return { error: "MCP access requires an admin-permissions API key", status: 403 };
  }

  const project = await Project.findById(key.projectId).lean();
  if (!project) return { error: "Project not found", status: 404 };

  const ownerMember = await OrgMember.findOne({
    orgId: project.orgId,
    role: "owner",
  }).lean();

  return {
    ctx: {
      userId: ownerMember?.userId ?? "",
      orgId: project.orgId,
      keyPermissions: key.permissions,
    },
  };
}

// ─── Tool definitions ─────────────────────────────────────────────────────────

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
      properties: { orgSlug: { type: "string", description: "Organization slug" } },
      required: ["orgSlug"],
    },
  },
  {
    name: "list_api_keys",
    description: "List API keys for a project (shows prefix and metadata, never the secret)",
    inputSchema: {
      type: "object",
      properties: { projectId: { type: "string", description: "Project ID" } },
      required: ["projectId"],
    },
  },
  {
    name: "create_api_key",
    description: "Create a new API key for a project. Returns the plaintext key once — store it immediately.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        name: { type: "string" },
        permissions: { type: "string", enum: ["read", "write", "admin"] },
        expiresInDays: { type: "number" },
      },
      required: ["projectId", "name", "permissions"],
    },
  },
  {
    name: "get_usage_summary",
    description: "Get API usage summary for a project over the last 30 days",
    inputSchema: {
      type: "object",
      properties: { projectId: { type: "string" } },
      required: ["projectId"],
    },
  },
  {
    name: "create_organization",
    description: "Create a new organization",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        slug: { type: "string" },
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
        orgSlug: { type: "string" },
        name: { type: "string" },
        description: { type: "string" },
        storageType: { type: "string", enum: ["memory", "mongodb", "supabase"] },
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
  const ok = (obj: unknown): ToolResult => ({ content: [{ type: "text", text: text(obj) }] });
  const err = (msg: string): ToolResult => ({ content: [{ type: "text", text: msg }], isError: true });

  switch (name) {
    case "list_organizations": {
      const memberships = await OrgMember.find({ userId: ctx.userId }).lean();
      const orgIds = memberships.map((m) => m.orgId);
      const orgs = await Organization.find({ _id: { $in: orgIds } }).lean();
      return ok(orgs.map((o) => ({
        id: String(o._id),
        name: o.name,
        slug: o.slug,
        plan: o.plan,
        role: memberships.find((m) => m.orgId === String(o._id))?.role,
      })));
    }

    case "list_projects": {
      const orgSlug = input.orgSlug as string;
      const org = await Organization.findOne({ slug: orgSlug }).lean();
      if (!org) return err(`Organization '${orgSlug}' not found`);
      const rows = await Project.find({ orgId: String(org._id) }).lean();
      return ok(rows);
    }

    case "list_api_keys": {
      const projectId = input.projectId as string;
      const rows = await ApiKey.find({ projectId })
        .select("-keyHash")
        .lean();
      return ok(rows);
    }

    case "create_api_key": {
      const parsed = z
        .object({
          projectId: z.string(),
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

      const created = await ApiKey.create({ projectId, name, keyHash, prefix, permissions, expiresAt });
      return ok({
        id: String(created._id),
        key,
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

      const [totalCalls, successCount] = await Promise.all([
        UsageRecord.countDocuments({ projectId, timestamp: { $gte: thirtyDaysAgo } }),
        UsageRecord.countDocuments({
          projectId,
          timestamp: { $gte: thirtyDaysAgo },
          statusCode: { $gte: 200, $lt: 300 },
        }),
      ]);

      return ok({
        period: "30d",
        totalCalls,
        successRate:
          totalCalls > 0
            ? ((successCount / totalCalls) * 100).toFixed(1) + "%"
            : "N/A",
      });
    }

    case "create_organization": {
      const name = input.name as string;
      const slug = (input.slug as string | undefined) ?? slugify(name);

      const existing = await Organization.findOne({ slug }).lean();
      if (existing) return err(`Slug '${slug}' is already taken`);

      const org = await Organization.create({ name, slug, ownerId: ctx.userId });
      await OrgMember.create({ orgId: String(org._id), userId: ctx.userId, role: "owner" });
      return ok(org);
    }

    case "create_project": {
      const parsed = z
        .object({
          orgSlug: z.string(),
          name: z.string().min(1).max(64),
          description: z.string().max(256).optional(),
          storageType: z.enum(["memory", "mongodb", "supabase"]).default("memory"),
        })
        .safeParse(input);
      if (!parsed.success) return err(JSON.stringify(parsed.error.flatten()));

      const { orgSlug, name, description, storageType } = parsed.data;
      const org = await Organization.findOne({ slug: orgSlug }).lean();
      if (!org) return err(`Organization '${orgSlug}' not found`);

      const project = await Project.create({
        orgId: String(org._id),
        name,
        slug: slugify(name),
        description,
        storageType,
      });
      return ok(project);
    }

    default:
      return err(`Unknown tool: ${name}`);
  }
}

// ─── JSON-RPC dispatcher ──────────────────────────────────────────────────────

function rpcError(id: string | number | null | undefined, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

function rpcResult(id: string | number | null | undefined, result: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id, result };
}

async function handleRpc(req: JsonRpcRequest, ctx: AuthContext): Promise<JsonRpcResponse | null> {
  const { id, method, params = {} } = req;

  switch (method) {
    case "initialize":
      return rpcResult(id, {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: "provenancekit-dashboard", version: "1.0.0" },
      });

    case "notifications/initialized":
      return null;

    case "ping":
      return rpcResult(id, {});

    case "tools/list":
      return rpcResult(id, { tools: TOOLS });

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
  const origin = req.headers.get("origin");
  if (origin && !origin.includes("localhost") && !origin.includes("127.0.0.1")) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (appUrl && origin !== appUrl) {
      return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
    }
  }

  const authResult = await authenticate(req);
  if ("error" in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }
  const { ctx } = authResult;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(rpcError(null, -32700, "Parse error"), { status: 400 });
  }

  if (Array.isArray(body)) {
    const responses = await Promise.all(body.map((r) => handleRpc(r as JsonRpcRequest, ctx)));
    return NextResponse.json(responses.filter(Boolean));
  }

  const response = await handleRpc(body as JsonRpcRequest, ctx);
  if (response === null) return new NextResponse(null, { status: 204 });

  return NextResponse.json(response);
}

export async function GET() {
  return NextResponse.json({
    name: "ProvenanceKit Dashboard MCP Server",
    version: "1.0.0",
    protocolVersion: MCP_PROTOCOL_VERSION,
    description: "Manage ProvenanceKit organizations, projects, and API keys via AI agents",
    transport: "streamable-http",
    endpoint: "/api/mcp",
    auth: "Authorization: Bearer <admin-api-key>",
  });
}
