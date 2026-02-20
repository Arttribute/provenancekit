/**
 * ProvenanceKit API
 *
 * REST API for provenance tracking using @provenancekit/storage.
 */

import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { config } from "./config.js";
import { initializeContext, closeContext } from "./context.js";
import { toProvenanceKitError } from "./errors.js";
import {
  authMiddleware,
  createAuthMiddleware,
  createAPIKeyProvider,
  type AuthProvider,
} from "./middleware/auth.js";

// Handlers
import health from "./handlers/health.js";
import entity from "./handlers/entity.js";
import activity from "./handlers/activity.js";
import bundle from "./handlers/bundle.js";
import similar from "./handlers/similar.js";
import session from "./handlers/session.js";
import { provenanceRoute } from "./handlers/provenance.js";
import graph from "./handlers/graph.js";
import { searchRoute } from "./handlers/search.js";
import payments from "./handlers/payments.js";
import media from "./handlers/media.js";
import ownership from "./handlers/ownership.js";

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

  if (opts?.authProviders) {
    app.use("*", createAuthMiddleware(opts.authProviders));
  } else {
    app.use("*", authMiddleware);
  }

  // Routes
  app.route("/", health);
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
      e.status as any
    );
  });

  return app;
}

// Re-export for programmatic consumers
export { createAuthMiddleware, createAPIKeyProvider, type AuthProvider };
export type { AuthIdentity, AuthMiddlewareOptions } from "./middleware/auth.js";

/*─────────────────────────────────────────────────────────────*\
 | Server Startup                                                |
\*─────────────────────────────────────────────────────────────*/

async function main() {
  try {
    // Initialize storage adapters
    await initializeContext();

    const app = createApp();

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
