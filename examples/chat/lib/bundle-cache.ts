/**
 * Server-side in-process cache for pre-fetched ProvenanceKit bundles.
 *
 * The background recording task calls cacheBundle() right after pk.file()
 * completes, so when the browser badge fires its GET /bundle/{cid} request
 * through the pk-proxy, the response is served from memory rather than
 * forwarded to the upstream PK API.
 *
 * Uses globalThis so the cache survives Next.js hot-reloads in development
 * while still being shared across requests within the same Node.js process.
 */

const TTL_MS = 10 * 60 * 1000; // 10 minutes

interface CacheEntry { data: unknown; cachedAt: number }

declare global {
  // eslint-disable-next-line no-var
  var _pkBundleCache: Map<string, CacheEntry> | undefined;
}

const cache: Map<string, CacheEntry> = (global._pkBundleCache ??= new Map());

export function cacheBundle(cid: string, data: unknown): void {
  cache.set(cid, { data, cachedAt: Date.now() });
}

export function getCachedBundle(cid: string): unknown | null {
  const entry = cache.get(cid);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > TTL_MS) {
    cache.delete(cid);
    return null;
  }
  return entry.data;
}
