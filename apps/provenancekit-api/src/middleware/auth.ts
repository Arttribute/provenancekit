/**
 * Pluggable Authentication Middleware
 *
 * Provides a provider-based auth system. Devs can supply custom AuthProvider
 * functions (JWT, OAuth, wallet, etc.) that resolve to an AuthIdentity.
 *
 * Built-in: API key provider (backwards compatible with previous behaviour).
 *
 * When no API_KEYS are configured, auth is disabled (dev mode).
 */

import { createHash } from "crypto";
import type { MiddlewareHandler, Context, HonoRequest } from "hono";
import type { SupabaseClient } from "@supabase/supabase-js";
import { config } from "../config.js";
import { ProvenanceKitError } from "../errors.js";

/*─────────────────────────────────────────────────────────────*\
 | Types                                                        |
\*─────────────────────────────────────────────────────────────*/

/** Standardized identity extracted by an auth provider. */
export interface AuthIdentity {
  /** Unique identifier for this authenticated principal */
  id: string;
  /** Authentication method used (e.g. "api-key", "jwt", "oauth") */
  method: string;
  /** Optional entity ID to associate with provenance records */
  entityId?: string;
  /** Display name */
  name?: string;
  /** Arbitrary claims from the auth source */
  claims?: Record<string, unknown>;
}

/**
 * An authentication provider function.
 *
 * - Return `AuthIdentity` → authenticated
 * - Return `null` → this provider can't handle the request, try next
 * - Throw → authentication attempted and failed, reject immediately
 */
export type AuthProvider = (req: HonoRequest) => Promise<AuthIdentity | null>;

/*─────────────────────────────────────────────────────────────*\
 | Built-in Providers                                           |
\*─────────────────────────────────────────────────────────────*/

/**
 * Create an API key auth provider.
 *
 * Validates `Authorization: Bearer <key>` against the provided key list.
 */
export function createAPIKeyProvider(keys: string[]): AuthProvider {
  const validKeys = new Set(keys.filter(Boolean));

  return async (req: HonoRequest): Promise<AuthIdentity | null> => {
    if (validKeys.size === 0) return null;

    const header = req.header("Authorization");
    if (!header) return null;

    const [scheme, token] = header.split(" ", 2);
    if (scheme !== "Bearer" || !token) return null;

    if (!validKeys.has(token)) {
      throw new ProvenanceKitError("Unauthorized", "Invalid API key", {
        recovery: "Check your API key and ensure it matches a configured key",
      });
    }

    return {
      id: `apikey:${token.slice(0, 8)}...`,
      method: "api-key",
    };
  };
}

/**
 * Create a Drizzle-backed API key auth provider.
 *
 * Validates `Authorization: Bearer pk_live_*` against the `app_api_keys`
 * table via Drizzle ORM. This is the primary auth provider when DATABASE_URL
 * is configured. Keys are stored as SHA-256 hashes — plaintext never reaches the DB.
 */
export function createDrizzleKeyProvider(): AuthProvider {
  return async (req: HonoRequest): Promise<AuthIdentity | null> => {
    const header = req.header("Authorization");
    if (!header) return null;

    const [scheme, token] = header.split(" ", 2);
    if (scheme !== "Bearer" || !token) return null;

    // Only handle pk_live_ keys — pass others to the next provider
    if (!token.startsWith("pk_live_")) return null;

    const { getDb } = await import("../db/index.js");
    const { appApiKeys, appProjects } = await import("../db/schema.js");
    const { eq } = await import("drizzle-orm");

    const db = getDb();
    if (!db) {
      throw new ProvenanceKitError("Unauthorized", "Database not configured", {
        recovery: "Ensure DATABASE_URL is set in the API environment",
      });
    }

    const keyHash = createHash("sha256").update(token).digest("hex");

    // JOIN to appProjects to get per-project IPFS config in one query.
    // The API uses these credentials for file uploads belonging to this project
    // instead of falling back to platform-level env var defaults.
    const [row] = await db
      .select({
        id: appApiKeys.id,
        projectId: appApiKeys.projectId,
        permissions: appApiKeys.permissions,
        revokedAt: appApiKeys.revokedAt,
        expiresAt: appApiKeys.expiresAt,
        ipfsProvider: appProjects.ipfsProvider,
        ipfsApiKey: appProjects.ipfsApiKey,
        ipfsGateway: appProjects.ipfsGateway,
      })
      .from(appApiKeys)
      .leftJoin(appProjects, eq(appApiKeys.projectId, appProjects.id))
      .where(eq(appApiKeys.keyHash, keyHash))
      .limit(1);

    if (!row) {
      throw new ProvenanceKitError("Unauthorized", "Invalid API key", {
        recovery: "Check your API key is correct and has not been deleted",
      });
    }

    if (row.revokedAt) {
      throw new ProvenanceKitError("Unauthorized", "API key has been revoked", {
        recovery: "Create a new API key in the ProvenanceKit dashboard",
      });
    }

    if (row.expiresAt && new Date(row.expiresAt) < new Date()) {
      throw new ProvenanceKitError("Unauthorized", "API key has expired", {
        recovery: "Create a new API key in the ProvenanceKit dashboard",
      });
    }

    // Update last_used_at (fire-and-forget — non-fatal)
    db.update(appApiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(appApiKeys.id, row.id))
      .then(() => {})
      .catch(() => {});

    return {
      id: `apikey:${token.slice(0, 16)}...`,
      method: "drizzle-api-key",
      claims: {
        projectId: row.projectId,
        permissions: row.permissions,
        keyId: row.id,
        // Per-project IPFS credentials — resolved in context.resolveFileStorage()
        ipfsProvider: row.ipfsProvider ?? undefined,
        ipfsApiKey: row.ipfsApiKey ?? undefined,
        ipfsGateway: row.ipfsGateway ?? undefined,
      },
    };
  };
}

