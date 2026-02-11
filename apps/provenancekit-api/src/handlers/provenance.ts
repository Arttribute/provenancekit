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

  const bundle = await fetchBundle(cid);
  return c.json(bundle);
});

export const provenanceRoute = r;
