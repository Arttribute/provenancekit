/**
 * Provenance Handler
 *
 * Alias for /bundle/:cid — kept for SDK compatibility.
 */

import { Hono } from "hono";
import { fetchBundle } from "../services/bundle.service.js";
import { ProvenanceKitError } from "../errors.js";

const r = new Hono();

/**
 * GET /provenance/:cid
 * Returns the same provenance bundle as /bundle/:cid.
 */
r.get("/provenance/:cid", async (c) => {
  const cid = c.req.param("cid");
  if (!cid) {
    throw new ProvenanceKitError("MissingField", "cid path param required");
  }

  const etag = `"${cid}"`;
  if (c.req.header("if-none-match") === etag) {
    return new Response(null, { status: 304 });
  }

  const bundle = await fetchBundle(cid);
  return c.json(bundle, 200, {
    "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
    "ETag": etag,
  });
});

export const provenanceRoute = r;
