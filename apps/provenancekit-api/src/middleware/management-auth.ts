/**
 * Management API Authentication Middleware
 *
 * Server-to-server auth for the /management/* control plane.
 * Only called from the provenancekit-app Next.js server — never from browsers.
 *
 * Protocol:
 *   Authorization: Bearer <MANAGEMENT_API_KEY>
 *   X-User-Id:     <userId>   (opaque user identifier from whatever auth the app uses)
 *
 * MANAGEMENT_API_KEY is a long random secret shared between the app and API via
 * environment variables. The app authenticates the user (currently Privy, but
 * any provider works) and delegates the resolved user ID to the API.
 *
 * The API treats userId as an opaque string — no provider-specific validation.
 * Today the app passes a Privy DID; tomorrow it could pass a Clerk user ID,
 * a Supabase Auth UUID, or anything else without changing the API layer.
 */

import type { MiddlewareHandler, Context } from "hono";

const MGMT_KEY_HEADER = "Authorization";
const MGMT_UID_HEADER = "X-User-Id";

/**
 * Create the management auth middleware.
 *
 * Requires MANAGEMENT_API_KEY to be set in the environment.
 * Returns 503 if the key is not configured (misconfiguration guard).
 */
export function createManagementAuthMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    const key = process.env.MANAGEMENT_API_KEY;
    if (!key) {
      return c.json(
        { error: "Management API not configured (MANAGEMENT_API_KEY missing)" },
        503
      );
    }

    const authHeader = c.req.header(MGMT_KEY_HEADER);
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const provided = authHeader.slice(7);
    // Constant-time comparison to prevent timing attacks
    if (!timingSafeEqual(provided, key)) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // X-User-Id is optional — required for user-scoped routes, not for system routes
    const userId = c.req.header(MGMT_UID_HEADER);
    if (userId) c.set("mgmtUserId", userId);
    await next();
  };
}

/**
 * Get the authenticated user ID from the management context.
 * Throws if X-User-Id was not provided (call only from user-scoped routes).
 */
export function getMgmtUserId(c: Context): string {
  const id = c.get("mgmtUserId") as string | undefined;
  if (!id) throw new Error("X-User-Id header is required for this endpoint");
  return id;
}

/** Constant-time string comparison (prevents timing side-channels). */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
