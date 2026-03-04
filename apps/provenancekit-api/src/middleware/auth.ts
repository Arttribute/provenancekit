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

import type { MiddlewareHandler, Context, HonoRequest } from "hono";
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

/*─────────────────────────────────────────────────────────────*\
 | Middleware Factory                                            |
\*─────────────────────────────────────────────────────────────*/

/** Paths that never require authentication */
const PUBLIC_PATHS = new Set(["/"]);

export interface AuthMiddlewareOptions {
  /** Additional paths that bypass authentication */
  publicPaths?: string[];
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

  return async (c, next) => {
    if (publicPaths.has(c.req.path)) {
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
