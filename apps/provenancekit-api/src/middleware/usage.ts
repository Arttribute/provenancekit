/**
 * Usage Recording Middleware
 *
 * Fire-and-forget: records each authenticated API call to the shared
 * `app_usage_records` table so the dashboard can display per-project metrics.
 *
 * Uses Drizzle ORM (via DATABASE_URL) when available.
 * Skipped when:
 * - No DATABASE_URL configured (dev/memory mode)
 * - No authenticated identity on the context (public health endpoints)
 * - No projectId in auth claims (static API_KEY provider)
 */

import type { MiddlewareHandler } from "hono";
import { getAuthIdentity } from "./auth.js";
import { getDb } from "../db/index.js";
import { appUsageRecords } from "../db/schema.js";

export function createUsageMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    await next();

    const identity = getAuthIdentity(c);
    if (!identity) return;

    const projectId = identity.claims?.["projectId"] as string | undefined;
    const keyId = identity.claims?.["keyId"] as string | undefined;
    if (!projectId) return;

    const db = getDb();
    if (!db) return;

    // Derive a simple resource type from the path (e.g. "/activities" → "activity")
    const path = c.req.path;
    const segments = path.split("/").filter(Boolean);
    const resourceType = segments[1] ?? segments[0] ?? "unknown";

    // Fire-and-forget
    db.insert(appUsageRecords)
      .values({
        projectId,
        apiKeyId: keyId ?? null,
        endpoint: `${c.req.method} ${path}`,
        resourceType,
        statusCode: c.res.status,
      })
      .then(() => {})
      .catch(() => {});
  };
}
