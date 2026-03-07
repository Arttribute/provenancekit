import { NextRequest, NextResponse } from "next/server";

/**
 * Secure proxy to the ProvenanceKit API.
 *
 * The browser-side @provenancekit/ui hooks (useProvenanceBundle, useProvenanceGraph,
 * useSessionProvenance) call the PK SDK which in turn fetches from the configured
 * apiUrl. By pointing ProvenanceKitProvider at /api/pk-proxy, we:
 *   1. Keep PK_API_KEY out of the browser entirely
 *   2. Add Authorization: Bearer <PK_API_KEY> server-side on every request
 *   3. Allow all @provenancekit/ui components to work with zero browser config
 *
 * Supports both JSON and multipart/form-data (required for pk.uploadAndMatch
 * file provenance search). The Content-Type header is forwarded as-is to
 * preserve the multipart boundary.
 */

const PK_API_BASE = process.env.PK_API_URL ?? "https://api.provenancekit.com";

type Params = { params: Promise<{ path: string[] }> };

async function proxyRequest(req: NextRequest, { params }: Params, method: string) {
  const pkApiKey = process.env.PK_API_KEY;

  if (!pkApiKey) {
    return NextResponse.json({ error: "ProvenanceKit not configured" }, { status: 503 });
  }

  const { path } = await params;
  const pathStr = path.join("/");
  const search = req.nextUrl.search;
  const targetUrl = `${PK_API_BASE}/${pathStr}${search}`;

  // Forward content-type as-is — critical for multipart/form-data where the
  // boundary parameter must be preserved exactly.
  const forwardHeaders: Record<string, string> = {
    Authorization: `Bearer ${pkApiKey}`,
  };
  const contentType = req.headers.get("content-type");
  if (contentType) {
    forwardHeaders["Content-Type"] = contentType;
  }

  const fetchOpts: RequestInit & { duplex?: string } = {
    method,
    headers: forwardHeaders,
  };

  if (["POST", "PUT", "PATCH"].includes(method) && req.body) {
    // Stream raw body through — works for JSON, multipart/form-data, etc.
    fetchOpts.body = req.body;
    fetchOpts.duplex = "half"; // required for streaming request body in Node.js
  }

  try {
    const response = await fetch(targetUrl, fetchOpts as RequestInit);
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (err) {
    console.error("[pk-proxy] Upstream error:", err);
    return NextResponse.json({ error: "PK API unavailable" }, { status: 502 });
  }
}

export const GET = (req: NextRequest, ctx: Params) => proxyRequest(req, ctx, "GET");
export const POST = (req: NextRequest, ctx: Params) => proxyRequest(req, ctx, "POST");
export const PUT = (req: NextRequest, ctx: Params) => proxyRequest(req, ctx, "PUT");
export const DELETE = (req: NextRequest, ctx: Params) => proxyRequest(req, ctx, "DELETE");
