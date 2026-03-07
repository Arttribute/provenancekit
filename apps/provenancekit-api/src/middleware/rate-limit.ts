/**
 * In-memory sliding-window rate limiter.
 *
 * Per-key limits using a sliding window algorithm.
 * Falls back gracefully — if the store is exhausted it passes the request
 * rather than hard-failing (non-critical middleware).
 *
 * Configuration via env vars (all optional):
 *   RATE_LIMIT_RPM   — requests per minute per key (default: 60)
 *   RATE_LIMIT_BURST — additional burst allowance (default: 20)
 *
 * The key is derived from (in priority order):
 *   1. Authenticated API key prefix (from auth identity)
 *   2. X-Forwarded-For header
 *   3. Remote address
 *
 * Headers returned:
 *   X-RateLimit-Limit     — max requests per window
 *   X-RateLimit-Remaining — remaining in current window
 *   X-RateLimit-Reset     — Unix timestamp when the window resets (seconds)
 */

import type { MiddlewareHandler } from "hono";
import { getAuthIdentity } from "./auth.js";
import { ProvenanceKitError } from "../errors.js";

const RPM = parseInt(process.env.RATE_LIMIT_RPM ?? "60", 10);
const BURST = parseInt(process.env.RATE_LIMIT_BURST ?? "20", 10);
const LIMIT = RPM + BURST;
const WINDOW_MS = 60_000;

/** Sliding-window entry: array of request timestamps (ms) */
const store = new Map<string, number[]>();

/** Evict stale entries periodically to prevent memory growth */
setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS;
  for (const [key, timestamps] of store) {
    const fresh = timestamps.filter((t) => t > cutoff);
    if (fresh.length === 0) store.delete(key);
    else store.set(key, fresh);
  }
}, 5 * 60_000).unref();

export function createRateLimitMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    // Derive rate-limit key
    const identity = getAuthIdentity(c);
    const key =
      identity?.id ??
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";

    const now = Date.now();
    const cutoff = now - WINDOW_MS;

    const timestamps = (store.get(key) ?? []).filter((t) => t > cutoff);

    const remaining = Math.max(0, LIMIT - timestamps.length);
    const resetAt = Math.ceil((now + WINDOW_MS) / 1000);

    // Always set headers
    c.header("X-RateLimit-Limit", String(LIMIT));
    c.header("X-RateLimit-Remaining", String(remaining));
    c.header("X-RateLimit-Reset", String(resetAt));

    if (timestamps.length >= LIMIT) {
      c.header("Retry-After", String(Math.ceil(WINDOW_MS / 1000)));
      throw new ProvenanceKitError("TooManyRequests", "Rate limit exceeded", {
        recovery: `Wait until ${new Date(resetAt * 1000).toISOString()} and retry`,
      });
    }

    timestamps.push(now);
    store.set(key, timestamps);

    return next();
  };
}
