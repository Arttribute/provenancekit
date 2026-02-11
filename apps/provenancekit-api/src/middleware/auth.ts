/**
 * API Key Authentication Middleware
 *
 * When API_KEYS is set (comma-separated), all non-health endpoints require
 * a valid Bearer token in the Authorization header.
 *
 * In development mode (no API_KEYS set), auth is disabled and all
 * requests are allowed through.
 */

import type { MiddlewareHandler } from "hono";
import { config } from "../config.js";
import { ProvenanceKitError } from "../errors.js";

/** Parsed set of valid API keys (empty = auth disabled) */
const validKeys: Set<string> = new Set(
  config.apiKeys
    ? config.apiKeys.split(",").map((k) => k.trim()).filter(Boolean)
    : []
);

/** Paths that never require authentication */
const PUBLIC_PATHS = new Set(["/"]);

/**
 * Bearer token authentication middleware.
 *
 * - If no API_KEYS configured, all requests pass through (dev mode).
 * - Health check (GET /) is always public.
 * - All other requests require: `Authorization: Bearer <key>`
 */
export const authMiddleware: MiddlewareHandler = async (c, next) => {
  // Auth disabled when no keys configured
  if (validKeys.size === 0) {
    return next();
  }

  // Public endpoints pass through
  if (PUBLIC_PATHS.has(c.req.path)) {
    return next();
  }

  const header = c.req.header("Authorization");
  if (!header) {
    throw new ProvenanceKitError("Unauthorized", "Missing Authorization header", {
      recovery: "Include `Authorization: Bearer <api-key>` in your request",
    });
  }

  const [scheme, token] = header.split(" ", 2);
  if (scheme !== "Bearer" || !token || !validKeys.has(token)) {
    throw new ProvenanceKitError("Unauthorized", "Invalid API key", {
      recovery: "Check your API key and ensure it matches a configured key",
    });
  }

  return next();
};
