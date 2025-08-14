// lib/fetcher.ts
// -----------------------------------------------------------------------------
// Adds `Authorization: Bearer <Privy‑id‑token>` automatically (if any)
// and still lets you attach extra headers (e.g. multipart/form‑data).
// -----------------------------------------------------------------------------
function authHeaders(extra: HeadersInit = {}) {
  const h = new Headers(extra);

  // ⓘ localStorage is only defined in the browser,
  // so the helper is safe to import in server components too.
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("idToken");
    if (token) h.set("Authorization", `Bearer ${token}`);
  }

  return h;
}

/* ---------- JSON helper (used by Chat, Image‑Gen, …) ----------------------- */
export async function jsonFetch<T>(
  url: string,
  init: RequestInit = {}
): Promise<T> {
  const headers = authHeaders(init.headers);
  // set JSON headers only if the body is *not* FormData
  if (!(init.body instanceof FormData))
    headers.set("Content-Type", "application/json");

  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    // nicer error bubble‑up
    let msg = await res.text();
    try {
      msg = JSON.parse(msg).error ?? msg;
    } catch {}
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

/* ---------- Generic helper for FormData or blobs --------------------------- */
export async function authFetch(
  url: string,
  init: RequestInit = {}
): Promise<Response> {
  const headers = authHeaders(init.headers);
  return fetch(url, { ...init, headers });
}

/* -------------------------------------------------------------------------- */
/*  3. authFetchJSON – convenience alias around jsonFetch                      */
/*     (used by the new Chat layout / sessions list)                           */
/* -------------------------------------------------------------------------- */
export function authFetchJSON<T = any>(
  url: string,
  init: RequestInit = {}
): Promise<T> {
  return jsonFetch<T>(url, init);
}
