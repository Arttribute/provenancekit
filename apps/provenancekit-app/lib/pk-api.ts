/**
 * Server-side helper for calling the ProvenanceKit API.
 * Only import this in Server Components or API route handlers.
 */

const PK_API_URL = process.env.PROVENANCEKIT_API_URL ?? "http://localhost:3001";
const PK_API_KEY = process.env.PROVENANCEKIT_API_KEY;

function buildHeaders(): HeadersInit {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (PK_API_KEY) h["Authorization"] = `Bearer ${PK_API_KEY}`;
  return h;
}

export async function pkApiFetch<T = unknown>(
  path: string
): Promise<{ ok: boolean; data: T | null; status: number; error?: string }> {
  try {
    const res = await fetch(`${PK_API_URL}${path}`, {
      headers: buildHeaders(),
      cache: "no-store",
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as Record<string, unknown>;
      const err = body?.error as { message?: string } | undefined;
      return {
        ok: false,
        data: null,
        status: res.status,
        error: err?.message ?? `HTTP ${res.status}`,
      };
    }

    const data = (await res.json()) as T;
    return { ok: true, data, status: res.status };
  } catch (e) {
    return {
      ok: false,
      data: null,
      status: 0,
      error: e instanceof Error ? e.message : "Network error — is the ProvenanceKit API running?",
    };
  }
}
