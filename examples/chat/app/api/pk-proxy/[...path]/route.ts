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
 * The proxy forwards GET and POST requests verbatim, adding the auth header.
 */

type Params = { params: Promise<{ path: string[] }> };

async function proxyRequest(req: NextRequest, { params }: Params, method: string) {
  const pkApiUrl = process.env.PK_API_URL;
  const pkApiKey = process.env.PK_API_KEY;

  if (!pkApiUrl) {
    return NextResponse.json({ error: "ProvenanceKit not configured" }, { status: 503 });
  }

  const { path } = await params;
  const pathStr = path.join("/");
  const search = req.nextUrl.search;
  const targetUrl = `${pkApiUrl}/${pathStr}${search}`;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  if (pkApiKey) {
    headers["Authorization"] = `Bearer ${pkApiKey}`;
  }

  const fetchOpts: RequestInit = { method, headers };

  if (method === "POST" || method === "PUT" || method === "PATCH") {
    try {
      const body = await req.text();
      if (body) fetchOpts.body = body;
    } catch {
      // No body — that's fine
    }
  }

  try {
    const response = await fetch(targetUrl, fetchOpts);
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
