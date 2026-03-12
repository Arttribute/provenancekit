import { NextRequest, NextResponse } from "next/server";

/**
 * Secure proxy to the ProvenanceKit API.
 *
 * Mirrors the chat-app pattern: browser-side @provenancekit/ui hooks call the
 * PK SDK, which fetches from the configured apiUrl (/api/pk-proxy). This proxy:
 *   1. Keeps PROVENANCEKIT_API_KEY out of the browser entirely
 *   2. Adds Authorization: Bearer <PROVENANCEKIT_API_KEY> server-side
 *   3. Allows ProvenanceGraph, ProvenanceBundleView, ProvenanceSearch etc. to
 *      work with zero browser-visible credentials
 *
 * Supports both JSON and multipart/form-data (required for file similarity
 * search via FileUploadZone / ProvenanceSearch).
 */

const PK_API_BASE = process.env.PK_API_URL ?? "https://api.provenancekit.com";

type Params = { params: Promise<{ path: string[] }> };

async function proxyRequest(req: NextRequest, { params }: Params, method: string) {
  const pkApiKey = process.env.PROVENANCEKIT_API_KEY;

  if (!pkApiKey) {
    console.error(
      "[pk-proxy] PROVENANCEKIT_API_KEY is not set — set this env var in your Vercel project settings " +
      "(Settings → Environment Variables) to enable the provenance explorer, file similarity search, " +
      "and all @provenancekit/ui interactive components."
    );
    return NextResponse.json(
      { error: "ProvenanceKit API key not configured. Set PROVENANCEKIT_API_KEY in your environment." },
      { status: 503 }
    );
  }

  const { path } = await params;
  const pathStr = path.join("/");
  const search = req.nextUrl.search;
  const targetUrl = `${PK_API_BASE}/${pathStr}${search}`;

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
    fetchOpts.body = req.body;
    fetchOpts.duplex = "half";
  }

  try {
    const response = await fetch(targetUrl, fetchOpts as RequestInit);
    const data = await response.json();
    if (!response.ok) {
      console.warn(`[pk-proxy] ${method} /${pathStr} → ${response.status}`, data);
    }
    return NextResponse.json(data, { status: response.status });
  } catch (err) {
    console.error(`[pk-proxy] ${method} /${pathStr} — upstream error:`, err);
    return NextResponse.json({ error: "PK API unavailable" }, { status: 502 });
  }
}

export const GET = (req: NextRequest, ctx: Params) => proxyRequest(req, ctx, "GET");
export const POST = (req: NextRequest, ctx: Params) => proxyRequest(req, ctx, "POST");
export const PUT = (req: NextRequest, ctx: Params) => proxyRequest(req, ctx, "PUT");
export const DELETE = (req: NextRequest, ctx: Params) => proxyRequest(req, ctx, "DELETE");