/**
 * @deprecated Use createDrizzleKeyProvider instead.
 * Kept for backwards compatibility — passes the supabase param but ignores it.
 */
export function createSupabaseKeyProvider(_supabase: SupabaseClient): AuthProvider {
  return createDrizzleKeyProvider();
}

/*─────────────────────────────────────────────────────────────*\
 | Middleware Factory                                            |
\*─────────────────────────────────────────────────────────────*/

/** Paths that never require authentication */
const PUBLIC_PATHS = new Set(["/"]);

export interface AuthMiddlewareOptions {
  /** Exact paths that bypass authentication. */
  publicPaths?: string[];
  /**
   * Path prefixes that bypass authentication entirely.
   * Use for sub-apps with their own auth (e.g. "/management").
   */
  excludePrefixes?: string[];
}

/**
 * Create auth middleware from a list of providers.
 *
 * Providers are tried in order. The first to return an AuthIdentity wins.
 * If all return null AND providers exist, the request is rejected.
 * If no providers are configured (dev mode), all requests pass through.
 */
export function createAuthMiddleware(
  providers: AuthProvider[],
  opts?: AuthMiddlewareOptions
): MiddlewareHandler {
  const publicPaths = new Set([
    ...PUBLIC_PATHS,
    ...(opts?.publicPaths ?? []),
  ]);
  const excludePrefixes = opts?.excludePrefixes ?? [];

  return async (c, next) => {
    if (publicPaths.has(c.req.path)) {
      return next();
    }

    // Skip auth for excluded path prefixes (e.g. /management has its own auth)
    if (excludePrefixes.some((prefix) => c.req.path.startsWith(prefix))) {
      return next();
    }

    if (providers.length === 0) {
      return next();
    }

    for (const provider of providers) {
      const identity = await provider(c.req);
      if (identity) {
        c.set("authIdentity", identity);
        return next();
      }
    }

    throw new ProvenanceKitError("Unauthorized", "Missing Authorization header", {
      recovery: "Include `Authorization: Bearer <api-key>` in your request",
    });
  };
}

/**
 * Retrieve the authenticated identity from the Hono context.
 *
 * @returns The AuthIdentity or undefined if unauthenticated (dev mode)
 */
export function getAuthIdentity(c: Context): AuthIdentity | undefined {
  return c.get("authIdentity") as AuthIdentity | undefined;
}

/**
 * Permission levels, ordered from least to most privileged.
 * - `read`  — query provenance data
 * - `write` — record provenance (file, entity, activity)
 * - `admin` — platform operations (suspend entities, revoke records, manage projects)
 */
export type PermissionLevel = "read" | "write" | "admin";

const PERM_RANK: Record<PermissionLevel, number> = { read: 0, write: 1, admin: 2 };

/**
 * Create middleware that requires a minimum permission level.
 *
 * Works with both Supabase-backed keys (`claims.permissions`) and the legacy
 * static API_KEYS provider (which always grants full access for backwards compat).
 *
 * Usage:
 * ```ts
 * app.use("/admin/*", requirePermission("admin"));
 * app.use("/v1/*", requirePermission("write"));
 * ```
 */
export function requirePermission(minLevel: PermissionLevel): MiddlewareHandler {
  return async (c, next) => {
    const identity = getAuthIdentity(c);

    // Dev mode (no auth configured) — pass through
    if (!identity) return next();

    const permissions = (identity.claims?.["permissions"] as string | undefined) ?? "write";
    const rank = PERM_RANK[permissions as PermissionLevel] ?? 1;

    if (rank < PERM_RANK[minLevel]) {
      throw new ProvenanceKitError("Forbidden", `This endpoint requires '${minLevel}' permission`, {
        recovery: `Create an API key with '${minLevel}' permissions in the ProvenanceKit dashboard`,
      });
    }

    return next();
  };
}

/*─────────────────────────────────────────────────────────────*\
 | Default Instance                                             |
\*─────────────────────────────────────────────────────────────*/

const defaultProviders: AuthProvider[] = [];

if (config.apiKeys) {
  const keys = config.apiKeys.split(",").map((k) => k.trim());
  defaultProviders.push(createAPIKeyProvider(keys));
}

/** Default auth middleware using API keys from config. */
export const authMiddleware: MiddlewareHandler = createAuthMiddleware(defaultProviders);
