import { NextRequest, NextResponse } from "next/server";
import { getCachedBundle } from "@/lib/bundle-cache";

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
 *
 * Bundle cache: GET /bundle/{cid} responses are served from lib/bundle-cache
 * when available. The background recording task pre-populates the cache so
 * the first browser request hits memory rather than the upstream PK API.
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

  // Serve bundle GET requests from the server-side cache when available.
  // The background recording task pre-populates this cache so the first
  // browser request hits cache rather than the upstream API.
  if (method === "GET" && pathStr.startsWith("bundle/") && !search) {
    const cid = pathStr.slice("bundle/".length);
    const cached = getCachedBundle(cid);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { "X-PK-Cache": "HIT", "Cache-Control": "private, max-age=600" },
      });
    }
  }

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
