/**
 * ProvenanceKit API
 *
 * REST API for provenance tracking using @provenancekit/storage.
 */

import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import { config } from "./config.js";
import { initializeContext, closeContext } from "./context.js";
import { EmbeddingService } from "./embedding/service.js";
import { toProvenanceKitError } from "./errors.js";
import {
  createAuthMiddleware,
  createAPIKeyProvider,
  createDrizzleKeyProvider,
  createSupabaseKeyProvider,
  type AuthProvider,
} from "./middleware/auth.js";
import { createUsageMiddleware } from "./middleware/usage.js";
import { createManagementAuthMiddleware } from "./middleware/management-auth.js";
import { createRateLimitMiddleware } from "./middleware/rate-limit.js";

// Handlers
import health from "./handlers/health.js";
import entity from "./handlers/entity.js";
import activity from "./handlers/activity.js";
import v1 from "./handlers/v1.js";
import bundle from "./handlers/bundle.js";
import similar from "./handlers/similar.js";
import session from "./handlers/session.js";
import { provenanceRoute } from "./handlers/provenance.js";
import graph from "./handlers/graph.js";
import { searchRoute } from "./handlers/search.js";
import payments from "./handlers/payments.js";
import media from "./handlers/media.js";
import ownership from "./handlers/ownership.js";
import management from "./handlers/management.js";

/*─────────────────────────────────────────────────────────────*\
 | App Factory                                                   |
\*─────────────────────────────────────────────────────────────*/

export interface CreateAppOptions {
  /** Custom auth providers. Defaults to API key provider from config. */
  authProviders?: AuthProvider[];
}

/**
 * Create a configured Hono app instance.
 *
 * Use this to embed the ProvenanceKit API in your own server
 * with custom auth providers:
 *
 * ```typescript
 * import { createApp } from "@provenancekit/api";
 * const app = createApp({ authProviders: [myJwtProvider] });
 * ```
 */
export function createApp(opts?: CreateAppOptions) {
  const app = new Hono();

  // Middleware
  app.use("*", cors());

  app.use("*", createAuthMiddleware(opts?.authProviders ?? [], {
    excludePrefixes: ["/management"],
  }));

  // Management control plane — own auth, no pk_live_ key required
  app.use("/management/*", createManagementAuthMiddleware());
  app.route("/management", management);

  // Routes
  app.route("/", health);
  app.route("/v1", v1);
  app.route("/", entity);
  app.route("/", activity);
  app.route("/", bundle);
  app.route("/", similar);
  app.route("/", provenanceRoute);
  app.route("/", graph);
  app.route("/", searchRoute);
  app.route("/", session);
  app.route("/", payments);
  app.route("/", media);
  app.route("/", ownership);

  // 404 handler for unknown routes
  app.notFound((c) =>
    c.json(
      { error: { code: "NotFound", message: `Route not found: ${c.req.method} ${c.req.path}` } },
      404
    )
  );

  // Central error handler
  app.onError((err, c) => {
    const e = toProvenanceKitError(err);
    return c.json(
      {
        error: {
          code: e.code,
          message: e.message,
          recovery: e.recovery,
          details: e.details,
        },
      },
      e.status as ContentfulStatusCode
    );
  });

  return app;
}

// Re-export for programmatic consumers
export {
  createAuthMiddleware,
  createAPIKeyProvider,
  createDrizzleKeyProvider,
  createSupabaseKeyProvider,
  requirePermission,
  type AuthProvider,
  type PermissionLevel,
} from "./middleware/auth.js";
export type { AuthIdentity, AuthMiddlewareOptions } from "./middleware/auth.js";

/*─────────────────────────────────────────────────────────────*\
 | Server Startup                                                |
\*─────────────────────────────────────────────────────────────*/

async function main() {
  try {
    // Initialize storage adapters
    const ctx = await initializeContext();

    // Build auth providers: Drizzle-backed keys (primary) + static API_KEYS fallback
    const authProviders: AuthProvider[] = [];
    if (process.env.DATABASE_URL) {
      authProviders.push(createDrizzleKeyProvider());
    } else if (ctx.supabase) {
      // Legacy fallback: Supabase client (deprecated, will be removed)
      authProviders.push(createSupabaseKeyProvider(ctx.supabase));
    }
    if (config.apiKeys) {
      const keys = config.apiKeys.split(",").map((k) => k.trim());
      authProviders.push(createAPIKeyProvider(keys));
    }

    const app = createApp(authProviders.length > 0 ? { authProviders } : undefined);

    // Pre-warm embedding models — downloads CLIP from HuggingFace once and caches it.
    // Runs in background so it doesn't delay server startup; first request may still
    // block briefly if the download isn't complete, but won't 500 on HF 429s.
    new EmbeddingService().warmup();

    // Rate limiting — sliding window per API key / IP (v1 routes only; management has own auth)
    app.use("/v1/*", createRateLimitMiddleware());
    app.use("/activities*", createRateLimitMiddleware());
    app.use("/entities*", createRateLimitMiddleware());
    app.use("/resources*", createRateLimitMiddleware());

    // Usage recording (fire-and-forget via Drizzle, only when DATABASE_URL is set)
    app.use("*", createUsageMiddleware());

    // Start HTTP server
    serve({ fetch: app.fetch, port: config.port }, ({ port }) =>
      console.log(`ProvenanceKit API running at http://localhost:${port}`)
    );

    // Graceful shutdown
    process.on("SIGINT", async () => {
      console.log("\nShutting down...");
      await closeContext();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      console.log("\nShutting down...");
      await closeContext();
      process.exit(0);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

main();
